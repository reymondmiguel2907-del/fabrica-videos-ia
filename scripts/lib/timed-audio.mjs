import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {validateAlignment} from './elevenlabs.mjs';
import {run, probe, tempoFilters} from './media.mjs';

const SAMPLE_RATE = 44_100;

function validatePlan(plan) {
  if (!Number.isFinite(plan?.duration) || plan.duration <= 0 ||
      !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error('El plan de voz temporizada no tiene escenas o duración válida.');
  }
  let previousEnd = 0;
  const ids = new Set();
  for (const scene of plan.scenes) {
    if (typeof scene.id !== 'string' || !scene.id || ids.has(scene.id) ||
        typeof scene.narration !== 'string' ||
        (scene.narration.length > 0 && !scene.narration.trim()) ||
        !Number.isFinite(scene.startSeconds) || !Number.isFinite(scene.endSeconds) ||
        scene.endSeconds <= scene.startSeconds ||
        Math.abs(scene.startSeconds - previousEnd) > 1 / SAMPLE_RATE) {
      throw new Error('Las escenas de voz deben tener identificadores únicos y tiempos contiguos válidos.');
    }
    if (scene.narration && scene.endSeconds - scene.startSeconds <= 0.2) {
      throw new Error('Una escena hablada no tiene espacio suficiente para su voz.');
    }
    previousEnd = scene.endSeconds;
    ids.add(scene.id);
  }
  if (Math.abs(previousEnd - plan.duration) > 1 / SAMPLE_RATE) {
    throw new Error('Las escenas de voz no cubren la duración completa del plan.');
  }
}

/**
 * Place one already-generated narration into fixed scene slots. This function
 * never calls a provider, reads credentials or slows down speech.
 * Character ranges use Unicode array indices: start inclusive, end exclusive.
 */
export async function prepareTimedNarration({plan, alignment, source, output}) {
  validatePlan(plan);
  const checked = validateAlignment(alignment);
  const spokenScenes = plan.scenes.filter((scene) => scene.narration.length > 0);
  const expectedText = spokenScenes.map((scene) => scene.narration).join(' ');
  if (checked.characters.join('') !== expectedText) {
    throw new Error('La alineación de voz temporizada no coincide con el guion hablado.');
  }
  if (typeof source !== 'string' || !source || typeof output !== 'string' || !output) {
    throw new Error('Falta una ruta válida para el audio de voz temporizada.');
  }
  const metadata = await probe(source);
  const sourceDuration = Number(metadata.format?.duration);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 ||
      !metadata.streams?.some((stream) => stream.codec_type === 'audio')) {
    throw new Error('El audio original no contiene una pista con duración válida.');
  }
  let offset = 0;
  const prepared = spokenScenes.map((scene) => {
    const startCharacter = offset;
    const endCharacter = offset + [...scene.narration].length;
    if (endCharacter > checked.characters.length || endCharacter <= startCharacter) {
      throw new Error('El rango de caracteres de una escena está fuera de la alineación.');
    }
    const sourceStart = checked.character_start_times_seconds[startCharacter];
    const sourceEnd = checked.character_end_times_seconds[endCharacter - 1];
    if (sourceStart < 0 || sourceEnd <= sourceStart || sourceEnd > sourceDuration + 1 / SAMPLE_RATE) {
      throw new Error('Las marcas de una escena están fuera de la duración del audio original.');
    }
    const slotDuration = scene.endSeconds - scene.startSeconds;
    const speed = Math.max(1, (sourceEnd - sourceStart) / (slotDuration - 0.2));
    if (speed > 1.8) {
      throw new Error('La narración de una escena no cabe con voz natural. Acorta el guion; no se reintentará la API.');
    }
    offset = endCharacter + 1;
    return {sceneId: scene.id, startCharacter, endCharacter, sourceStart, sourceEnd, speed};
  });

  const directory = await mkdtemp(join(tmpdir(), 'timed-narration-'));
  try {
    const filenames = [];
    for (let index = 0; index < plan.scenes.length; index++) {
      const scene = plan.scenes[index];
      const segment = prepared.find((item) => item.sceneId === scene.id);
      const filename = `segment-${String(index).padStart(3, '0')}.wav`;
      const target = join(directory, filename);
      const sampleCount = Math.round((scene.endSeconds - scene.startSeconds) * SAMPLE_RATE);
      if (segment) {
        const filters = [
          `atrim=start=${segment.sourceStart}:end=${segment.sourceEnd}`,
          'asetpts=PTS-STARTPTS', tempoFilters(segment.speed),
          'loudnorm=I=-16:TP=-1.5:LRA=11', `aresample=${SAMPLE_RATE}`,
          'aformat=channel_layouts=mono', `apad=whole_len=${sampleCount}`,
          `atrim=end_sample=${sampleCount}`,
        ];
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source,
          '-vn', '-af', filters.join(','), '-ar', String(SAMPLE_RATE), '-ac', '1',
          '-c:a', 'pcm_s16le', target]);
      } else {
        // Empty narration is deliberate silence, including the entire countdown.
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
          '-i', `anullsrc=channel_layout=mono:sample_rate=${SAMPLE_RATE}`,
          '-af', `atrim=end_sample=${sampleCount}`, '-ar', String(SAMPLE_RATE),
          '-ac', '1', '-c:a', 'pcm_s16le', target]);
      }
      filenames.push(filename);
    }
    // Only fixed, local filenames enter the concat manifest, never user input.
    const manifest = join(directory, 'segments.txt');
    await writeFile(manifest, filenames.map((filename) => `file '${filename}'`).join('\n') + '\n');
    await mkdir(dirname(output), {recursive: true});
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat',
      '-safe', '1', '-i', manifest, '-ar', String(SAMPLE_RATE), '-ac', '1',
      '-c:a', 'pcm_s16le', output]);
    const finished = await probe(output);
    const finalDuration = Number(finished.format?.duration);
    if (!Number.isFinite(finalDuration) || Math.abs(finalDuration - plan.duration) > 0.002) {
      throw new Error('El audio temporizado no conserva la duración exacta del video.');
    }
    return {segments: prepared.map(({sourceEnd, ...segment}) => segment)};
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}
