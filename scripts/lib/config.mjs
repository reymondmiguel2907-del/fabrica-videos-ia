function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} debe ser true o false.`);
  return value === 'true';
}

export function readConfig(env = process.env, {requireApiKey = true} = {}) {
  const theme = (env.VIDEO_THEME ?? 'Una idea pequeña cambia el día').trim();
  if (!theme || [...theme].length > 120 || /[\p{Cc}\p{Cf}]/u.test(theme)) {
    throw new Error('En tema escribe solo un título corto de 1 a 120 caracteres, en una línea; por ejemplo: Acertijo del mapa. Elige formato=acertijo-mapa y duración=60 para el guion integrado. Las instrucciones largas se envían a Codex.');
  }
  const rawDuration = env.VIDEO_DURATION ?? '15';
  if (!/^\d+$/.test(rawDuration)) throw new Error('La duración debe ser un entero entre 10 y 60 segundos.');
  const duration = Number(rawDuration);
  if (duration < 10 || duration > 60) throw new Error('La duración debe estar entre 10 y 60 segundos.');
  const format = env.VIDEO_FORMAT || 'historia';
  if (!['historia', 'acertijo-mapa'].includes(format)) throw new Error('El formato debe ser historia o acertijo-mapa.');
  if (format === 'acertijo-mapa' && duration !== 60) throw new Error('El formato acertijo-mapa requiere duración=60 segundos.');
  const demo = boolean(env.VIDEO_DEMO, true, 'VIDEO_DEMO');
  const sfx = boolean(env.VIDEO_SFX, false, 'VIDEO_SFX');
  const voiceId = env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  if (!/^[a-zA-Z0-9_-]{10,80}$/.test(voiceId)) throw new Error('ELEVENLABS_VOICE_ID no es válido.');
  if (requireApiKey && !demo && !env.ELEVENLABS_API_KEY?.trim()) {
    throw new Error('Falta ELEVENLABS_API_KEY. Configura el secreto en GitHub Actions o activa demo.');
  }
  return {theme, duration, format, demo, sfx, voiceId};
}
