import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../scripts/lib/config.mjs';

const base = {VIDEO_FORMAT: 'prompt-ia', VIDEO_PROMPT: 'Crea un acertijo con un humano 2D.\nNo reveles la solución hasta el final.', VIDEO_DURATION: '60'};
test('el formulario acepta prompts largos con saltos de línea y demo sin claves', () => {
  const config = readConfig({...base, VIDEO_PROMPT: 'Escena de un personaje.\n'.repeat(100)});
  assert.equal(config.demo, true);
  assert.ok(config.prompt.length > 120);
  assert.equal(config.format, 'prompt-ia');
  assert.throws(() => readConfig({...base, VIDEO_PROMPT: ''}), /campo prompt/);
  assert.throws(() => readConfig({...base, VIDEO_PROMPT: 'x'.repeat(5001)}), /5000/);
  assert.throws(() => readConfig({...base, VIDEO_PROMPT: 'texto\0oculto'}), /campo prompt/);
});

test('modo real exige las dos claves antes de generar y preflight no las necesita', () => {
  const real = {...base, VIDEO_DEMO: 'false'};
  assert.equal(readConfig(real, {requireApiKey: false}).demo, false);
  assert.throws(() => readConfig(real), /ELEVENLABS_API_KEY/);
  assert.throws(() => readConfig({...real, ELEVENLABS_API_KEY: 'dummy-voice'}), /GEMINI_API_KEY/);
  const config = readConfig({...real, ELEVENLABS_API_KEY: 'dummy-voice', GEMINI_API_KEY: 'dummy-google'});
  assert.ok(!JSON.stringify(config).includes('dummy-'));
});
