export function createRiddlePlan(theme, duration) {
  if (duration !== 60) throw new Error('El acertijo del mapa requiere exactamente 60 segundos.');
  const scenes = [
    {id: 'reto', kind: 'hook', title: '¿ACEPTAS EL RETO?', startSeconds: 0, endSeconds: 5,
      narration: 'Tienes un minuto para resolver este acertijo. ¿Aceptas el reto?'},
    {id: 'acertijo', kind: 'riddle', title: '¿QUÉ SOY?', startSeconds: 5, endSeconds: 18,
      narration: 'Tengo ciudades, pero no casas. Tengo montañas, pero no árboles. Tengo agua, pero no peces. ¿Qué soy?'},
    {id: 'pista-uno', kind: 'hint', title: 'PIENSA UN POCO…', startSeconds: 18, endSeconds: 30,
      narration: 'Escucha bien: puedo mostrarte muchos lugares, aunque ninguno esté realmente dentro de mí.'},
    {id: 'pista-dos', kind: 'hint', title: 'UNA ÚLTIMA PISTA', startSeconds: 30, endSeconds: 40,
      narration: 'Aquí va una pista: puedo ayudarte a encontrar el camino cuando no sabes por dónde ir.'},
    {id: 'cuenta', kind: 'countdown', title: '¿YA TIENES TU RESPUESTA?', startSeconds: 40, endSeconds: 50,
      narration: ''},
    {id: 'respuesta', kind: 'reveal', title: '¡UN MAPA!', startSeconds: 50, endSeconds: 57,
      narration: '¡Un mapa! Representa ciudades, montañas y agua, pero no contiene sus casas, árboles ni peces.'},
    {id: 'cierre', kind: 'end', title: '¿LO ACERTASTE?', startSeconds: 57, endSeconds: 60,
      narration: '¿Lo acertaste? Escribe tu respuesta.'}
  ];
  return {theme, duration, fps: 30, width: 1080, height: 1920, format: 'acertijo-mapa',
    timing: 'fixed', scenes, text: scenes.filter((scene) => scene.narration).map((scene) => scene.narration).join(' ')};
}

export function demoRiddleAlignment(plan) {
  const characters = [], starts = [], ends = [];
  for (const scene of plan.scenes.filter((item) => item.narration)) {
    if (characters.length) {
      characters.push(' '); starts.push(ends.at(-1)); ends.push(ends.at(-1));
    }
    const chars = [...scene.narration];
    const step = (scene.endSeconds - scene.startSeconds - 0.5) / chars.length;
    chars.forEach((char, i) => {
      characters.push(char);
      starts.push(scene.startSeconds + 0.15 + i * step);
      ends.push(scene.startSeconds + 0.15 + (i + 1) * step);
    });
  }
  return {characters, character_start_times_seconds: starts, character_end_times_seconds: ends};
}

export function fixedTimeline(plan, alignment, segments) {
  const scenes = plan.scenes.map((scene) => ({...scene,
    from: Math.round(scene.startSeconds * plan.fps),
    durationInFrames: Math.round((scene.endSeconds - scene.startSeconds) * plan.fps)}));
  const captions = [];
  let offset = 0;
  for (const scene of scenes.filter((item) => item.narration)) {
    const chars = [...scene.narration];
    const segment = segments?.find((item) => item.sceneId === scene.id);
    if (segments && !segment) throw new Error('Falta un segmento de narración del acertijo.');
    const mapTime = segment
      ? (time) => scene.startSeconds + (time - segment.sourceStart) / segment.speed
      : (time) => time;
    const words = [];
    let word = '', first = 0;
    for (let i = 0; i <= chars.length; i++) {
      if (i < chars.length && !/\s/u.test(chars[i])) {
        if (!word) first = i;
        word += chars[i];
      } else if (word) {
        words.push({text: word,
          start: mapTime(alignment.character_start_times_seconds[offset + first]),
          end: mapTime(alignment.character_end_times_seconds[offset + i - 1])});
        word = '';
      }
    }
    let group = [];
    const flush = () => {
      if (!group.length) return;
      const startFrame = Math.max(scene.from, Math.round(group[0].start * plan.fps));
      const endFrame = Math.min(scene.from + scene.durationInFrames,
        Math.max(startFrame + 1, Math.round(group.at(-1).end * plan.fps)));
      if (endFrame <= startFrame) throw new Error('Un subtítulo del acertijo queda fuera de su escena.');
      captions.push({text: group.map((item) => item.text).join(' '), startFrame, endFrame});
      group = [];
    };
    for (const item of words) {
      if (group.length && (group.length >= 5 || [...group, item].map((w) => w.text).join(' ').length > 36)) flush();
      group.push(item);
    }
    flush();
    offset += chars.length + 1;
  }
  return {theme: plan.theme, format: plan.format, durationInFrames: plan.duration * plan.fps, scenes, captions};
}
