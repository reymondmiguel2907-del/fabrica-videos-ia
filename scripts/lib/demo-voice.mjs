import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {run, probe, analyzeAudio} from './media.mjs';
import {prepareTimedNarration} from './timed-audio.mjs';

/**
 * Offline Spanish robotic male narration. Timings are an approximation derived
 * from measured audio duration, not forced alignment or an ElevenLabs response.
 */
export async function generateDemoNarration({text, outputPath}) {
  if (typeof text !== 'string' || !text.trim() || text.includes('\0') || [...text].length > 20_000) {
    throw new Error('La narración demo debe contener entre 1 y 20000 caracteres de texto.');
  }
  if (typeof outputPath !== 'string' || !outputPath || outputPath.includes('\0')) {
    throw new Error('La ruta de salida de la narración demo no es válida.');
  }
  // Check installation before creating any output; never silently replace speech
  // with tones or call a paid service when offline synthesis is unavailable.
  await run('espeak-ng', ['--version']);
  const directory = await mkdtemp(join(tmpdir(), 'demo-voice-'));
  try {
    const input = join(directory, 'narration.txt');
    const source = join(directory, 'spoken.wav');
    await writeFile(input, text, {encoding: 'utf8', mode: 0o600});
    // Text is read from a UTF-8 file, never interpolated in shell or CLI options.
    await run('espeak-ng', ['-v', 'es', '-s', '145', '-p', '35', '-a', '150',
      '-b', '1', '-f', input, '-w', source]);
    await mkdir(dirname(outputPath), {recursive: true});
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1',
      '-c:a', 'pcm_s16le', outputPath]);
    const metadata = await probe(outputPath);
    const duration = Number(metadata.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('La síntesis de voz demo no produjo audio con duración válida.');
    }
    if ((await analyzeAudio(outputPath)).silent) {
      throw new Error('La voz demo se generó en silencio. Revisa la instalación de espeak-ng.');
    }
    const characters = [...text];
    const lead = Math.min(0.04, duration / 20);
    const usable = duration - lead - Math.min(0.12, duration / 10);
    const weights = characters.map((char) => /\s/u.test(char) ? 0.45 : /[.,;:!?¿¡]/u.test(char) ? 1.2 : 1);
    const weightSum = weights.reduce((total, weight) => total + weight, 0);
    let cursor = lead;
    const starts = [], ends = [];
    weights.forEach((weight) => {
      starts.push(cursor);
      cursor += usable * weight / weightSum;
      ends.push(cursor);
    });
    return {
      characters,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    };
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

/**
 * Fixed slots need real sentence boundaries. Synthesize each spoken scene once
 * locally, concatenate the full WAVs and retain their exact measured offsets.
 * Approximate character timings affect subtitles, never scene audio cuts.
 */
export async function generateDemoPlanNarration({plan, outputPath}) {
  if (!Array.isArray(plan?.scenes) || !plan.scenes.length ||
      !plan.scenes.every((scene) => typeof scene.narration === 'string')) {
    throw new Error('El plan demo no contiene escenas de narración válidas.');
  }
  const spoken = plan.scenes.filter((scene) => scene.narration.length > 0);
  if (!spoken.length) throw new Error('El plan demo debe contener al menos una escena hablada.');
  const directory = await mkdtemp(join(tmpdir(), 'demo-plan-voice-'));
  try {
    const alignment = {
      characters: [], character_start_times_seconds: [], character_end_times_seconds: [],
    };
    const filenames = [];
    let offset = 0;
    for (let index = 0; index < spoken.length; index++) {
      const filename = `scene-${String(index).padStart(3, '0')}.wav`;
      const path = join(directory, filename);
      const sceneAlignment = await generateDemoNarration({text: spoken[index].narration, outputPath: path});
      const duration = Number((await probe(path)).format?.duration);
      if (index) {
        alignment.characters.push(' ');
        alignment.character_start_times_seconds.push(offset);
        alignment.character_end_times_seconds.push(offset);
      }
      const starts = sceneAlignment.character_start_times_seconds.map((time) => offset + time);
      const ends = sceneAlignment.character_end_times_seconds.map((time) => offset + time);
      // Keep every sample of the scene's speech. A global character estimate
      // cannot identify phoneme boundaries accurately enough for audio trimming.
      starts[0] = offset;
      ends[ends.length - 1] = offset + duration;
      alignment.characters.push(...sceneAlignment.characters);
      alignment.character_start_times_seconds.push(...starts);
      alignment.character_end_times_seconds.push(...ends);
      offset += duration;
      filenames.push(filename);
    }
    const manifest = join(directory, 'scenes.txt');
    await writeFile(manifest, filenames.map((filename) => `file '${filename}'`).join('\n') + '\n');
    const source = join(directory, 'complete.wav');
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat',
      '-safe', '1', '-i', manifest, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', source]);
    const {segments} = await prepareTimedNarration({plan, alignment, source, output: outputPath});
    return {alignment, segments};
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}
