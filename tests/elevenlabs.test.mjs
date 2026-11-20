import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateNarration, generateSoundEffect, validateAlignment, DEFAULT_VOICE_ID} from '../scripts/lib/elevenlabs.mjs';

const mp3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
const alignment = {characters: ['H', 'o', 'l', 'a'], character_start_times_seconds: [0, 0.1, 0.2, 0.3], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4]};
const payload = () => ({audio_base64: mp3.toString('base64'), alignment});
const validResponse = (body = payload()) => ({ok: true, json: async () => body});
const secret = 'NEVER-LOG-THIS-API-KEY';

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'elevenlabs-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return join(directory, 'nested', 'voice.mp3');
}

test('narration writes MP3 and returns original-text timing with a consistent male voice', async (t) => {
  const outputPath = await temporary(t);
  let calls = 0;
  const actual = await generateNarration({text: 'Hola', outputPath, apiKey: secret, fetchImpl: async (url, options) => {
    calls++;
    assert.match(url, new RegExp(`/text-to-speech/${DEFAULT_VOICE_ID}/with-timestamps`));
    assert.match(url, /output_format=mp3_44100_128/);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['xi-api-key'], secret);
    assert.ok(options.signal instanceof AbortSignal);
    const body = JSON.parse(options.body);
    assert.equal(body.model_id, 'eleven_multilingual_v2');
    assert.equal(body.seed, 42);
    assert.equal(body.voice_settings.stability, 0.65);
    return validResponse();
  }});
  assert.equal(calls, 1);
  assert.deepEqual(actual, alignment);
  assert.deepEqual(await readFile(outputPath), mp3);
});

test('missing secret and malformed voice fail before any API request', async (t) => {
  const outputPath = await temporary(t);
  let calls = 0;
  const fetchImpl = async () => { calls++; return validResponse(); };
  await assert.rejects(generateNarration({text: 'Hola', outputPath, fetchImpl}), /ELEVENLABS_API_KEY/);
  await assert.rejects(generateNarration({text: 'Hola', outputPath, apiKey: secret, voiceId: '../invalid', fetchImpl}), /identificador/);
  await assert.rejects(generateSoundEffect({outputPath, fetchImpl}), /ELEVENLABS_API_KEY/);
  assert.equal(calls, 0);
});

for (const status of [400, 401, 402, 403, 404, 422, 429, 503]) {
  test(`HTTP ${status} is sanitized and never retried`, async (t) => {
    const outputPath = await temporary(t);
    let calls = 0;
    await assert.rejects(generateNarration({text: 'Hola', outputPath, apiKey: secret, fetchImpl: async () => {
      calls++;
      return {ok: false, status, text: async () => { throw new Error(secret); }};
    }}), (error) => error.message.includes(String(status)) && !error.message.includes(secret));
    assert.equal(calls, 1);
    await assert.rejects(access(outputPath));
  });
}

test('network and timeout errors never expose upstream messages or credentials', async (t) => {
  const outputPath = await temporary(t);
  for (const name of ['TypeError', 'TimeoutError', 'AbortError']) {
    let calls = 0;
    await assert.rejects(generateNarration({text: 'Hola', outputPath, apiKey: secret, fetchImpl: async () => {
      calls++;
      const error = new Error(secret);
      error.name = name;
      throw error;
    }}), (error) => !error.message.includes(secret) && /ElevenLabs/.test(error.message));
    assert.equal(calls, 1);
  }
});

test('malformed audio and alignment cannot create a misleading audio artifact', async (t) => {
  const outputPath = await temporary(t);
  for (const body of [
    {...payload(), audio_base64: '!not-base64!'},
    {...payload(), audio_base64: 'SGVsbG8='},
    {...payload(), audio_base64: ''},
    {...payload(), alignment: null},
    {...payload(), alignment: {...alignment, character_end_times_seconds: [0.2]}},
  ]) {
    await assert.rejects(generateNarration({text: 'Hola', outputPath, apiKey: secret, fetchImpl: async () => validResponse(body)}));
    await assert.rejects(access(outputPath));
  }
});

test('JSON parse errors are sanitized', async (t) => {
  const outputPath = await temporary(t);
  await assert.rejects(generateNarration({text: 'Hola', outputPath, apiKey: secret, fetchImpl: async () => ({ok: true, json: async () => {throw new Error(secret);}})}), (error) => /JSON/.test(error.message) && !error.message.includes(secret));
});

test('alignment rejects non-monotonic, infinite, empty and zero-duration data', () => {
  for (const invalid of [
    {...alignment, character_start_times_seconds: [0, 0.2, 0.1, 0.3]},
    {...alignment, character_end_times_seconds: [0.1, 0.2, Infinity, 0.4]},
    {...alignment, characters: []},
    {...alignment, character_start_times_seconds: [0, 0, 0, 0], character_end_times_seconds: [0, 0, 0, 0]},
  ]) assert.throws(() => validateAlignment(invalid));
});

test('optional SFX uses one request and validates binary audio', async (t) => {
  const outputPath = await temporary(t);
  let calls = 0;
  const result = await generateSoundEffect({outputPath, apiKey: secret, fetchImpl: async (url, options) => {
    calls++;
    assert.match(url, /sound-generation/);
    assert.equal(JSON.parse(options.body).duration_seconds, 1);
    return {ok: true, arrayBuffer: async () => mp3};
  }});
  assert.equal(result, outputPath);
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(outputPath), mp3);
});
