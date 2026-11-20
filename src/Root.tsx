import React from 'react';
import {Composition} from 'remotion';
import {Video, type VideoProps} from './Video';
import {CharacterReference} from './CartoonPresenter';

const defaultProps: VideoProps = {
  theme: '¡Hola, chicos!',
  format: 'historia',
  durationInFrames: 300,
  demo: true,
  scenes: [
    {id: 'hook', title: '', narration: '¡Hola, chicos!', from: 0, durationInFrames: 150, kind: 'hook'},
    {id: 'end', title: '¡Activa tu imaginación!', narration: '¿Listos para un nuevo reto?', from: 150, durationInFrames: 150, kind: 'end'},
  ],
  captions: [
    {text: '¡HOLA, CHICOS!', startFrame: 0, endFrame: 150},
    {text: '¿LISTOS PARA UN NUEVO RETO?', startFrame: 150, endFrame: 300},
  ],
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="VideoVertical"
    component={Video}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={defaultProps}
    calculateMetadata={({props}) => ({durationInFrames: props.durationInFrames})}
  />
  <Composition id="CharacterReference" component={CharacterReference} width={1080} height={1920} fps={30} durationInFrames={90}/>
  </>
);
