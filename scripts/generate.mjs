import {mkdir, rm, writeFile, rename} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, selectComposition, renderMedia} from '@remotion/renderer';
import {readConfig} from './lib/config.mjs';
import {createPlan, demoAlignment, buildTimeline, toSrt} from './lib/plan.mjs';
import {generateNarration, generateSoundEffect} from './lib/elevenlabs.mjs';
import {run, probe, validateProbe, createDemoAudio, prepareNarration, finishVideo} from './lib/media.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'out');
const temp = resolve(root, '.cache', 'generation');

async function main() {
  const config = readConfig();
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  // Clean previous deliverables before starting: failed runs never publish stale MP4s.
  await rm(out, {recursive: true, force: true});
  await rm(temp, {recursive: true, force: true});
  await mkdir(out, {recursive: true});
  await mkdir(temp, {recursive: true});
  const plan = createPlan(config.theme, config.duration);
  // Fail browser/bundling prerequisites before any potentially billable request.
  console.log('Preparando navegador y escenas Remotion…');
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  if (!browserExecutable) await ensureBrowser();
  const serveUrl = await bundle({entryPoint: resolve(root, 'src/index.ts'), outDir: resolve(temp, 'bundle')});
  const previewProps = {...buildTimeline(plan, demoAlignment(plan.text, config.duration)), demo: config.demo};
  await selectComposition({serveUrl, id: 'VideoVertical', inputProps: previewProps, browserExecutable});
  const audio = resolve(temp, 'audio.wav');
  let alignment;
  let speed = 1;
  let effect;
  console.log(`Preparando ${config.duration}s. Modo ${config.demo ? 'DEMO: sin llamadas API' : 'ElevenLabs: narración de pago'}.`);
  if (config.demo) {
    alignment = demoAlignment(plan.text, config.duration);
    await createDemoAudio(audio, config.duration, config.sfx);
  } else {
    const source = resolve(temp, 'narration.mp3');
    alignment = await generateNarration({text: plan.text, outputPath: source,
      apiKey: process.env.ELEVENLABS_API_KEY, voiceId: config.voiceId});
    const measured = Number((await probe(source)).format?.duration);
    if (!Number.isFinite(measured) || measured <= 0) throw new Error('ElevenLabs devolvió un audio sin duración válida.');
    speed = measured / (config.duration - 0.4);
    if (speed < 0.55 || speed > 1.8) {
      throw new Error('La voz no cabe con ritmo natural. Acorta el tema o cambia la duración. No se harán reintentos de pago.');
    }
    await prepareNarration(source, audio, speed, config.duration);
    if (config.sfx) {
      effect = resolve(temp, 'effect.mp3');
      // Optional effect failure must not discard an already paid narration.
      try {
        await generateSoundEffect({outputPath: effect, apiKey: process.env.ELEVENLABS_API_KEY});
        await probe(effect);
      } catch {
        console.warn('El efecto opcional no está disponible; se continuará sin él, sin reintentar.');
        effect = undefined;
      }
    }
  }
  const timeline = {...buildTimeline(plan, alignment, speed), demo: config.demo};
  await writeFile(resolve(out, 'storyboard.json'), JSON.stringify({
    ...timeline, narration: plan.text, durationSeconds: config.duration,
    audioMode: config.demo ? 'local-demo-tones' : 'elevenlabs',
    voiceId: config.demo ? null : config.voiceId, soundEffects: config.sfx && (config.demo || !!effect)
  }, null, 2));
  await writeFile(resolve(out, 'subtitles.srt'), toSrt(timeline.captions));
  const composition = await selectComposition({serveUrl, id: 'VideoVertical', inputProps: timeline, browserExecutable});
  const silent = resolve(temp, 'silent.mp4');
  let reported = -1;
  await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: silent,
    inputProps: timeline, browserExecutable, concurrency: 2,
    onProgress: ({progress}) => {
      const step = Math.floor(progress * 5);
      if (step > reported) {console.log(`Render: ${Math.min(step * 20, 100)}%`); reported = step;}
    }});
  const candidate = resolve(temp, 'finished.mp4');
  await finishVideo({video: silent, audio, effect, output: candidate, duration: config.duration,
    effectTimes: timeline.scenes.slice(1).map((scene) => scene.from / plan.fps)});
  const report = validateProbe(await probe(candidate), config.duration);
  // Decode every frame and audio packet as well as inspecting metadata.
  await run('ffmpeg', ['-v', 'error', '-xerror', '-i', candidate, '-f', 'null', '-']);
  await writeFile(resolve(out, 'validation.json'), JSON.stringify({...report, decoded: true}, null, 2));
  await rename(candidate, resolve(out, 'video.mp4'));
  console.log('Listo: out/video.mp4. MP4 validado con ffprobe y decodificación FFmpeg.');
}

try {
  await main();
} catch (error) {
  // Never dump request objects, stack traces, environment or raw provider responses.
  const secret = process.env.ELEVENLABS_API_KEY;
  const message = error instanceof Error ? error.message : 'Error desconocido.';
  console.error(`Generación fallida: ${secret ? message.split(secret).join('[REDACTED]') : message}`);
  process.exitCode = 1;
} finally {
  await rm(temp, {recursive: true, force: true}).catch(() => {});
}
