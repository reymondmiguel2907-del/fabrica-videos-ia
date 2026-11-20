import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute = promisify(execFile);

export async function run(program, args, options = {}) {
  try {
    return await execute(program, args, {timeout: 300_000, maxBuffer: 8 * 1024 * 1024, ...options});
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`No se encontró ${program}. Instala FFmpeg y ffprobe antes de generar.`);
    // No imprimir argumentos, entorno ni salida de subprocesos arbitrarios.
    throw new Error(`${program} falló (${error.killed ? 'tiempo agotado' : 'código ' + error.code}). Revisa los archivos y la instalación.`);
  }
}

export async function probe(path) {
  const {stdout} = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]);
  return JSON.parse(stdout);
}

export function validateProbe(data, expectedDuration) {
  const video = data.streams?.find((stream) => stream.codec_type === 'video');
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
  const duration = Number(data.format?.duration);
  const [num, den] = (video?.avg_frame_rate || '0/1').split('/').map(Number);
  const fps = num / den;
  const errors = [];
  if (video?.codec_name !== 'h264') errors.push('video H.264');
  if (video?.width !== 1080 || video?.height !== 1920) errors.push('resolución 1080x1920');
  if (video?.pix_fmt !== 'yuv420p') errors.push(`píxeles yuv420p (recibido: ${video?.pix_fmt ?? 'sin pista'})`);
  if (!Number.isFinite(fps) || Math.abs(fps - 30) > 0.01) errors.push('30 fps');
  if (audio?.codec_name !== 'aac') errors.push('audio AAC');
  if (!Number.isFinite(duration) || Math.abs(duration - expectedDuration) > 0.15) errors.push('duración solicitada');
  const audioDuration = Number(audio?.duration);
  if (!Number.isFinite(audioDuration) || Math.abs(audioDuration - expectedDuration) > 0.15) errors.push('duración del audio');
  if (!data.format?.format_name?.split(',').includes('mp4')) errors.push('contenedor MP4');
  if (errors.length) throw new Error(`MP4 inválido: falta o no coincide ${errors.join(', ')}.`);
  return {ok: true, width: video.width, height: video.height, fps, duration,
    videoCodec: video.codec_name, pixelFormat: video.pix_fmt, audioCodec: audio.codec_name,
    audioDuration, bytes: Number(data.format.size)};
}

export function tempoFilters(speed) {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('Velocidad de audio inválida.');
  const filters = [];
  while (speed > 2) {filters.push('atempo=2'); speed /= 2;}
  while (speed < 0.5) {filters.push('atempo=0.5'); speed /= 0.5;}
  filters.push(`atempo=${speed.toFixed(8)}`);
  return filters.join(',');
}

export async function createDemoAudio(output, duration, sfx) {
  // Audio local de demostración: pulso suave, sin TTS, servicios ni créditos.
  const filter = `sine=frequency=220:sample_rate=44100:duration=${duration}`;
  const effects = sfx ? ',tremolo=f=3:d=0.7' : '';
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', filter,
    '-af', `volume=0.035,afade=t=in:d=0.3,afade=t=out:st=${duration - 0.4}:d=0.4${effects}`,
    '-c:a', 'pcm_s16le', output]);
}

export async function prepareNarration(input, output, speed, duration) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-af', `${tempoFilters(speed)},loudnorm=I=-16:TP=-1.5:LRA=11,apad,atrim=duration=${duration}`,
    '-ar', '44100', '-c:a', 'pcm_s16le', output]);
}

export async function finishVideo({video, audio, effect, output, duration, effectTimes = [1]}) {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-i', audio];
  if (effect) args.push('-i', effect);
  if (effect) {
    const count = effectTimes.length;
    const split = `[2:a]asplit=${count}${effectTimes.map((_, i) => `[fx${i}]`).join('')}`;
    const delays = effectTimes.map((seconds, i) => `[fx${i}]volume=0.12,adelay=${Math.round(seconds * 1000)}:all=1[s${i}]`);
    const mix = `[1:a]${effectTimes.map((_, i) => `[s${i}]`).join('')}amix=inputs=${count + 1}:duration=first:normalize=0,alimiter=limit=0.95[mix]`;
    args.push('-filter_complex', [split, ...delays, mix].join(';'), '-map', '0:v:0', '-map', '[mix]');
  } else args.push('-map', '0:v:0', '-map', '1:a:0');
  args.push('-vf', 'scale=in_range=auto:out_range=tv,format=yuv420p',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', '-t', String(duration), output);
  await run('ffmpeg', args);
}
