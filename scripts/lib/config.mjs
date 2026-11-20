function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} debe ser true o false.`);
  return value === 'true';
}

export function readConfig(env = process.env) {
  const theme = (env.VIDEO_THEME ?? 'Una idea pequeña cambia el día').trim();
  if (!theme || [...theme].length > 120 || /[\p{Cc}\p{Cf}]/u.test(theme)) {
    throw new Error('El tema debe contener de 1 a 120 caracteres, sin saltos de línea ni caracteres de control.');
  }
  const rawDuration = env.VIDEO_DURATION ?? '15';
  if (!/^\d+$/.test(rawDuration)) throw new Error('La duración debe ser un entero entre 10 y 60 segundos.');
  const duration = Number(rawDuration);
  if (duration < 10 || duration > 60) throw new Error('La duración debe estar entre 10 y 60 segundos.');
  const demo = boolean(env.VIDEO_DEMO, true, 'VIDEO_DEMO');
  const sfx = boolean(env.VIDEO_SFX, false, 'VIDEO_SFX');
  const voiceId = env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  if (!/^[a-zA-Z0-9_-]{10,80}$/.test(voiceId)) throw new Error('ELEVENLABS_VOICE_ID no es válido.');
  if (!demo && !env.ELEVENLABS_API_KEY?.trim()) {
    throw new Error('Falta ELEVENLABS_API_KEY. Configura el secreto en GitHub Actions o activa demo.');
  }
  return {theme, duration, demo, sfx, voiceId};
}
