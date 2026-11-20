import {createRiddlePlan, demoRiddleAlignment, fixedTimeline} from './riddle.mjs';

export const FPS = 30;

// Microficción deliberada: no presenta hechos inventados sobre el tema.
export function createPlan(theme, duration, format = 'historia') {
  if (format === 'acertijo-mapa') return createRiddlePlan(theme, duration);
  const long = duration >= 40;
  const medium = duration >= 20;
  const all = [
    {id: '01', kind: 'hook', title: '¿Y SI…?', narration: `Imagina esto: ${theme}.`},
    {id: '02', kind: 'problem', title: 'PARECE IMPOSIBLE', narration: long
      ? 'Nuestro pequeño protagonista tiene una idea enorme. Mira la montaña de obstáculos y piensa que no podrá avanzar. Todo parece demasiado lejos.'
      : 'Todo parece imposible. La duda crece.'},
    {id: '03', kind: 'action', title: 'UN PASO PEQUEÑO', narration: long
      ? 'Entonces cambia la pregunta. En lugar de resolverlo todo, decide mover una sola pieza. Prueba, falla y vuelve a intentarlo. Un paso pequeño enciende el siguiente.'
      : medium ? 'Pero prueba una cosa pequeña. Falla, cambia de camino y vuelve a intentarlo. Esta vez, algo se mueve.'
        : 'Un pequeño paso cambia todo.'},
    {id: '04', kind: 'twist', title: 'AHÍ ESTÁ EL GIRO', narration: long
      ? 'De pronto descubre el giro: la gran idea nunca fue un salto mágico. Eran todos esos intentos diminutos, conectados. Lo que parecía una pared empieza a convertirse en una escalera.'
      : 'El giro: el intento era la solución.'},
    {id: '05', kind: 'end', title: 'TU HISTORIA EMPIEZA', narration: long
      ? 'Respira y mira hacia atrás. El camino ya existe. Ahora te toca imaginar tu primer paso. ¿Qué intentarías hoy si bastara con empezar pequeño?'
      : medium ? 'La historia apenas empieza. ¿Cuál sería tu primer paso?'
        : 'Ahora te toca. ¿Qué intentarías?'}
  ];
  const selected = duration < 15 ? [all[0], all[2], all[4]] : all;
  const scenes = selected.map((scene) => ({...scene}));
  if (duration >= 30 && !long) {
    scenes.find((scene) => scene.kind === 'problem').narration += ' Mira el camino y duda de sus propias fuerzas.';
    scenes.find((scene) => scene.kind === 'action').narration += ' Cada intento le muestra una forma distinta de seguir adelante.';
  }
  const text = scenes.map((scene) => scene.narration).join(' ');
  return {theme, duration, fps: FPS, width: 1080, height: 1920, format: 'historia', scenes, text};
}

export function demoAlignment(text, duration) {
  const characters = [...text];
  const step = (duration - 0.6) / characters.length;
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => 0.2 + i * step),
    character_end_times_seconds: characters.map((_, i) => 0.2 + (i + 1) * step)
  };
}

export function demoPlanAlignment(plan) {
  return plan.timing === 'fixed' ? demoRiddleAlignment(plan) : demoAlignment(plan.text, plan.duration);
}

export function buildTimeline(plan, alignment, speed = 1, segments) {
  const {characters, character_start_times_seconds: starts, character_end_times_seconds: ends} = alignment;
  if (characters.join('') !== plan.text) throw new Error('La alineación de la voz no coincide con el guion.');
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('Velocidad de voz inválida.');
  if (plan.timing === 'fixed') return fixedTimeline(plan, alignment, segments);
  const totalFrames = plan.duration * FPS;
  const toFrame = (time) => Math.max(0, Math.min(totalFrames, Math.round(time / speed * FPS)));
  let offset = 0;
  const scenes = plan.scenes.map((scene, index) => {
    const from = index === 0 ? 0 : toFrame(starts[offset]);
    offset += [...scene.narration].length + 1;
    const until = index === plan.scenes.length - 1 ? totalFrames : toFrame(starts[offset]);
    if (until <= from) throw new Error('Una escena no tiene tiempo suficiente. Reduce el texto o aumenta la duración.');
    return {...scene, from, durationInFrames: until - from};
  });
  const words = [];
  let word = '', first = 0;
  for (let i = 0; i <= characters.length; i++) {
    if (i < characters.length && !/\s/u.test(characters[i])) {
      if (!word) first = i;
      word += characters[i];
    } else if (word) {
      words.push({text: word, start: starts[first], end: ends[i - 1]});
      word = '';
    }
  }
  const groups = [];
  let group = [];
  for (const current of words) {
    if (group.length && (group.length >= 5 || [...group, current].map((w) => w.text).join(' ').length > 36)) {
      groups.push(group);
      group = [];
    }
    group.push(current);
  }
  if (group.length) groups.push(group);
  const captions = groups.map((items) => {
    const startFrame = toFrame(items[0].start);
    return {text: items.map((w) => w.text).join(' '), startFrame,
      endFrame: Math.max(startFrame + 1, toFrame(items.at(-1).end))};
  }).filter((caption) => caption.startFrame < totalFrames);
  return {theme: plan.theme, format: plan.format, durationInFrames: totalFrames, scenes, captions};
}

export function toSrt(captions) {
  const time = (frame) => {
    const ms = Math.round(frame / FPS * 1000);
    const pad = (n, width = 2) => String(n).padStart(width, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  return captions.map((caption, i) => `${i + 1}\n${time(caption.startFrame)} --> ${time(caption.endFrame)}\n${caption.text}\n`).join('\n');
}
