import {mkdir, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

// Do not include upstream response bodies or caught exception messages in errors:
// those can echo credentials, input text or account data into Actions logs.
function credentials(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Falta ELEVENLABS_API_KEY. Configura el secreto de Actions o activa el modo demo.');
  }
  return apiKey.trim();
}

function targetPath(outputPath) {
  if (typeof outputPath !== 'string' || !outputPath || outputPath.includes('\0')) {
    throw new Error('La ruta de salida de audio no es válida.');
  }
}

function httpError(status) {
  const descriptions = {
    400: 'Solicitud de audio rechazada; revisa texto, modelo y configuración de voz.',
    401: 'ELEVENLABS_API_KEY no es válida o ha caducado.',
    402: 'La cuenta de ElevenLabs no dispone de créditos suficientes.',
    403: 'La clave no tiene permiso para usar la voz, el modelo o la función solicitada.',
    404: 'La voz o el recurso de ElevenLabs no está disponible para esta cuenta.',
    422: 'ElevenLabs rechazó los parámetros de generación.',
    429: 'ElevenLabs alcanzó el límite de solicitudes o de créditos. Revisa la cuenta antes de volver a ejecutar.',
  };
  const detail = descriptions[status] ?? 'El servicio de ElevenLabs no pudo completar la generación.';
  return new Error(`ElevenLabs HTTP ${Number.isInteger(status) ? status : 'desconocido'}: ${detail} No se reintentó para evitar cobros duplicados.`);
}

async function post({endpoint, body, apiKey, fetchImpl, timeoutMs}) {
  if (typeof fetchImpl !== 'function') throw new Error('No hay un cliente HTTP disponible.');
  let response;
  try {
    response = await fetchImpl(`https://api.elevenlabs.io${endpoint}`, {
      method: 'POST',
      headers: {'xi-api-key': credentials(apiKey), 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
  } catch (error) {
    // Missing credentials are validated by the public functions before reaching here.
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new Error(timedOut
      ? 'La generación de ElevenLabs agotó el tiempo de espera. Puede haber consumido créditos; revisa la cuenta antes de repetir.'
      : 'No se pudo contactar con ElevenLabs. No se reintentó; revisa la conexión y el consumo de la cuenta antes de repetir.');
  }
  if (!response || typeof response.ok !== 'boolean') throw new Error('Respuesta HTTP no válida de ElevenLabs.');
  if (!response.ok) throw httpError(response.status);
  return response;
}

function mp3Bytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4 || bytes.length > 64 * 1024 * 1024) {
    throw new Error('ElevenLabs devolvió un archivo de audio vacío o de tamaño no válido.');
  }
  const isId3 = bytes.subarray(0, 3).toString('ascii') === 'ID3';
  const isFrame = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  if (!isId3 && !isFrame) throw new Error('ElevenLabs no devolvió audio MP3 válido.');
  return bytes;
}

function decodeAudio(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0 ||
      value.length > 90 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('El audio base64 de ElevenLabs no es válido.');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('El audio base64 de ElevenLabs no es válido.');
  return mp3Bytes(bytes);
}

export function validateAlignment(value) {
  const characters = value?.characters;
  const starts = value?.character_start_times_seconds;
  const ends = value?.character_end_times_seconds;
  if (!Array.isArray(characters) || characters.length === 0 || !Array.isArray(starts) ||
      !Array.isArray(ends) || starts.length !== characters.length || ends.length !== characters.length) {
    throw new Error('ElevenLabs no devolvió marcas de tiempo utilizables para los subtítulos.');
  }
  for (let index = 0; index < characters.length; index++) {
    if (typeof characters[index] !== 'string' || [...characters[index]].length !== 1 ||
        !Number.isFinite(starts[index]) || !Number.isFinite(ends[index]) || starts[index] < 0 ||
        ends[index] < starts[index] || ends[index] > 3600 ||
        (index > 0 && (starts[index] < starts[index - 1] || ends[index] < ends[index - 1]))) {
      throw new Error('Las marcas de tiempo de ElevenLabs son incoherentes.');
    }
  }
  if (ends.at(-1) <= 0) throw new Error('Las marcas de tiempo de ElevenLabs no tienen duración.');
  return {
    characters: [...characters],
    character_start_times_seconds: [...starts],
    character_end_times_seconds: [...ends],
  };
}

async function saveAudio(outputPath, bytes) {
  try {
    await mkdir(dirname(outputPath), {recursive: true});
    await writeFile(outputPath, bytes, {mode: 0o600});
  } catch {
    throw new Error('No se pudo guardar el audio generado. Revisa permisos y espacio disponible.');
  }
}

/** One paid POST at most. The caller chooses demo vs paid mode before calling. */
export async function generateNarration({text, outputPath, apiKey, voiceId = DEFAULT_VOICE_ID, fetchImpl = fetch}) {
  credentials(apiKey);
  targetPath(outputPath);
  if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
    throw new Error('La narración debe contener entre 1 y 5000 caracteres.');
  }
  if (typeof voiceId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(voiceId)) {
    throw new Error('ELEVENLABS_VOICE_ID no es un identificador de voz válido.');
  }
  const response = await post({
    endpoint: `/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,
    apiKey, fetchImpl, timeoutMs: 90_000,
    body: {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {stability: 0.65, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true},
      seed: 42,
    },
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('ElevenLabs devolvió una respuesta de narración que no es JSON válido.');
  }
  // Use original-text alignment so the caller can map scenes to character offsets.
  const alignment = validateAlignment(payload?.alignment);
  const bytes = decodeAudio(payload?.audio_base64);
  await saveAudio(outputPath, bytes);
  return alignment;
}

/** Optional paid request. Sound-effect failure can be handled separately by caller. */
export async function generateSoundEffect({outputPath, apiKey, fetchImpl = fetch}) {
  credentials(apiKey);
  targetPath(outputPath);
  const response = await post({
    endpoint: '/v1/sound-generation?output_format=mp3_44100_128',
    apiKey, fetchImpl, timeoutMs: 60_000,
    body: {
      text: 'A short playful cartoon swoosh with a soft pop, clean and subtle, no speech, no music.',
      duration_seconds: 1,
      prompt_influence: 0.3,
    },
  });
  let bytes;
  try {
    bytes = Buffer.from(await response.arrayBuffer());
  } catch {
    throw new Error('No se pudo leer el efecto de sonido de ElevenLabs.');
  }
  await saveAudio(outputPath, mp3Bytes(bytes));
  return outputPath;
}
