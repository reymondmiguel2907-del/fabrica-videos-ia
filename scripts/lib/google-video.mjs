import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

// Current REST contract, checked against Google's documentation:
// https://aistudio.google.com/docs/omni
// https://aistudio.google.com/docs/background-execution
// REST video output lives in steps[].content[], not the SDK's output_video.
export const DEFAULT_VIDEO_MODEL = 'gemini-omni-1.2-flash';
const API_ORIGIN = 'https://generativelanguage.googleapis.com';
const API = `${API_ORIGIN}/v1beta`;
const DEADLINE_MS = 15 * 60_000;
const POLL_MS = 10_000;
const MAX_VIDEO_BYTES = 128 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9_-]{1,2048}$/;

function deadlineError() {
  return new Error('Google agotó los 15 minutos de espera del clip. La generación puede seguir activa y consumir créditos; no se reintentó.');
}

function budget(sleepImpl) {
  const deadline = Date.now() + DEADLINE_MS;
  let waited = 0;
  const remaining = () => {
    const left = Math.min(deadline - Date.now(), DEADLINE_MS - waited);
    if (left <= 0) throw deadlineError();
    return left;
  };
  return {
    remaining,
    async pause() {
      const delay = Math.min(POLL_MS, remaining());
      try { await sleepImpl(delay); }
      catch { throw new Error('Se interrumpió la espera del clip de Google. No se volvió a solicitar la generación.'); }
      waited += delay;
      remaining();
    },
  };
}

async function imageInput(referenceImage) {
  if (referenceImage === undefined || referenceImage === null) return undefined;
  if (typeof referenceImage !== 'string' || !referenceImage || referenceImage.includes('\0')) {
    throw new Error('La imagen de referencia debe ser una ruta local a PNG, JPEG o WebP.');
  }
  let bytes;
  try {
    const info = await stat(referenceImage);
    if (!info.isFile() || info.size <= 0 || info.size > MAX_IMAGE_BYTES) {
      throw new Error();
    }
    bytes = await readFile(referenceImage);
  } catch {
    throw new Error('No se pudo leer la imagen de referencia local; debe pesar entre 1 byte y 10 MB.');
  }
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error('La imagen de referencia supera 10 MB.');
  let mime;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) mime = 'image/png';
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = 'image/jpeg';
  else if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') mime = 'image/webp';
  if (!mime) throw new Error('La imagen de referencia no contiene PNG, JPEG o WebP reconocible.');
  return {type: 'image', data: bytes.toString('base64'), mime_type: mime};
}

function httpError(status) {
  const code = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 'desconocido';
  const detail = {
    400: 'Revisa el modelo, el prompt, la imagen y los parámetros del clip.',
    401: 'La clave de Google no es válida.',
    403: 'La cuenta no tiene permiso para usar el modelo de video.',
    404: 'El modelo o la interacción ya no está disponible.',
    429: 'Se alcanzó un límite de cuota o de solicitudes.',
  }[code] || 'El servicio de Google no completó la solicitud.';
  return new Error(`Google HTTP ${code}: ${detail} No se reintentó la generación para evitar cobros duplicados.`);
}

async function request(url, {method = 'GET', body, apiKey, fetchImpl, timer}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        // Credentials are confined to the Google API origin. Never put keys in URLs.
        ...(new URL(url).origin === API_ORIGIN ? {'x-goog-api-key': apiKey, 'Api-Revision': '2026-05-20'} : {}),
        ...(body ? {'Content-Type': 'application/json'} : {}),
      },
      ...(body ? {body: JSON.stringify(body)} : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.max(1, Math.min(30_000, timer.remaining()))),
    });
  } catch {
    throw new Error('No se pudo completar la conexión con Google. Puede haber consumido créditos; no se reintentó la generación.');
  }
  timer.remaining();
  if (!response || typeof response.ok !== 'boolean') throw new Error('Google devolvió una respuesta HTTP no válida.');
  return response;
}

async function jsonRequest(url, options) {
  const response = await request(url, options);
  // Redirects are never followed for API requests, including the paid POST.
  if (!response.ok) throw httpError(response.status);
  let value;
  try { value = await response.json(); }
  catch { throw new Error('Google devolvió una respuesta JSON no válida.'); }
  options.timer.remaining();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Google devolvió una respuesta de interacción no válida.');
  return value;
}

function videoOutput(interaction) {
  if (!Array.isArray(interaction.steps)) throw new Error('La interacción de Google no contiene un clip de video.');
  const videos = interaction.steps.filter((step) => step?.type === 'model_output')
    .flatMap((step) => Array.isArray(step.content) ? step.content : [])
    .filter((content) => content?.type === 'video');
  if (videos.length !== 1 || videos[0].mime_type !== 'video/mp4') {
    throw new Error('La interacción de Google no contiene exactamente un clip MP4 válido.');
  }
  return videos[0];
}

function mp4Bytes(bytes) {
  // Check the ISO BMFF signature before publishing. FFmpeg performs full decoding
  // and checks the video/audio tracks later in the pipeline.
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > MAX_VIDEO_BYTES ||
      bytes.subarray(4, 8).toString('ascii') !== 'ftyp') {
    throw new Error('Google no devolvió un archivo MP4 reconocible de tamaño válido.');
  }
  return bytes;
}

function inlineVideo(data) {
  if (typeof data !== 'string' || !data || data.length % 4 ||
      data.length > Math.ceil(MAX_VIDEO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new Error('Google devolvió datos base64 de video no válidos.');
  }
  const bytes = Buffer.from(data, 'base64');
  if (bytes.toString('base64') !== data) throw new Error('Google devolvió datos base64 de video no válidos.');
  return mp4Bytes(bytes);
}

function downloadUrl(uri, base = API + '/') {
  let url;
  try {
    if (typeof uri !== 'string' || !uri || uri.length > 8192) throw new Error();
    url = new URL(uri, base);
  } catch { throw new Error('Google devolvió una dirección de descarga no válida.'); }
  const allowed = url.hostname === 'generativelanguage.googleapis.com' ||
    url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.googleusercontent.com');
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new Error('Google devolvió una descarga fuera de los hosts HTTPS permitidos.');
  }
  // A response URL must never propagate an API key through a redirect.
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase() === 'key' || key.toLowerCase() === 'x-goog-api-key') url.searchParams.delete(key);
  }
  return url;
}

async function downloadedVideo(uri, options) {
  let url = downloadUrl(uri);
  if (url.origin === API_ORIGIN) {
    const match = url.pathname.match(/^\/v1beta\/files\/([A-Za-z0-9_-]+)(?::download)?$/);
    if (!match) throw new Error('Google devolvió una ruta de archivo no válida.');
    const fileUrl = `${API}/files/${match[1]}`;
    let file = await jsonRequest(fileUrl, options);
    while (file.state === 'PROCESSING') {
      await options.timer.pause();
      file = await jsonRequest(fileUrl, options);
    }
    if (file.state !== 'ACTIVE') throw new Error('El archivo de video de Google no está disponible o no se pudo procesar.');
    url = new URL(`${fileUrl}:download?alt=media`);
  }
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await request(url.href, options);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === 4) throw new Error('La descarga de Google superó el límite de redirecciones.');
      const location = response.headers?.get('location');
      url = downloadUrl(location, url.href);
      continue;
    }
    if (!response.ok) throw httpError(response.status);
    const length = Number(response.headers?.get('content-length'));
    if (Number.isFinite(length) && length > MAX_VIDEO_BYTES) throw new Error('El clip de Google supera el tamaño máximo de descarga.');
    const chunks = [];
    let total = 0;
    try {
      if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
        for await (const chunk of response.body) {
          options.timer.remaining();
          total += chunk.length;
          if (total > MAX_VIDEO_BYTES) throw new Error();
          chunks.push(Buffer.from(chunk));
        }
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > MAX_VIDEO_BYTES) throw new Error();
        chunks.push(bytes);
      }
    } catch { throw new Error('No se pudo descargar por completo el MP4 de Google dentro de los límites permitidos.'); }
    options.timer.remaining();
    return mp4Bytes(Buffer.concat(chunks));
  }
  throw new Error('No se pudo completar la descarga del clip de Google.');
}

/**
 * Generate one 3–15-second clip with one paid POST, followed only by GETs.
 * referenceImage is an optional local PNG/JPEG/WebP path. The caller decides
 * demo vs paid mode and normalizes/validates the resulting media with FFmpeg.
 * No upstream bodies, URLs, credentials or arbitrary exception text are logged.
 */
export async function generateSceneClip({prompt, duration, referenceImage, outputPath, apiKey,
  model = DEFAULT_VIDEO_MODEL, fetchImpl = fetch, sleepImpl = sleep}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('Falta GEMINI_API_KEY para generar los clips.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 12000) throw new Error('El prompt del clip debe contener entre 1 y 12000 caracteres.');
  if (!Number.isInteger(duration) || duration < 3 || duration > 15) throw new Error('El clip de Google debe durar un entero de 3 a 15 segundos.');
  if (typeof outputPath !== 'string' || !outputPath || outputPath.includes('\0')) throw new Error('Falta una ruta de salida de video válida.');
  if (typeof model !== 'string' || !/^gemini-omni-[A-Za-z0-9.-]{1,80}$/.test(model)) throw new Error('El modelo de video de Google no es válido.');
  if (typeof fetchImpl !== 'function' || typeof sleepImpl !== 'function') throw new Error('Falta un cliente HTTP o un temporizador válido para Google.');
  const reference = await imageInput(referenceImage);
  const timer = budget(sleepImpl);
  const options = {apiKey: apiKey.trim(), fetchImpl, timer};
  let interaction = await jsonRequest(`${API}/interactions`, {...options, method: 'POST', body: {
    model,
    input: reference ? [reference, {type: 'text', text: prompt}] : prompt,
    background: true,
    response_format: {type: 'video', aspect_ratio: '9:16', duration: `${duration}s`, delivery: 'uri'},
  }});
  const id = interaction.id;
  if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error('Google no devolvió un identificador de interacción válido.');
  while (interaction.status === 'in_progress') {
    await timer.pause();
    interaction = await jsonRequest(`${API}/interactions/${id}`, options);
    if (interaction.id !== id) throw new Error('Google devolvió una interacción distinta de la solicitada.');
  }
  if (interaction.status !== 'completed') throw new Error('Google no completó el clip de video. No se volvió a solicitar la generación.');
  const video = videoOutput(interaction);
  const bytes = video.data !== undefined ? inlineVideo(video.data) : await downloadedVideo(video.uri, options);
  timer.remaining();
  try {
    await mkdir(dirname(outputPath), {recursive: true});
    await writeFile(outputPath, bytes, {mode: 0o600});
  } catch { throw new Error('No se pudo guardar el clip de Google. Revisa permisos y espacio disponible.'); }
  return {outputPath, model, duration, bytes: bytes.length};
}
