function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`${name} debe ser true o false.`);
  return value === 'true';
}

export function readConfig(env = process.env, {requireApiKey = true} = {}) {
  const format = env.VIDEO_FORMAT || 'historia';
  if (!['historia', 'acertijo-mapa', 'prompt-ia'].includes(format)) throw new Error('El formato debe ser historia, acertijo-mapa o prompt-ia.');
  const theme = (env.VIDEO_THEME || (format === 'prompt-ia' ? 'Video por prompt' : 'Una idea pequeña cambia el día')).trim();
  if (!theme || [...theme].length > 120 || /[\p{Cc}\p{Cf}]/u.test(theme)) {
    throw new Error('En tema escribe solo un título corto de 1 a 120 caracteres, en una línea. Pega las instrucciones largas en el campo prompt y selecciona formato=prompt-ia.');
  }
  const prompt = (env.VIDEO_PROMPT ?? '').trim();
  if (format === 'prompt-ia' && (!prompt || [...prompt].length > 5000 || /[\p{Cc}\p{Cf}]/u.test(prompt.replace(/[\n\r\t]/g, '')))) {
    throw new Error('El campo prompt debe contener de 1 a 5000 caracteres. Puedes pegar el guion completo con saltos de línea.');
  }
  const rawDuration = env.VIDEO_DURATION ?? '15';
  if (!/^\d+$/.test(rawDuration)) throw new Error('La duración debe ser un entero entre 10 y 60 segundos.');
  const duration = Number(rawDuration);
  if (duration < 10 || duration > 60) throw new Error('La duración debe estar entre 10 y 60 segundos.');
  if (format === 'acertijo-mapa' && duration !== 60) throw new Error('El formato acertijo-mapa requiere duración=60 segundos.');
  const demo = boolean(env.VIDEO_DEMO, true, 'VIDEO_DEMO');
  const sfx = boolean(env.VIDEO_SFX, false, 'VIDEO_SFX');
  const voiceId = env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  if (!/^[a-zA-Z0-9_-]{10,80}$/.test(voiceId)) throw new Error('ELEVENLABS_VOICE_ID no es válido.');
  if (requireApiKey && !demo && !env.ELEVENLABS_API_KEY?.trim()) {
    throw new Error('Falta ELEVENLABS_API_KEY. Configura el secreto en GitHub Actions o activa demo.');
  }
  if (requireApiKey && !demo && format === 'prompt-ia' && !env.GEMINI_API_KEY?.trim()) {
    throw new Error('Falta GEMINI_API_KEY para generar escenas nuevas. Configura el secreto en Actions o activa demo para una vista previa sin IA.');
  }
  const textModel = env.GOOGLE_TEXT_MODEL || 'gemini-3.8-flash';
  const videoModel = env.GOOGLE_VIDEO_MODEL || 'gemini-omni-1.2-flash';
  if (![textModel, videoModel].every((id) => /^[A-Za-z0-9_.-]{3,100}$/.test(id))) throw new Error('El identificador del modelo de Google no es válido.');
  return {theme, prompt, duration, format, demo, sfx, voiceId, textModel, videoModel};
}
