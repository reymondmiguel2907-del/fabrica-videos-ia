import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSceneClips} from '../scripts/lib/scene-clips.mjs';
import {run, probe} from '../scripts/lib/media.mjs';

test('clips generados se normalizan y publican individualmente sin audio nativo', {
  skip: spawnSync('ffmpeg', ['-version']).error?.code === 'ENOENT', timeout: 120_000
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'scene-clips-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const plan = {styleBible: 'Caricatura 2D', characterBible: 'Presentador consistente', scenes: [
    {id: 'one', visualPrompt: 'Saluda.', startSeconds: 0, endSeconds: 3},
    {id: 'two', visualPrompt: 'Muestra una pista.', startSeconds: 3, endSeconds: 6}
  ]};
  const calls = [];
  const generated = await createSceneClips({plan, publicDir: join(directory, 'public'), outDir: join(directory, 'out'),
    referenceImage: '/reference.png', apiKey: 'dummy-key', model: 'dummy-model',
    generateImpl: async (request) => {
      calls.push(request);
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
        'color=c=blue:s=320x568:r=24:d=3', '-f', 'lavfi', '-i', 'sine=frequency=400:duration=3',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', request.outputPath]);
    }});
  assert.equal(calls.length, 2);
  assert.equal(calls[0].referenceImage, '/reference.png');
  assert.equal(generated.scenes[1].mediaSrc, 'clips/escena-02.mp4');
  assert.deepEqual(await readdir(join(directory, 'out', 'clips')), ['escena-01.mp4', 'escena-02.mp4']);
  const metadata = await probe(join(directory, 'out', 'clips', 'escena-01.mp4'));
  assert.equal(metadata.streams.length, 1, 'native voice is removed before mixing one consistent narrator');
  assert.equal(metadata.streams[0].width, 1080);
  assert.equal(metadata.streams[0].height, 1920);
  assert.equal(metadata.streams[0].avg_frame_rate, '30/1');
});
