import {copyFile, mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {generateSceneClip} from './google-video.mjs';
import {probe, run} from './media.mjs';

export async function createSceneClips({plan, referenceImage, publicDir, outDir, apiKey, model, narrationPath,
  generateImpl = generateSceneClip}) {
  const clips = join(publicDir, 'clips');
  const published = join(outDir, 'clips');
  await mkdir(clips, {recursive: true});
  await mkdir(published, {recursive: true});
  const scenes = [];
  for (let index = 0; index < plan.scenes.length; index++) {
    const scene = plan.scenes[index];
    const name = `escena-${String(index + 1).padStart(2, '0')}.mp4`;
    const raw = join(publicDir, `source-${index}.mp4`);
    const normalized = join(clips, name);
    const duration = scene.endSeconds - scene.startSeconds;
    const prompt = [
      'Create an original animated 2D cartoon scene. Use the reference for drawing style and host consistency. Follow the character bible when the user requests a different cast.',
      plan.styleBible, plan.characterBible, scene.visualPrompt,
      'No on-screen text, captions, logos, watermarks or generated dialogue. Gestures and action should match the scene. A separate Spanish narration and captions will be added later. Keep important action within the central portrait safe area.',
      `Scene length: ${duration} seconds. Follow this specific action and do not reveal story information from later scenes.`
    ].join('\n');
    console.log(`Generando escena IA ${index + 1}/${plan.scenes.length} (${duration}s)…`);
    await generateImpl({prompt, duration, referenceImage, outputPath: raw, apiKey, model});
    const data = await probe(raw);
    const video = data.streams?.find((stream) => stream.codec_type === 'video');
    const measured = Number(data.format?.duration);
    if (!video || !Number.isFinite(measured) || measured < duration - 0.2) {
      throw new Error(`La escena ${index + 1} no contiene un clip de la duración solicitada. No se reintentará la generación de pago.`);
    }
    // Standardize provider output before Remotion reads it. Native audio is
    // deliberately removed because the complete video uses one consistent voice.
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1,format=yuv420p',
      '-an', '-t', String(duration), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', normalized]);
    if (narrationPath) {
      // Downloadable scene files include their matching voice segment as well.
      // Only deliberate silent scenes (e.g. countdowns) have no spoken audio.
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', normalized,
        '-ss', String(scene.startSeconds), '-i', narrationPath, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(duration),
        '-movflags', '+faststart', join(published, name)]);
    } else await copyFile(normalized, join(published, name));
    scenes.push({...scene, mediaSrc: `clips/${name}`});
  }
  return {...plan, scenes};
}
