import React from 'react';
import {Composition} from 'remotion';
import {Video, type VideoProps} from './Video';

const defaultProps: VideoProps = {
  theme: 'Acertijo: ciudades sin casas',
  format: 'acertijo-mapa',
  durationInFrames: 1800,
  demo: true,
  scenes: [
    {id: 'hook', title: '¿Puedes resolverlo?', narration: 'Escucha las pistas. ¿Puedes resolver este acertijo?', from: 0, durationInFrames: 150, kind: 'hook'},
    {id: 'riddle', title: 'Algo no encaja…', narration: 'Tengo ciudades, pero no casas. Tengo montañas, pero no árboles. Tengo agua, pero no peces. ¿Qué soy?', from: 150, durationInFrames: 390, kind: 'riddle'},
    {id: 'hint-1', title: 'Piensa de otra manera', narration: 'No todo lo que ves existe como lo imaginas. Presta atención a lo que falta.', from: 540, durationInFrames: 360, kind: 'hint'},
    {id: 'hint-2', title: 'Junta todas las pistas', narration: 'Ciudades, montañas y agua. ¿Qué objeto puede reunirlas sin contenerlas de verdad?', from: 900, durationInFrames: 300, kind: 'hint'},
    {id: 'countdown', title: '¿Ya tienes tu respuesta?', narration: 'Tienes diez segundos para pensarlo.', from: 1200, durationInFrames: 300, kind: 'countdown'},
    {id: 'reveal', title: '¡Es un mapa!', narration: 'Es un mapa: representa ciudades, montañas y agua, pero no contiene casas, árboles ni peces.', from: 1500, durationInFrames: 210, kind: 'reveal'},
    {id: 'end', title: '¿Lo habías adivinado?', narration: '¿Lo adivinaste? Cuéntalo en los comentarios.', from: 1710, durationInFrames: 90, kind: 'end'},
  ],
  captions: [
    {text: '¿Puedes resolver este acertijo?', startFrame: 0, endFrame: 150},
    {text: 'Tengo ciudades, pero no casas.', startFrame: 150, endFrame: 280},
    {text: 'Tengo montañas, pero no árboles.', startFrame: 280, endFrame: 410},
    {text: 'Tengo agua, pero no peces. ¿Qué soy?', startFrame: 410, endFrame: 540},
    {text: 'Piensa en lo que falta.', startFrame: 540, endFrame: 900},
    {text: 'Junta todas las pistas.', startFrame: 900, endFrame: 1200},
    {text: '¿Qué puede ser?', startFrame: 1200, endFrame: 1500},
    {text: '¡La respuesta es un mapa!', startFrame: 1500, endFrame: 1710},
    {text: '¿Lo habías adivinado?', startFrame: 1710, endFrame: 1800},
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VideoVertical"
    component={Video}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1800}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({durationInFrames: props.durationInFrames})}
  />
);
