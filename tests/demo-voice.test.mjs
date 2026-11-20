import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateDemoNarration, generateDemoPlanNarration} from '../scripts/lib/demo-voice.mjs';
import {analyzeAudio, probe, run} from '../scripts/lib/media.mjs';
import {validateAlignment} from '../scripts/lib/elevenlabs.mjs';

const missing = ['ffmpeg', 'espeak-ng'].find((program) => spawnSync(program, ['--version'], {stdio: 'ignore'}).error?.code === 'ENOENT');

test('offline Spanish robotic voice is audible, has measured approximate alignment and never calls an API', {
  skip: missing ? `${missing} no está instalado; Actions instala las dependencias.` : false,
  timeout: 30_000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-voice-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const outputPath = join(directory, 'voz.wav');
  const marker = join(directory, 'DO-NOT-CREATE');
  const text = `Hola, esta es una voz robótica de demostración. No usa créditos. $(touch ${marker})`;
  let apiCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    apiCalls++;
    throw new Error('No API request is permitted in this test.');
  });
  const alignment = await generateDemoNarration({text, outputPath});
  assert.equal(apiCalls, 0);
  assert.equal(alignment.characters.join(''), text);
  assert.equal(alignment.characters.length, [...text].length);
  assert.deepEqual(validateAlignment(alignment), alignment);
  const metadata = await probe(outputPath);
  assert.equal(metadata.streams[0].sample_rate, '44100');
  assert.equal(metadata.streams[0].codec_name, 'pcm_s16le');
  assert.equal(metadata.streams[0].channels, 1);
  const duration = Number(metadata.format.duration);
  assert.ok(duration > 1);
  assert.ok(alignment.character_end_times_seconds.at(-1) < duration);
  assert.ok(alignment.character_end_times_seconds.at(-1) > duration * 0.8);
  const volume = await analyzeAudio(outputPath);
  assert.equal(volume.silent, false);
  assert.ok(volume.meanDb > -35, 'spoken demo must be clearly audible');
  await assert.rejects(access(marker), 'shell-like narration is plain text, never a command');
});

test('invalid demo input fails before invoking local tools', async () => {
  for (const text of ['', ' ', null, 'x'.repeat(20_001), 'texto\0invalido']) {
    await assert.rejects(generateDemoNarration({text, outputPath: '/not-needed/voice.wav'}), /narración demo/);
  }
  await assert.rejects(generateDemoNarration({text: 'Hola', outputPath: ''}), /ruta de salida/);
});

test('missing espeak-ng gives an actionable offline error without paid fallback', () => {
  const moduleUrl = new URL('../scripts/lib/demo-voice.mjs', import.meta.url).href;
  const code = `
    import {generateDemoNarration} from ${JSON.stringify(moduleUrl)};
    try {
      await generateDemoNarration({text: 'Hola', outputPath: '/not-needed/voice.wav'});
      process.exitCode = 1;
    } catch (error) {
      console.log(error.message);
    }
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8', env: {...process.env, PATH: '/nonexistent-demo-voice-path'},
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /No se encontró espeak-ng/);
  assert.match(result.stdout, /apt-get install espeak-ng/);
});

test('fixed demo plan uses complete per-scene WAV boundaries and keeps the 40–50 countdown silent', {
  skip: missing ? `${missing} no está instalado; Actions instala las dependencias.` : false,
  timeout: 60_000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'demo-plan-voice-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const outputPath = join(directory, 'fixed.wav');
  const plan = {
    duration: 60,
    scenes: [
      {id: 'opening', startSeconds: 0, endSeconds: 10, narration: 'Busca el tesoro.'},
      {id: 'clue', startSeconds: 10, endSeconds: 40, narration: 'La llave está debajo del árbol.'},
      {id: 'countdown', startSeconds: 40, endSeconds: 50, narration: ''},
      {id: 'answer', startSeconds: 50, endSeconds: 60, narration: 'Esta era la solución.'},
    ],
  };
  const expected = plan.scenes.filter((scene) => scene.narration).map((scene) => scene.narration).join(' ');
  const {alignment, segments} = await generateDemoPlanNarration({plan, outputPath});
  assert.equal(alignment.characters.join(''), expected);
  assert.deepEqual(validateAlignment(alignment), alignment);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].sourceStart, 0, 'the entire opening WAV is preserved');
  for (const [index, segment] of segments.entries()) {
    assert.equal(alignment.character_start_times_seconds[segment.startCharacter], segment.sourceStart);
    assert.equal(segment.speed, 1, 'short fixed-scene voice retains its natural pace');
    if (index) {
      const previous = segments[index - 1];
      const boundary = alignment.character_end_times_seconds[previous.endCharacter - 1];
      assert.equal(segment.sourceStart, boundary, 'next speech starts at the exact previous WAV end');
      assert.equal(alignment.characters[segment.startCharacter - 1], ' ');
      assert.equal(alignment.character_start_times_seconds[segment.startCharacter - 1], boundary);
    }
  }
  assert.ok(Math.abs(Number((await probe(outputPath)).format.duration) - 60) < 0.001);
  assert.equal((await analyzeAudio(outputPath)).silent, false);
  const {stdout} = await run('ffmpeg', ['-v', 'error', '-ss', '40', '-t', '10', '-i', outputPath,
    '-ac', '1', '-ar', '44100', '-f', 's16le', '-'], {encoding: 'buffer'});
  assert.equal(stdout.length, 10 * 44_100 * 2);
  assert.ok(stdout.every((byte) => byte === 0));
});
