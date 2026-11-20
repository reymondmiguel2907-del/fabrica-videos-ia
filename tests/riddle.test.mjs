import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../scripts/lib/config.mjs';
import {createPlan, demoPlanAlignment, buildTimeline, toSrt} from '../scripts/lib/plan.mjs';
import {validateAlignment} from '../scripts/lib/elevenlabs.mjs';

test('el formulario indica dónde poner instrucciones largas sin repetir su contenido', () => {
  const prompt = 'Crea un video animado de exactamente 60 segundos.\n'.repeat(10);
  assert.throws(() => readConfig({VIDEO_THEME: prompt}), (error) => {
    assert.match(error.message, /título corto/);
    assert.match(error.message, /instrucciones largas se envían a Codex/);
    assert.ok(!error.message.includes(prompt));
    return true;
  });
});

test('el preflight acepta modo real sin recibir secretos y exige duración correcta', () => {
  const env = {VIDEO_FORMAT: 'acertijo-mapa', VIDEO_THEME: 'Acertijo del mapa', VIDEO_DURATION: '60', VIDEO_DEMO: 'false'};
  assert.equal(readConfig(env, {requireApiKey: false}).format, 'acertijo-mapa');
  assert.throws(() => readConfig(env), /ELEVENLABS_API_KEY/);
  assert.throws(() => readConfig({...env, VIDEO_DURATION: '15'}), /requiere duración=60/);
  assert.throws(() => readConfig({...env, VIDEO_FORMAT: 'inexistente'}), /formato/);
});

test('el acertijo mantiene tiempos fijos, pausa y respuesta oculta hasta el segundo 50', () => {
  const plan = createPlan('Acertijo del mapa', 60, 'acertijo-mapa');
  const alignment = demoPlanAlignment(plan);
  validateAlignment(alignment);
  const timeline = buildTimeline(plan, alignment);
  assert.equal(timeline.durationInFrames, 1800);
  assert.deepEqual(timeline.scenes.map((scene) => [scene.from, scene.durationInFrames]),
    [[0, 150], [150, 390], [540, 360], [900, 300], [1200, 300], [1500, 210], [1710, 90]]);
  assert.equal(timeline.scenes.find((scene) => scene.kind === 'countdown').narration, '');
  for (const scene of timeline.scenes.filter((scene) => scene.from < 1500)) {
    assert.doesNotMatch(scene.title + ' ' + scene.narration, /mapa/i);
  }
  for (const caption of timeline.captions) {
    assert.ok(caption.endFrame > caption.startFrame);
    assert.ok(caption.startFrame >= 0 && caption.endFrame <= 1800);
    assert.ok(!(caption.startFrame < 1500 && caption.endFrame > 1200), 'sin voz/subtítulos en la cuenta regresiva');
    if (/mapa/i.test(caption.text)) assert.ok(caption.startFrame >= 1500);
  }
  assert.equal(timeline.captions.map((caption) => caption.text).join(' '), plan.text);
  assert.match(toSrt(timeline.captions), /00:00:50,/);
});

test('la narración real se remapea por escena sin adelantar la revelación', () => {
  const plan = createPlan('Acertijo del mapa', 60, 'acertijo-mapa');
  const alignment = demoPlanAlignment(plan);
  const segments = plan.scenes.filter((scene) => scene.narration).map((scene) => ({
    sceneId: scene.id, sourceStart: scene.startSeconds + 0.15, speed: 1
  }));
  const timeline = buildTimeline(plan, alignment, 1, segments);
  assert.equal(timeline.captions.find((caption) => /mapa/i.test(caption.text)).startFrame, 1500);
  assert.throws(() => buildTimeline(plan, alignment, 1, []), /Falta un segmento/);
});
