import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CartoonPresenter, cartoonBackground} from './CartoonPresenter';

export type SceneKind = 'hook' | 'problem' | 'action' | 'twist' | 'end' | 'riddle' | 'hint' | 'countdown' | 'reveal';
export type VideoScene = {
  id: string;
  title: string;
  narration: string;
  from: number;
  durationInFrames: number;
  kind: SceneKind;
  mediaSrc?: string;
};
export type VideoCaption = {text: string; startFrame: number; endFrame: number};
export type VideoProps = {
  theme: string;
  durationInFrames: number;
  demo: boolean;
  scenes: VideoScene[];
  captions: VideoCaption[];
  format?: string;
};

const ink = '#201D1B';
const paper = '#FFFDF5';
const cyan = '#49CEE8';
const coral = '#EF7775';
const yellow = '#FFE451';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const font = 'Arial, Helvetica, sans-serif';
const outlinedText: React.CSSProperties = {color: 'white', WebkitTextStroke: '9px #151515', paintOrder: 'stroke fill', textShadow: '0 7px 0 #151515', fontWeight: 900};

const Brain: React.FC<{frame: number; left: number; top: number; size: number; tilt?: number}> = ({frame, left, top, size, tilt = -12}) => (
  <svg viewBox="0 0 230 190" style={{position: 'absolute', left, top: top + Math.sin(frame / 25) * 12, width: size, transform: `rotate(${tilt + Math.sin(frame / 30) * 4}deg)`}} aria-label="Cerebro cartoon rosa">
    <path d="M110 28 Q92 7 69 28 Q40 20 33 49 Q6 55 17 86 Q0 113 26 131 Q28 157 59 157 Q74 184 104 164 Q127 185 147 164 Q177 171 188 146 Q222 141 212 112 Q230 82 207 66 Q209 37 179 34 Q151 7 132 27 Q119 16 110 28 Z" fill="#FF9CB8" stroke={ink} strokeWidth="8" strokeLinejoin="round"/>
    <path d="M110 31 Q97 54 115 78 Q101 98 111 121 Q102 143 107 165 M70 29 Q84 46 68 63 Q39 57 38 83 M179 36 Q167 51 184 67 Q204 78 190 96 M30 128 Q45 107 67 117 Q77 140 59 154 M150 158 Q164 139 150 123 Q168 106 189 122 M57 84 Q78 72 87 91 M134 54 Q153 40 158 66 M134 93 Q156 82 166 99" fill="none" stroke="#C95B82" strokeWidth="6" strokeLinecap="round"/>
  </svg>
);

const Question: React.FC<{frame: number; left: number; top: number; size: number; tilt?: number}> = ({frame, left, top, size, tilt = 13}) => (
  <div style={{position: 'absolute', left, top: top + Math.sin(frame / 23) * 14, color: yellow, fontWeight: 900, fontSize: size, lineHeight: 1, WebkitTextStroke: '7px #201D1B', paintOrder: 'stroke fill', textShadow: '3px 7px 0 #201D1B', transform: `rotate(${tilt + Math.sin(frame / 29) * 4}deg)`}}>?</div>
);

/** Mounted only during the reveal scene, never as a background decoration. */
const FoldedMap: React.FC<{frame: number}> = ({frame}) => {
  const {fps} = useVideoConfig();
  const unfold = spring({frame, fps, config: {damping: 18, stiffness: 85}});
  return (
    <svg viewBox="0 0 900 680" style={{width: '100%', height: '100%', transform: `scaleX(${0.78 + unfold * 0.22})`}} aria-label="Mapa plegado con caminos, montañas y río">
      <path d="M229 161 L393 115 L545 162 L713 107 L713 468 L545 522 L393 477 L229 522 Z" fill="#087C9F" opacity=".2" transform="translate(12 15)"/>
      <path d="M225 150 L390 105 L540 150 L705 95 L705 455 L540 510 L390 465 L225 510 Z" fill={paper} stroke={ink} strokeWidth="9" strokeLinejoin="round"/>
      <path d="M390 105 L540 150 L540 510 L390 465 Z" fill="#E8DCC5"/>
      <path d="M540 150 L705 95 L705 455 L540 510 Z" fill="#FCF1D9"/>
      <path d="M390 111 L390 458 M540 155 L540 503" stroke="#C5B89E" strokeWidth="3" strokeDasharray="8 7"/>
      <path d="M544 169 C607 200 573 237 612 273 C655 314 605 354 632 403 L657 458" fill="none" stroke={cyan} strokeWidth="21" strokeLinecap="round"/>
      <path d="M255 423 C320 425 305 360 371 350 S430 284 485 303 S550 345 582 318" fill="none" stroke={coral} strokeWidth="8" strokeLinecap="round" strokeDasharray="12 12"/>
      <path d="M264 265 L302 201 L341 265 Z M317 278 L365 195 L413 278 Z M414 231 L450 172 L487 231 Z" fill="#67A96A" stroke={ink} strokeWidth="4" strokeLinejoin="round"/>
      <path d="M285 228 L302 201 L319 228 L308 222 L300 230 L293 222 Z M348 225 L365 195 L382 225 L372 220 L363 229 L355 220 Z" fill={paper}/>
      <g fill={yellow} stroke={ink} strokeWidth="4"><rect x="284" y="325" width="23" height="36"/><rect x="311" y="309" width="26" height="52"/><rect x="342" y="331" width="23" height="30"/></g>
      <path d="M489 380 C489 351 529 351 529 380 C529 396 509 418 509 418 C509 418 489 396 489 380 Z" fill={coral} stroke={ink} strokeWidth="5"/>
      <circle cx="509" cy="378" r="7" fill={paper}/>
      <g transform="translate(649 192)"><circle r="24" fill={paper} stroke={ink} strokeWidth="3"/><path d="M0 -19 L9 12 L0 6 L-9 12 Z" fill={coral}/><text x="0" y="-34" fill={ink} fontSize="18" textAnchor="middle" fontWeight="800">N</text></g>
    </svg>
  );
};

const Countdown: React.FC<{frame: number}> = ({frame}) => {
  const {fps} = useVideoConfig();
  const seconds = Math.max(1, Math.min(10, 10 - Math.floor(frame / fps)));
  const withinSecond = frame % fps / fps;
  const circumference = 2 * Math.PI * 137;
  const pulse = interpolate(withinSecond, [0, 0.16, 1], [1.06, 1, 1], clamp);
  return (
    <svg viewBox="0 0 360 400" style={{position: 'absolute', left: 595, top: 510, width: 355}} aria-label={`${seconds} segundos para responder`}>
      <circle cx="180" cy="173" r="151" fill="#31B5D4" opacity=".7"/>
      <circle cx="180" cy="173" r="137" fill="none" stroke="#138FAF" strokeWidth="17"/>
      <circle cx="180" cy="173" r="137" fill="none" stroke={yellow} strokeWidth="17" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * withinSecond} transform="rotate(-90 180 173)"/>
      <g transform={`translate(180 173) scale(${pulse})`}><text x="0" y="57" fill="white" stroke={ink} strokeWidth="8" paintOrder="stroke fill" fontSize="164" fontWeight="900" textAnchor="middle">{seconds}</text></g>
      <text x="180" y="370" textAnchor="middle" fill="white" stroke={ink} strokeWidth="6" paintOrder="stroke fill" fontSize="33" fontWeight="900">¡PIÉNSALO!</text>
    </svg>
  );
};

const City: React.FC = () => (
  <svg viewBox="0 0 260 220" style={{position: 'absolute', width: 220, left: 740, top: 1050, transform: 'rotate(7deg)'}} aria-label="Ciudad abstracta, sin mostrar la respuesta">
    <g stroke={ink} strokeWidth="6" strokeLinejoin="round"><rect x="19" y="87" width="59" height="112" rx="6" fill="#FFD75C"/><rect x="90" y="30" width="71" height="169" rx="6" fill="#A1DBF3"/><rect x="174" y="111" width="58" height="88" rx="6" fill="#FD9AB5"/></g>
    {[0, 1, 2].map(i => <g key={i} fill="#2597BC"><rect x="105" y={52 + i * 44} width="13" height="21"/><rect x="133" y={52 + i * 44} width="13" height="21"/></g>)}
  </svg>
);

const CartoonScene: React.FC<{scene: VideoScene; captions: VideoCaption[]; demo: boolean; format?: string}> = ({scene, captions, demo, format}) => {
  const frame = useCurrentFrame();
  const isRiddle = format === 'acertijo-mapa';
  const isPromptDemo = format === 'prompt-ia' && !scene.mediaSrc;
  const speaking = captions.some(caption => caption.startFrame <= frame + scene.from && frame + scene.from < caption.endFrame);
  const intro = interpolate(frame, [0, 9], [25, 0], clamp);
  const isReveal = scene.kind === 'reveal';
  const isCountdown = scene.kind === 'countdown';
  const presenterStyle: React.CSSProperties = isReveal
    ? {left: -115, top: 755, width: 670, height: 1046}
    : isCountdown ? {left: -105, top: 450, width: 820, height: 1281}
      : {left: 64, top: 235, width: 950, height: 1484};
  return (
    <AbsoluteFill style={{background: cartoonBackground}}>
      <svg viewBox="0 0 1080 1920" style={{position: 'absolute', width: '100%', height: '100%'}}>
        <circle cx="530" cy="820" r="610" fill="#C7FDFF" opacity=".1"/>
        <path d="M80 132 L103 156 M929 1320 L955 1347 M865 340 L886 365 M135 975 L160 950" stroke="#D3FBFF" strokeWidth="12" strokeLinecap="round" opacity=".65"/>
      </svg>
      {!isReveal && <>
        <Question frame={frame} left={64} top={385} size={160} tilt={-17}/>
        <Question frame={frame + 35} left={850} top={865} size={145}/>
        <Brain frame={frame} left={765} top={265} size={205} tilt={13}/>
        <Brain frame={frame + 30} left={55} top={1055} size={170}/>
      </>}
      {isRiddle && (scene.kind === 'hint' || scene.kind === 'riddle') && <City/>}
      {isReveal && <div style={{position: 'absolute', left: 105, top: 340, width: 1010, height: 790}}><FoldedMap frame={frame}/></div>}
      <div style={{position: 'absolute', ...presenterStyle, transform: `translateY(${intro}px)`}}>
        <CartoonPresenter frame={frame} speaking={speaking} wave={scene.kind === 'hook' || scene.kind === 'end'}/>
      </div>
      {isCountdown && <Countdown frame={frame}/>}
      {scene.title && scene.kind !== 'hook' && <div style={{...outlinedText, position: 'absolute', left: 95, top: 165, width: 790, fontSize: scene.title.length > 45 ? 47 : 58, lineHeight: 1.1, textAlign: 'center', WebkitTextStroke: '6px #151515', textShadow: '0 4px 0 #151515'}}>{scene.title.toLocaleUpperCase('es')}</div>}
      {demo && <div style={{position: 'absolute', left: 62, top: 70, padding: '12px 22px', borderRadius: 12, background: yellow, border: `4px solid ${ink}`, color: ink, fontSize: isPromptDemo ? 27 : 24, fontWeight: 900, letterSpacing: 1}}>{isPromptDemo ? 'DEMO · SIN CLIPS IA' : 'DEMO'}</div>}
    </AbsoluteFill>
  );
};

const Captions: React.FC<{captions: VideoCaption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const caption = captions.find(c => c.startFrame <= frame && frame < c.endFrame);
  if (!caption) return null;
  const pop = interpolate(frame - caption.startFrame, [0, 4], [0.96, 1], clamp);
  return (
    <div style={{...outlinedText, position: 'absolute', left: 74, top: 1455, width: 840, minHeight: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontSize: caption.text.length > 58 ? 57 : caption.text.length > 35 ? 65 : 79, textAlign: 'center', lineHeight: 1.1, letterSpacing: -1.4, overflowWrap: 'break-word', transform: `scale(${pop})`}}>
      {caption.text.toLocaleUpperCase('es')}
    </div>
  );
};

export const Video: React.FC<VideoProps> = ({scenes, captions, demo, format}) => (
  <AbsoluteFill style={{background: '#30BDD9', fontFamily: font, overflow: 'hidden'}}>
    {scenes.map(scene => (
      <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames}>
        {scene.mediaSrc ? (
          <OffthreadVideo src={staticFile(scene.mediaSrc)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
        ) : (
          <CartoonScene scene={scene} captions={captions} demo={demo} format={format}/>
        )}
      </Sequence>
    ))}
    <Captions captions={captions}/>
  </AbsoluteFill>
);
