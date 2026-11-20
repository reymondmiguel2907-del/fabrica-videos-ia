import {mkdir, rm, writeFile, rename} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, selectComposition, renderMedia, renderStill} from '@remotion/renderer';
import {readConfig} from './lib/config.mjs';
import {createPlan, demoPlanAlignment, buildTimeline, toSrt} from './lib/plan.mjs';
import {prepareTimedNarration} from './lib/timed-audio.mjs';
import {generateNarration, generateSoundEffect} from './lib/elevenlabs.mjs';
import {generateDemoNarration, generateDemoPlanNarration} from './lib/demo-voice.mjs';
import {createPromptPlan, demoPromptPlan} from './lib/prompt-plan.mjs';
import {createSceneClips} from './lib/scene-clips.mjs';
import {run, probe, analyzeAudio, validateProbe, createDemoAudio, prepareNarration, finishVideo} from './lib/media.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'out');
const temp = resolve(root, '.cache', 'generation');

async function main() {
  const config = readConfig();
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  if (config.demo) await run('espeak-ng', ['--version']);
  // Clean previous deliverables before starting: failed runs never publish stale MP4s.
  await rm(out, {recursive: true, force: true});
  await rm(temp, {recursive: true, force: true});
  await mkdir(out, {recursive: true});
  await mkdir(temp, {recursive: true});
  const publicDir = resolve(temp, 'public');
  await mkdir(publicDir, {recursive: true});
  let plan = config.format === 'prompt-ia'
    ? demoPromptPlan(config.prompt, config.duration)
    : createPlan(config.theme, config.duration, config.format);
  // Fail browser/bundling prerequisites before any potentially billable request.
  console.log('Preparando navegador y escenas Remotion…');
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  if (!browserExecutable) await ensureBrowser();
  const serveUrl = await bundle({entryPoint: resolve(root, 'src/index.ts'), outDir: resolve(temp, 'bundle'),
    publicDir, symlinkPublicDir: true});
  const previewProps = {...buildTimeline(plan, demoPlanAlignment(plan)), demo: config.demo};
  await selectComposition({serveUrl, id: 'VideoVertical', inputProps: previewProps, browserExecutable});
  const audio = resolve(temp, 'audio.wav');
  const referenceImage = resolve(publicDir, 'reference.png');
  if (config.format === 'prompt-ia' && !config.demo) {
    const reference = await selectComposition({serveUrl, id: 'CharacterReference', browserExecutable});
    await renderStill({composition: reference, serveUrl, output: referenceImage,
      imageFormat: 'png', frame: 30, browserExecutable});
    console.log('Planificando escenas originales a partir del prompt…');
    plan = await createPromptPlan({prompt: config.prompt, duration: config.duration,
      apiKey: process.env.GEMINI_API_KEY, model: config.textModel});
  }
  await writeFile(resolve(out, 'plan.json'), JSON.stringify({...plan, previewOnly: config.demo && config.format === 'prompt-ia'}, null, 2));
  let alignment;
  let speed = 1;
  let segments;
  let effect;
  console.log(`Preparando ${config.duration}s. Modo ${config.demo ? 'DEMO: sin llamadas API' : 'ElevenLabs: narración de pago'}.`);
  if (config.demo) {
    console.log('Voz robótica española local. El modo demo no genera escenas con IA.');
    if (plan.timing === 'fixed') {
      ({alignment, segments} = await generateDemoPlanNarration({plan, outputPath: audio}));
    } else {
      const source = resolve(temp, 'demo-voice.wav');
      alignment = await generateDemoNarration({text: plan.text, outputPath: source});
      const measured = Number((await probe(source)).format?.duration);
      speed = measured / (config.duration - 0.4);
      await prepareNarration(source, audio, speed, config.duration);
    }
    if (config.sfx) {
      effect = resolve(temp, 'effect.wav');
      await createDemoAudio(effect, 1, true);
    }
  } else {
    const source = resolve(temp, 'narration.mp3');
    alignment = await generateNarration({text: plan.text, outputPath: source,
      apiKey: process.env.ELEVENLABS_API_KEY, voiceId: config.voiceId});
    const measured = Number((await probe(source)).format?.duration);
    if (!Number.isFinite(measured) || measured <= 0) throw new Error('ElevenLabs devolvió un audio sin duración válida.');
    if (plan.timing === 'fixed') {
      ({segments} = await prepareTimedNarration({plan, alignment, source, output: audio}));
    } else {
      speed = measured / (config.duration - 0.4);
      if (speed < 0.55 || speed > 1.8) {
        throw new Error('La voz no cabe con ritmo natural. Acorta el tema o cambia la duración. No se harán reintentos de pago.');
      }
      await prepareNarration(source, audio, speed, config.duration);
    }
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
  if ((await analyzeAudio(audio)).silent) throw new Error('La narración es silenciosa o inaudible. No se publicará un video sin voz.');
  if (config.format === 'prompt-ia' && !config.demo) {
    plan = await createSceneClips({plan, referenceImage, publicDir, outDir: out,
      apiKey: process.env.GEMINI_API_KEY, model: config.videoModel, narrationPath: audio});
    await writeFile(resolve(out, 'plan.json'), JSON.stringify(plan, null, 2));
  }
  const timeline = {...buildTimeline(plan, alignment, speed, segments), demo: config.demo};
  await writeFile(resolve(out, 'storyboard.json'), JSON.stringify({
    ...timeline, narration: plan.text, durationSeconds: config.duration,
    audioMode: config.demo ? 'espeak-ng-demo-voice' : 'elevenlabs',
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
  const transitions = timeline.scenes.slice(1).map((scene) => scene.from / plan.fps);
  await finishVideo({video: silent, audio, effect, output: candidate, duration: config.duration,
    effectTimes: transitions.length ? transitions : [0.3]});
  const report = validateProbe(await probe(candidate), config.duration);
  const volume = await analyzeAudio(candidate);
  if (volume.silent) throw new Error('El MP4 final tiene audio inaudible. Revisa la mezcla antes de volver a generar.');
  // Decode every frame and audio packet as well as inspecting metadata.
  await run('ffmpeg', ['-v', 'error', '-xerror', '-i', candidate, '-f', 'null', '-']);
  await writeFile(resolve(out, 'validation.json'), JSON.stringify({...report, volume, decoded: true}, null, 2));
  await rename(candidate, resolve(out, 'video.mp4'));
  console.log('Listo: out/video.mp4. MP4 validado con ffprobe y decodificación FFmpeg.');
}

try {
  await main();
} catch (error) {
  // Never dump request objects, stack traces, environment or raw provider responses.
  let message = error instanceof Error ? error.message : 'Error desconocido.';
  for (const secret of [process.env.ELEVENLABS_API_KEY, process.env.GEMINI_API_KEY]) {
    if (secret) message = message.split(secret).join('[REDACTED]');
  }
  console.error(`Generación fallida: ${message}`);
  process.exitCode = 1;
} finally {
  await rm(temp, {recursive: true, force: true}).catch(() => {});
}
