import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../scripts/lib/config.mjs';
import {createPlan, demoAlignment, buildTimeline, toSrt} from '../scripts/lib/plan.mjs';
import {validateProbe, tempoFilters} from '../scripts/lib/media.mjs';

test('demo funciona sin clave; producción exige el secreto y no lo incluye en errores', () => {
  assert.equal(readConfig({}).demo, true);
  assert.throws(() => readConfig({VIDEO_DEMO: 'false'}), /Falta ELEVENLABS_API_KEY/);
  const config = readConfig({VIDEO_DEMO: 'false', ELEVENLABS_API_KEY: 'clave-prueba'});
  assert.equal(config.demo, false);
  assert.ok(!JSON.stringify(config).includes('clave-prueba'));
});

test('rechaza duraciones y booleanos ambiguos antes de gastar créditos', () => {
  for (const duration of ['9', '61', '15.5', 'NaN', '15;echo x', '-5']) {
    assert.throws(() => readConfig({VIDEO_DURATION: duration}), /duración/i);
  }
  assert.throws(() => readConfig({VIDEO_DEMO: 'FALSE'}), /true o false/);
  assert.throws(() => readConfig({VIDEO_SFX: '1'}), /true o false/);
  assert.throws(() => readConfig({VIDEO_THEME: '\n'}), /tema/);
  assert.throws(() => readConfig({VIDEO_THEME: 'x'.repeat(121)}), /tema/);
});

test('el tema se trata como texto, incluidos símbolos de shell y Unicode', () => {
  const theme = 'La idea $(touch no-ejecutar) y un robot 🤖';
  const config = readConfig({VIDEO_THEME: theme});
  assert.equal(config.theme, theme);
  const plan = createPlan(theme, 10);
  const timeline = buildTimeline(plan, demoAlignment(plan.text, 10));
  assert.ok(timeline.captions.map((c) => c.text).join(' ').includes(theme));
});

test('todos los tamaños de video tienen escenas continuas y subtítulos en rango', () => {
  for (const duration of [10, 15, 30, 45, 60]) {
    const plan = createPlan('Una idea pequeña', duration);
    const timeline = buildTimeline(plan, demoAlignment(plan.text, duration));
    assert.equal(timeline.format, 'historia', 'el formato previo no debe heredar los valores del acertijo en Studio');
    let frame = 0;
    for (const scene of timeline.scenes) {
      assert.equal(scene.from, frame);
      assert.ok(scene.durationInFrames > 0);
      frame += scene.durationInFrames;
    }
    assert.equal(frame, duration * 30);
    assert.ok(timeline.captions.length > 0);
    for (const caption of timeline.captions) {
      assert.ok(caption.startFrame >= 0);
      assert.ok(caption.endFrame > caption.startFrame);
      assert.ok(caption.endFrame <= frame);
    }
    const spoken = timeline.captions.map((c) => c.text).join(' ');
    assert.equal(spoken, plan.text);
    assert.match(toSrt(timeline.captions), /^1\n00:00:00,200 -->/);
  }
});

test('la alineación se reajusta al cambiar velocidad; rechaza texto distinto', () => {
  const plan = createPlan('La prueba', 15);
  const alignment = demoAlignment(plan.text, 30);
  const timeline = buildTimeline(plan, alignment, 2);
  assert.equal(timeline.captions[0].startFrame, 3);
  const modified = {...alignment, characters: ['x', ...alignment.characters]};
  assert.throws(() => buildTimeline(plan, modified), /no coincide/);
});

const validMedia = () => ({
  streams: [
    {codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', avg_frame_rate: '30/1'},
    {codec_type: 'audio', codec_name: 'aac', duration: '15.000'}
  ],
  format: {format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '15.000', size: '1200000'}
});

test('ffprobe debe confirmar perfil iPhone/TikTok y audio de duración completa', () => {
  assert.equal(validateProbe(validMedia(), 15).ok, true);
  for (const mutate of [
    (data) => {data.streams[0].width = 720;},
    (data) => {data.streams[0].codec_name = 'vp9';},
    (data) => {data.streams[0].avg_frame_rate = '0/0';},
    (data) => {data.streams[0].pix_fmt = 'yuv444p';},
    (data) => {data.streams.pop();},
    (data) => {data.streams[1].duration = '1';},
    (data) => {data.format.duration = '16';}
  ]) {
    const data = validMedia(); mutate(data);
    assert.throws(() => validateProbe(data, 15), /MP4 inválido/);
  }
});

test('factores de tempo válidos incluso fuera del rango de un solo filtro', () => {
  assert.equal(tempoFilters(4), 'atempo=2,atempo=2.00000000');
  assert.equal(tempoFilters(0.25), 'atempo=0.5,atempo=0.50000000');
  assert.throws(() => tempoFilters(0), /inválida/);
});
