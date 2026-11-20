import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, access, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateSceneClip, DEFAULT_VIDEO_MODEL} from '../scripts/lib/google-video.mjs';

const secret = 'GOOGLE-SECRET-DO-NOT-ECHO';
const token = 'SIGNED-DOWNLOAD-TOKEN-DO-NOT-ECHO';
const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');
const id = 'v1_scene_123';
const json = (value) => ({ok: true, status: 200, json: async () => value});
const clip = (content = {type: 'video', mime_type: 'video/mp4', data: mp4.toString('base64')}) =>
  ({id, status: 'completed', steps: [{type: 'model_output', content: [content]}]});
const pending = () => json({id, status: 'in_progress'});
const binary = (bytes = mp4) => ({ok: true, status: 200, arrayBuffer: async () => bytes,
  headers: new Headers({'content-type': 'video/mp4', 'content-length': String(bytes.length)})});
const redirect = (location) => ({ok: false, status: 302, headers: new Headers({location})});
const input = (outputPath, extra = {}) => ({prompt: 'Un personaje original dibujado en 2D saluda.',
  duration: 5, outputPath, apiKey: secret, sleepImpl: async () => {}, ...extra});

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'google-video-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return {directory, outputPath: join(directory, 'nested', 'scene.mp4')};
}

test('one background POST requests portrait Omni clip and accepts documented REST inline output', async (t) => {
  const {outputPath} = await temporary(t);
  let calls = 0;
  const result = await generateSceneClip(input(outputPath, {fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.ok(!url.includes(secret));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-goog-api-key'], secret);
    assert.equal(options.headers['Api-Revision'], '2026-05-20');
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.model, DEFAULT_VIDEO_MODEL);
    assert.equal(body.background, true);
    assert.equal(body.input, input(outputPath).prompt);
    assert.deepEqual(body.response_format, {type: 'video', aspect_ratio: '9:16', duration: '5s', delivery: 'uri'});
    return json(clip());
  }}));
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(outputPath), mp4);
  assert.deepEqual(result, {outputPath, model: DEFAULT_VIDEO_MODEL, duration: 5, bytes: mp4.length});
});

test('local PNG reference is embedded as image content without a separate paid upload', async (t) => {
  const {directory, outputPath} = await temporary(t);
  const referenceImage = join(directory, 'mascot.png');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await writeFile(referenceImage, png);
  let calls = 0;
  await generateSceneClip(input(outputPath, {referenceImage, fetchImpl: async (_url, options) => {
    calls++;
    assert.deepEqual(JSON.parse(options.body).input,
      [{type: 'image', data: png.toString('base64'), mime_type: 'image/png'},
        {type: 'text', text: input(outputPath).prompt}]);
    return json(clip());
  }}));
  assert.equal(calls, 1);
});

test('invalid arguments or unreadable/unsupported references fail before a request', async (t) => {
  const {directory, outputPath} = await temporary(t);
  const invalidImage = join(directory, 'fake.png');
  await writeFile(invalidImage, 'not an image');
  let calls = 0;
  const base = input(outputPath, {fetchImpl: async () => {calls++; return json(clip());}});
  for (const extra of [{apiKey: ''}, {duration: 2}, {duration: 16}, {duration: 5.5},
    {prompt: ''}, {model: '../old-veo'}, {outputPath: ''}, {referenceImage: {}},
    {referenceImage: join(directory, 'missing.png')}, {referenceImage: invalidImage}]) {
    await assert.rejects(generateSceneClip({...base, ...extra}));
  }
  assert.equal(calls, 0);
});

test('polling uses GET only every ten seconds and accepts inline data from retrieval', async (t) => {
  const {outputPath} = await temporary(t);
  const methods = [], delays = [];
  await generateSceneClip(input(outputPath, {sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async (url, options) => {
      methods.push(options.method);
      if (methods.length === 1) return pending();
      assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/interactions/${id}`);
      assert.equal(options.body, undefined);
      return methods.length === 2 ? pending() : json(clip());
    }}));
  assert.deepEqual(methods, ['POST', 'GET', 'GET']);
  assert.deepEqual(delays, [10_000, 10_000]);
});

test('URI delivery waits for an ACTIVE file and downloads MP4 over authenticated GET', async (t) => {
  const {outputPath} = await temporary(t);
  const calls = [], delays = [];
  const uri = `https://generativelanguage.googleapis.com/v1beta/files/file-123:download?alt=media&key=${secret}`;
  const responses = [json(clip({type: 'video', mime_type: 'video/mp4', uri})),
    json({state: 'PROCESSING'}), json({state: 'ACTIVE'}), binary()];
  await generateSceneClip(input(outputPath, {sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      assert.ok(!url.includes(secret));
      assert.equal(options.headers['x-goog-api-key'], secret);
      return responses.shift();
    }}));
  assert.deepEqual(calls.map((call) => call.options.method), ['POST', 'GET', 'GET', 'GET']);
  assert.equal(calls[1].url, 'https://generativelanguage.googleapis.com/v1beta/files/file-123');
  assert.equal(calls[3].url, 'https://generativelanguage.googleapis.com/v1beta/files/file-123:download?alt=media');
  assert.deepEqual(delays, [10_000]);
  assert.deepEqual(await readFile(outputPath), mp4);
});

test('allowed media redirects receive no API key and keep credential query parameters out', async (t) => {
  const {outputPath} = await temporary(t);
  const responses = [json(clip({type: 'video', mime_type: 'video/mp4', uri: 'files/abc-123'})),
    json({state: 'ACTIVE'}), redirect(`https://storage.googleapis.com/video/clip.mp4?token=${token}&key=${secret}`), binary()];
  let calls = 0;
  await generateSceneClip(input(outputPath, {fetchImpl: async (url, options) => {
    calls++;
    assert.ok(!url.includes(secret));
    if (url.startsWith('https://storage.googleapis.com/')) {
      assert.equal(options.headers['x-goog-api-key'], undefined);
      assert.equal(options.headers['Api-Revision'], undefined);
      assert.ok(url.includes(token));
    }
    return responses.shift();
  }}));
  assert.equal(calls, 4);
  assert.deepEqual(await readFile(outputPath), mp4);
});

test('arbitrary, deceptive, HTTP and credentialed download hosts are rejected without fetching them', async (t) => {
  const {outputPath} = await temporary(t);
  for (const uri of ['https://attacker.example/clip.mp4',
    'https://generativelanguage.googleapis.com.attacker.example/clip.mp4',
    'https://storage.googleapis.com.attacker.example/clip.mp4',
    'http://storage.googleapis.com/clip.mp4', 'https://user:password@storage.googleapis.com/clip.mp4',
    'https://storage.googleapis.com:8443/clip.mp4', `https://attacker.example/${token}`]) {
    let calls = 0;
    await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async () => {
      calls++; return json(clip({type: 'video', mime_type: 'video/mp4', uri}));
    }})), (error) => /hosts HTTPS/.test(error.message) && !error.message.includes(token));
    assert.equal(calls, 1);
  }
  await assert.rejects(access(outputPath));
});

test('external redirect is blocked before sending any credentials to that target', async (t) => {
  const {outputPath} = await temporary(t);
  const responses = [json(clip({type: 'video', mime_type: 'video/mp4', uri: 'files/abc-123'})),
    json({state: 'ACTIVE'}), redirect(`https://attacker.example/${token}`)];
  let calls = 0;
  await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async (url) => {
    calls++;
    assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
    return responses.shift();
  }})), (error) => /hosts HTTPS/.test(error.message) && !error.message.includes(token));
  assert.equal(calls, 3);
  await assert.rejects(access(outputPath));
});

for (const status of [400, 401, 403, 404, 429, 500, 302]) {
  test(`HTTP ${status} is sanitized and never retries the paid POST`, async (t) => {
    const {outputPath} = await temporary(t);
    let calls = 0;
    await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async () => {
      calls++;
      return {ok: false, status, text: async () => {throw new Error(secret + token);}};
    }})), (error) => error.message.includes(String(status)) && !error.message.includes(secret) && !error.message.includes(token));
    assert.equal(calls, 1);
    await assert.rejects(access(outputPath));
  });
}

test('upstream network, JSON and terminal errors never expose provider messages or URLs', async (t) => {
  const {outputPath} = await temporary(t);
  const badResponses = [
    async () => {throw new Error(secret + token);},
    async () => ({ok: true, json: async () => {throw new Error(secret + token);}}),
    async () => json({...clip(), status: 'failed', error: {message: secret + token}}),
    async () => json({...clip(), status: 'requires_continuation', continuation_token: token}),
    async () => json({...clip(), status: 'cancelled'}),
  ];
  for (const fetcher of badResponses) {
    let calls = 0;
    await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async (...args) => {calls++; return fetcher(...args);}})),
      (error) => /Google/.test(error.message) && !error.message.includes(secret) && !error.message.includes(token));
    assert.equal(calls, 1);
  }
});

test('deadline bounds endless polling to fifteen minutes without another POST', async (t) => {
  const {outputPath} = await temporary(t);
  let posts = 0, gets = 0, waited = 0;
  await assert.rejects(generateSceneClip(input(outputPath, {
    sleepImpl: async (ms) => {assert.ok(ms <= 10_000); waited += ms;},
    fetchImpl: async (_url, options) => {
      if (options.method === 'POST') posts++; else gets++;
      return pending();
    },
  })), /15 minutos/);
  assert.equal(posts, 1);
  assert.equal(waited, 15 * 60_000);
  assert.ok(gets <= 89);
  await assert.rejects(access(outputPath));
});

test('elapsed wall time, including network waits, also enforces the deadline', async (t) => {
  const {outputPath} = await temporary(t);
  let clock = 0, posts = 0;
  t.mock.method(Date, 'now', () => clock);
  await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async (_url, options) => {
    if (options.method === 'POST') posts++;
    clock = 15 * 60_000 + 1;
    return pending();
  }})), /15 minutos/);
  assert.equal(posts, 1);
});

test('malformed payloads, fake MP4 and a user-input video never create an output', async (t) => {
  const {outputPath} = await temporary(t);
  const malformed = [
    {...clip(), id: '../../other'},
    {...clip(), steps: undefined},
    {...clip(), steps: [{type: 'user_input', content: [{type: 'video', mime_type: 'video/mp4', data: mp4.toString('base64')}]}]},
    clip({type: 'video', mime_type: 'text/html', data: mp4.toString('base64')}),
    clip({type: 'video', mime_type: 'video/mp4', data: 'not-base64'}),
    clip({type: 'video', mime_type: 'video/mp4', data: Buffer.from('this is not a video file').toString('base64')}),
    {...clip(), steps: [{type: 'model_output', content: [clip().steps[0].content[0], clip().steps[0].content[0]]}]},
  ];
  for (const response of malformed) {
    await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async () => json(response)})));
    await assert.rejects(access(outputPath));
  }
});

test('streamed MP4 download is bounded and saved only after validation', async (t) => {
  const {outputPath} = await temporary(t);
  const response = binary();
  response.body = (async function* () {yield mp4.subarray(0, 8); yield mp4.subarray(8);})();
  const responses = [json(clip({type: 'video', mime_type: 'video/mp4', uri: 'https://storage.googleapis.com/clip.mp4'})), response];
  await generateSceneClip(input(outputPath, {fetchImpl: async () => responses.shift()}));
  assert.deepEqual(await readFile(outputPath), mp4);
});

test('oversized content-length and interrupted media are rejected without leaking tokens', async (t) => {
  const {outputPath} = await temporary(t);
  for (const download of [
    {...binary(), headers: new Headers({'content-length': String(129 * 1024 * 1024)})},
    {...binary(), arrayBuffer: async () => {throw new Error(secret + token);}},
  ]) {
    const responses = [json(clip({type: 'video', mime_type: 'video/mp4', uri: `https://storage.googleapis.com/clip.mp4?token=${token}`})), download];
    await assert.rejects(generateSceneClip(input(outputPath, {fetchImpl: async () => responses.shift()})),
      (error) => !error.message.includes(secret) && !error.message.includes(token));
    await assert.rejects(access(outputPath));
  }
});
