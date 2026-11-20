import React from 'react';
import {Composition} from 'remotion';
import {Video, type VideoProps} from './Video';

const defaultProps: VideoProps = {
  theme: 'Una idea puede cambiar tu día',
  durationInFrames: 300,
  demo: true,
  scenes: [
    {id: 'hook', title: 'Todo empieza con una idea', narration: 'Todo empieza con una pequeña idea.', from: 0, durationInFrames: 150, kind: 'hook'},
    {id: 'end', title: 'Dale el primer impulso', narration: 'Hoy puede ser un buen día para empezar.', from: 150, durationInFrames: 150, kind: 'end'},
  ],
  captions: [
    {text: 'Todo empieza con una pequeña idea.', startFrame: 0, endFrame: 150},
    {text: 'Hoy puede ser un buen día para empezar.', startFrame: 150, endFrame: 300},
  ],
};

export const RemotionRoot: React.FC = () => (
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
);
