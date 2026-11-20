import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareTimedNarration} from '../scripts/lib/timed-audio.mjs';
import {run, probe} from '../scripts/lib/media.mjs';

const ffmpegMissing = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).error?.code === 'ENOENT';
const testOptions = {skip: ffmpegMissing ? 'FFmpeg no está instalado.' : false, timeout: 120_000};

function fixture(durations = [4.5, 1, 1, 1, 1, 1]) {
  const boundaries = [0, 4, 12, 20, 30, 40, 50, 60];
  const narrations = ['Uno.', 'Dos.', 'Tres.', 'Cuatro.', 'Cinco.', '', 'Final.'];
  const scenes = narrations.map((narration, index) => ({
    id: `scene-${index}`, narration, startSeconds: boundaries[index], endSeconds: boundaries[index + 1],
  }));
  const plan = {duration: 60, scenes, text: narrations.filter(Boolean).join(' ')};
  const alignment = {characters: [], character_start_times_seconds: [], character_end_times_seconds: []};
  let cursor = 0.2;
  let spoken = 0;
  for (const scene of scenes.filter((item) => item.narration)) {
    if (spoken) {
      alignment.characters.push(' ');
      alignment.character_start_times_seconds.push(cursor);
      alignment.character_end_times_seconds.push(cursor + 0.1);
      cursor += 0.1;
    }
    const chars = [...scene.narration];
    const duration = durations[spoken++];
    chars.forEach((char, index) => {
      alignment.characters.push(char);
      alignment.character_start_times_seconds.push(cursor + index / chars.length * duration);
      alignment.character_end_times_seconds.push(cursor + (index + 1) / chars.length * duration);
    });
    cursor += duration;
  }
  return {plan, alignment};
}

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'timed-audio-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

test('fixed 60s narration keeps natural speech, maps six ranges and leaves countdown 40–50 silent', testOptions, async (t) => {
  const directory = await temporary(t);
  const source = join(directory, 'source.wav');
  const output = join(directory, 'fixed.wav');
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', 'sine=frequency=440:sample_rate=44100:duration=20', '-c:a', 'pcm_s16le', source]);
  const {plan, alignment} = fixture();
  const {segments} = await prepareTimedNarration({plan, alignment, source, output});
  assert.equal(segments.length, 6);
  assert.equal(segments[0].startCharacter, 0);
  assert.equal(segments[0].endCharacter, 4);
  assert.equal(segments[0].sourceStart, 0.2);
  assert.ok(Math.abs(segments[0].speed - 4.5 / 3.8) < 1e-9);
  assert.equal(segments[1].startCharacter, 5, 'space separator is excluded from both scene ranges');
  assert.equal(segments[1].speed, 1, 'short narration is never slowed down to fill a scene');
  for (const segment of segments) {
    const scene = plan.scenes.find((item) => item.id === segment.sceneId);
    assert.equal(alignment.characters.slice(segment.startCharacter, segment.endCharacter).join(''), scene.narration);
    assert.ok(segment.speed >= 1 && segment.speed <= 1.8);
  }
  assert.equal(segments.some((segment) => segment.sceneId === 'scene-5'), false);
  const metadata = await probe(output);
  assert.ok(Math.abs(Number(metadata.format.duration) - 60) < 0.001);
  assert.equal(metadata.streams[0].codec_name, 'pcm_s16le');
  assert.equal(metadata.streams[0].sample_rate, '44100');

  async function pcm(from, duration) {
    const {stdout} = await run('ffmpeg', ['-v', 'error', '-ss', String(from), '-t', String(duration),
      '-i', output, '-ac', '1', '-ar', '44100', '-f', 's16le', '-'], {encoding: 'buffer'});
    return stdout;
  }
  const countdown = await pcm(40, 10);
  assert.equal(countdown.length, 10 * 44100 * 2);
  assert.ok(countdown.every((byte) => byte === 0), 'the entire countdown must contain digital silence');
  assert.ok((await pcm(0, 1)).some((byte) => byte !== 0), 'opening narration is audible');
  assert.ok((await pcm(50, 0.8)).some((byte) => byte !== 0), 'closing narration starts after countdown');
  assert.ok((await pcm(7, 1)).every((byte) => byte === 0), 'short scene speech is followed by padding, not slowed speech');

  const tooFast = fixture([8, 1, 1, 1, 1, 1]);
  const failedOutput = join(directory, 'too-fast.wav');
  await assert.rejects(prepareTimedNarration({...tooFast, source, output: failedOutput}), /no cabe con voz natural/);
  await assert.rejects(access(failedOutput));
  const outOfBounds = fixture([22, 1, 1, 1, 1, 1]);
  await assert.rejects(prepareTimedNarration({...outOfBounds, source, output: failedOutput}), /fuera de la duración/);
});

test('invalid plans and text alignment fail before reading an audio file', async () => {
  const source = '/not-needed/source.wav';
  const output = '/not-needed/result.wav';
  const valid = fixture();
  const mismatch = structuredClone(valid);
  mismatch.alignment.characters[0] = 'X';
  await assert.rejects(prepareTimedNarration({...mismatch, source, output}), /no coincide/);
  const overlapping = structuredClone(valid);
  overlapping.plan.scenes[1].startSeconds = 3;
  await assert.rejects(prepareTimedNarration({...overlapping, source, output}), /contiguos/);
  const incomplete = structuredClone(valid);
  incomplete.plan.duration = 61;
  await assert.rejects(prepareTimedNarration({...incomplete, source, output}), /duración completa/);
  const malformed = structuredClone(valid);
  malformed.alignment.character_start_times_seconds[0] = -1;
  await assert.rejects(prepareTimedNarration({...malformed, source, output}), /marcas de tiempo/);
});
