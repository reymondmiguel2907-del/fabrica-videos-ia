import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {run, probe, validateProbe, prepareNarration, finishVideo, createDemoAudio, analyzeAudio} from '../scripts/lib/media.mjs';

const ffmpegMissing = spawnSync('ffmpeg', ['-version'], {stdio: 'ignore'}).error?.code === 'ENOENT';

test('real FFmpeg: full-range source, retimed narration and optional delayed effects export valid iPhone MP4s', {
  skip: ffmpegMissing ? 'FFmpeg no está instalado; GitHub Actions lo instala antes de las pruebas.' : false,
  timeout: 120_000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'video-media-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const sourceVideo = join(directory, 'full-range.mp4');
  const sourceVoice = join(directory, 'source-voice.wav');
  const narration = join(directory, 'narration.wav');
  const effect = join(directory, 'effect.wav');

  // Remotion can emit full-range H.264. Preserve that condition in the fixture so
  // omitting the final TV-range conversion recreates the yuvj420p regression.
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x162737:s=1080x1920:r=30:d=1',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-threads', '2',
    '-pix_fmt', 'yuv420p', '-color_range', 'pc', sourceVideo]);
  const sourceMetadata = await probe(sourceVideo);
  const sourceStream = sourceMetadata.streams.find((stream) => stream.codec_type === 'video');
  assert.equal(sourceStream.pix_fmt, 'yuvj420p', 'fixture must exercise full-range H.264');
  assert.equal(sourceStream.color_range, 'pc');

  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=1.25',
    '-c:a', 'pcm_s16le', sourceVoice]);
  await prepareNarration(sourceVoice, narration, 1.25, 1);
  const narrationMetadata = await probe(narration);
  assert.ok(Math.abs(Number(narrationMetadata.format.duration) - 1) < 0.02);
  assert.equal(narrationMetadata.streams[0].sample_rate, '44100');

  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=1100:sample_rate=44100:duration=0.15',
    '-af', 'volume=4', '-c:a', 'pcm_s16le', effect]);

  const decoded = [];
  for (const withEffect of [false, true]) {
    const output = join(directory, withEffect ? 'with-effect.mp4' : 'without-effect.mp4');
    await finishVideo({video: sourceVideo, audio: narration,
      effect: withEffect ? effect : undefined, effectTimes: [0, 0.5],
      output, duration: 1});
    const metadata = await probe(output);
    const report = validateProbe(metadata, 1);
    assert.equal(report.ok, true);
    assert.equal(report.width, 1080);
    assert.equal(report.height, 1920);
    assert.equal(report.fps, 30);
    assert.equal(report.pixelFormat, 'yuv420p');
    assert.equal(report.videoCodec, 'h264');
    assert.equal(report.audioCodec, 'aac');
    assert.ok(report.bytes > 0);
    const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
    assert.equal(videoStream.color_range, 'tv');
    assert.equal(videoStream.color_space, 'bt709');

    // Inspecting metadata alone would miss corrupt packets or invalid filters.
    await run('ffmpeg', ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-']);
    const {stdout} = await run('ffmpeg', ['-v', 'error', '-i', output,
      '-map', '0:a:0', '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], {encoding: 'buffer'});
    assert.ok(stdout.length >= 44_100 * 4, 'the output contains a full second of decodable audio');
    decoded.push(stdout);
  }
  assert.notDeepEqual(decoded[0], decoded[1], 'enabling SFX must change the encoded soundtrack');
  const amplitude = (samples, from, until, frequency) => {
    let real = 0, imaginary = 0;
    const first = Math.round(from * 44_100);
    const last = Math.round(until * 44_100);
    for (let index = first; index < last; index++) {
      const sample = samples.readFloatLE(index * 4);
      const angle = 2 * Math.PI * frequency * index / 44_100;
      real += sample * Math.cos(angle);
      imaginary += sample * Math.sin(angle);
    }
    return 2 * Math.hypot(real, imaginary) / (last - first);
  };
  const background = Math.max(0.001, amplitude(decoded[1], 0.3, 0.4, 1100));
  assert.ok(amplitude(decoded[1], 0.05, 0.12, 1100) > background * 4,
    'first SFX is audible near the first requested transition');
  assert.ok(amplitude(decoded[1], 0.55, 0.62, 1100) > background * 4,
    'second SFX is audible near the delayed transition');
});

test('audio loudness analysis distinguishes actual silence, inaudible samples and audible demo audio', {
  skip: ffmpegMissing ? 'FFmpeg no está instalado.' : false,
  timeout: 30_000,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'audio-analysis-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const silent = join(directory, 'silence.wav');
  const quiet = join(directory, 'inaudible.wav');
  const audible = join(directory, 'audible.wav');
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=mono', '-t', '1', '-c:a', 'pcm_s16le', silent]);
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=1', '-af', 'volume=0.001', '-c:a', 'pcm_s16le', quiet]);
  await createDemoAudio(audible, 1, true);
  const silenceReport = await analyzeAudio(silent);
  const quietReport = await analyzeAudio(quiet);
  const audibleReport = await analyzeAudio(audible);
  assert.equal(silenceReport.silent, true);
  assert.equal(quietReport.silent, true);
  assert.ok(quietReport.meanDb <= -55);
  assert.equal(audibleReport.silent, false);
  assert.ok(audibleReport.meanDb > -35, 'legacy demo tones must remain audible on phones');
  for (const report of [silenceReport, quietReport, audibleReport]) {
    assert.ok(Number.isFinite(report.meanDb));
    assert.ok(Number.isFinite(report.peakDb));
    assert.ok(report.peakDb >= report.meanDb);
    assert.deepEqual(JSON.parse(JSON.stringify(report)), report, 'report must be safe as a JSON artifact');
  }
});
