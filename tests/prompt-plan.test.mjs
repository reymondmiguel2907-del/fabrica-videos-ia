import test from 'node:test';
import assert from 'node:assert/strict';
import {createPromptPlan, demoPromptPlan, validatePromptPlan, DEFAULT_PLANNER_MODEL,
  DEFAULT_STYLE_BIBLE, DEFAULT_CHARACTER_BIBLE} from '../scripts/lib/prompt-plan.mjs';

function fixture(duration = 15) {
  return {
    title: 'Una pregunta inesperada',
    styleBible: DEFAULT_STYLE_BIBLE,
    characterBible: DEFAULT_CHARACTER_BIBLE,
    scenes: [{kind: 'hook', title: '¿LO SABES?', durationSeconds: duration,
      narration: 'Hola, chicos. ¿Pueden resolver esta pregunta?',
      visualPrompt: 'El presentador humano saluda frente al fondo azul con una expresión curiosa y levanta una ceja.'}],
  };
}

function completed(value) {
  return {status: 'completed', steps: [
    {type: 'user_input', content: [{type: 'text', text: 'ignore this input'}]},
    {type: 'thought', content: [{type: 'thought', text: 'ignore internal reasoning'}]},
    {type: 'model_output', content: [{type: 'text', text: JSON.stringify(value)}]},
  ]};
}

test('single planning POST uses the verified Interactions schema and hides credentials from URLs and outputs', async () => {
  const requests = [];
  const prompt = 'Quiero un chico de camiseta verde.\nQue haga una pregunta y salude al final.';
  const plan = await createPromptPlan({prompt, duration: 15, apiKey: 'key-private-fixture', fetchImpl: async (url, options) => {
    requests.push({url, options});
    return {ok: true, json: async () => completed(fixture())};
  }});
  assert.equal(requests.length, 1);
  const {url, options} = requests[0];
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers['x-goog-api-key'], 'key-private-fixture');
  assert.equal(options.headers['Api-Revision'], '2026-05-20');
  assert.ok(options.signal instanceof AbortSignal);
  const body = JSON.parse(options.body);
  assert.equal(body.model, DEFAULT_PLANNER_MODEL);
  assert.equal(body.store, false);
  assert.equal(body.response_format.type, 'text');
  assert.equal(body.response_format.mime_type, 'application/json');
  assert.ok(body.response_format.schema.properties.scenes);
  assert.ok(body.input.includes(prompt));
  assert.ok(body.input.includes('EXACTAMENTE 15 segundos'));
  assert.ok(body.input.includes('sin letras') || body.input.includes('No pidas texto'));
  assert.equal(plan.format, 'prompt-ia');
  assert.equal(plan.timing, 'fixed');
  assert.equal(plan.prompt, prompt);
  assert.equal(plan.duration, 15);
  assert.equal(plan.scenes[0].id, 'scene-01');
  assert.deepEqual([plan.scenes[0].startSeconds, plan.scenes[0].endSeconds], [0, 15]);
  assert.equal(plan.text, fixture().scenes[0].narration);
  assert.ok(!JSON.stringify(plan).includes('key-private-fixture'));
});

test('a long multiline prompt is accepted as creative data without execution or a 120 character limit', async () => {
  const prompt = 'Describe una escena.\n$(touch nunca-ejecutar) `whoami` 🤖 '.repeat(50).slice(0, 4990);
  const plan = await createPromptPlan({prompt, duration: 15, apiKey: 'private-key', fetchImpl: async () => ({ok: true, json: async () => completed(fixture())})});
  assert.equal(plan.prompt, prompt.trim());
  assert.ok(plan.prompt.length > 120);
});

test('generated scene durations and spoken word budgets are validated before generating clips', () => {
  const valid = fixture(5);
  valid.scenes.push({kind: 'reveal', title: 'LA RESPUESTA', durationSeconds: 10, narration: 'Aquí está la solución.', visualPrompt: 'El chico muestra la solución y sonríe.'});
  const plan = validatePromptPlan(valid, {prompt: 'Un acertijo.', duration: 15});
  assert.deepEqual(plan.scenes.map((scene) => [scene.startSeconds, scene.endSeconds]), [[0, 5], [5, 15]]);
  assert.equal(plan.text, 'Hola, chicos. ¿Pueden resolver esta pregunta? Aquí está la solución.');
  const malformed = [
    {...fixture(), scenes: []},
    {...fixture(), scenes: Array.from({length: 13}, () => fixture().scenes[0])},
    {...fixture(), scenes: [{...fixture().scenes[0], durationSeconds: 16}]},
    {...fixture(), scenes: [{...fixture().scenes[0], durationSeconds: 2}]},
    {...fixture(), scenes: [{...fixture().scenes[0], durationSeconds: 14.5}]},
    {...fixture(), scenes: [{...fixture().scenes[0], durationSeconds: 10}]},
    {...fixture(), scenes: [{...fixture().scenes[0], kind: 'run-shell'}]},
    {...fixture(), scenes: [{...fixture().scenes[0], narration: 'palabra '.repeat(47)}]},
    {...fixture(), scenes: [{...fixture().scenes[0], narration: ''}]},
    {...fixture(), characterBible: ''},
    {...fixture(), scenes: [{...fixture().scenes[0], visualPrompt: 'x'.repeat(2501)}]},
    {...fixture(), title: 'Texto\u0000inválido'},
  ];
  for (const value of malformed) assert.throws(() => validatePromptPlan(value, {prompt: 'Plan de prueba', duration: 15}));
});

test('offline previews cover every allowed duration and identify themselves as previews without interpreting the prompt', () => {
  const prompt = 'Un dragón azul vuela sobre Marte y resuelve un acertijo.';
  for (let duration = 10; duration <= 60; duration++) {
    const plan = demoPromptPlan(prompt, duration);
    assert.equal(plan.duration, duration);
    assert.equal(plan.demo, true);
    assert.equal(plan.planningMode, 'offline-preview');
    assert.match(plan.title, /DEMO/);
    assert.match(plan.text, /vista previa/);
    assert.equal(plan.prompt, prompt);
    let until = 0;
    for (const scene of plan.scenes) {
      assert.equal(scene.startSeconds, until);
      assert.ok(scene.endSeconds - scene.startSeconds >= 3);
      assert.ok(scene.endSeconds - scene.startSeconds <= 15);
      assert.doesNotMatch(scene.narration, /dragón|Marte/);
      until = scene.endSeconds;
    }
    assert.equal(until, duration);
  }
});

test('missing credentials and invalid inputs fail without making a request', async () => {
  let calls = 0;
  const fetchImpl = async () => {calls++; throw new Error('not reached');};
  for (const invalid of [
    {prompt: '', duration: 15, apiKey: 'key'},
    {prompt: 'x'.repeat(5001), duration: 15, apiKey: 'key'},
    {prompt: 'contenido\u0000oculto', duration: 15, apiKey: 'key'},
    {prompt: 'Un acertijo', duration: 9, apiKey: 'key'},
    {prompt: 'Un acertijo', duration: 61, apiKey: 'key'},
    {prompt: 'Un acertijo', duration: 15.5, apiKey: 'key'},
    {prompt: 'Un acertijo', duration: 15, apiKey: ''},
    {prompt: 'Un acertijo', duration: 15, apiKey: 'key', model: 'bad/model?key=x'},
  ]) await assert.rejects(createPromptPlan({...invalid, fetchImpl}));
  assert.equal(calls, 0);
});

test('HTTP, timeout, parse and raw provider failures never expose secrets or retry paid requests', async () => {
  const secret = 'private-credential-fixture';
  for (const status of [400, 401, 403, 404, 429, 500]) {
    let calls = 0;
    await assert.rejects(createPromptPlan({prompt: 'Un acertijo.', duration: 15, apiKey: secret, fetchImpl: async () => {
      calls++; return {ok: false, status, json: async () => {throw new Error(secret);}};
    }}), (error) => {assert.match(error.message, /HTTP/); assert.ok(!error.message.includes(secret)); return true;});
    assert.equal(calls, 1);
  }
  for (const fetchImpl of [
    async () => {throw new Error(`network ${secret}`);},
    async () => ({ok: true, json: async () => {throw new Error(`JSON ${secret}`);}}),
    async () => ({ok: true, json: async () => ({status: 'failed', error: {message: secret}})}),
    async () => ({ok: true, json: async () => ({status: 'completed', steps: [{type: 'model_output', content: [{type: 'text', text: `not JSON ${secret}`}]}]})}),
    async () => ({ok: true, json: async () => ({status: 'completed', steps: [{type: 'model_output', content: [{type: 'text', text: 'not JSON'}]}]})}),
  ]) {
    await assert.rejects(createPromptPlan({prompt: 'Un acertijo.', duration: 15, apiKey: secret, fetchImpl}), (error) => {
      assert.ok(!error.message.includes(secret)); return true;
    });
  }
});
