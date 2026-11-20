import React from 'react';
import {AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export type SceneKind = 'hook' | 'problem' | 'action' | 'twist' | 'end';
export type VideoScene = {
  id: string;
  title: string;
  narration: string;
  from: number;
  durationInFrames: number;
  kind: SceneKind;
};
export type VideoCaption = {text: string; startFrame: number; endFrame: number};
export type VideoProps = {
  theme: string;
  durationInFrames: number;
  demo: boolean;
  scenes: VideoScene[];
  captions: VideoCaption[];
};

const ink = '#101B30';
const paper = '#FFF8EE';
const coral = '#FF816F';
const cyan = '#77E5D3';
const yellow = '#FFDA76';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const font = 'Arial, Helvetica, sans-serif';

/** Original vector mascot. Geometry stays identical across every scene. */
const Mascot: React.FC<{frame: number; mood?: SceneKind}> = ({frame, mood = 'hook'}) => {
  const blink = frame % 109 > 102;
  const worried = mood === 'problem';
  const wave = Math.sin(frame / 10) * 8;
  return (
    <svg viewBox="0 0 500 560" width="100%" height="100%" aria-label="Personaje 2D original">
      <ellipse cx="255" cy="523" rx="140" ry="20" fill={ink} opacity=".2"/>
      <path d="M175 400 L163 487 Q162 504 183 504 L217 504 L219 402" fill={ink}/>
      <path d="M287 402 L288 504 L325 504 Q341 504 338 487 L326 398" fill={ink}/>
      <path d={`M150 305 Q77 328 77 ${worried ? 375 : 272 + wave}`} fill="none" stroke={ink} strokeWidth="24" strokeLinecap="round"/>
      <path d={`M348 306 Q415 334 428 ${worried ? 375 : 245 - wave}`} fill="none" stroke={ink} strokeWidth="24" strokeLinecap="round"/>
      <circle cx="77" cy={worried ? 375 : 272 + wave} r="19" fill={paper}/>
      <circle cx="428" cy={worried ? 375 : 245 - wave} r="19" fill={paper}/>
      <path d="M137 230 Q126 196 163 186 L332 171 Q370 168 373 209 L388 377 Q393 418 350 424 L177 440 Q139 441 137 402 Z" fill={coral} stroke={ink} strokeWidth="10" strokeLinejoin="round"/>
      <path d="M158 210 L333 195" stroke="#FFB6A7" strokeWidth="13" strokeLinecap="round"/>
      <rect x="162" y="244" width="185" height="117" rx="43" fill={paper} transform="rotate(-5 255 300)"/>
      <g transform="rotate(-5 255 300)">
        <rect x="199" y={blink ? 289 : 274} width="20" height={blink ? 5 : 34} rx="10" fill={ink}/>
        <rect x="289" y={blink ? 289 : 274} width="20" height={blink ? 5 : 34} rx="10" fill={ink}/>
        {worried ? <path d="M236 334 Q252 320 268 334" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round"/> : <path d="M236 321 Q253 342 271 318" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round"/>}
      </g>
      <circle cx="181" cy="326" r="12" fill={coral} opacity=".5"/>
      <circle cx="329" cy="313" r="12" fill={coral} opacity=".5"/>
      <path d="M229 185 L222 139" stroke={ink} strokeWidth="12" strokeLinecap="round"/>
      <circle cx="219" cy="129" r="23" fill={cyan} stroke={ink} strokeWidth="8"/>
      <path d="M238 394 L266 389" stroke={ink} strokeWidth="8" strokeLinecap="round"/>
    </svg>
  );
};

const Spark: React.FC<{x: number; y: number; size?: number; color?: string; rotation?: number}> = ({x, y, size = 45, color = yellow, rotation = 0}) => (
  <svg style={{position: 'absolute', left: x, top: y, width: size, height: size, transform: `rotate(${rotation}deg)`}} viewBox="0 0 100 100">
    <path d="M50 0 L62 36 L100 50 L62 63 L50 100 L37 63 L0 50 L37 36 Z" fill={color}/>
  </svg>
);

const Bulb: React.FC<{frame: number; large?: boolean}> = ({frame, large}) => (
  <svg viewBox="0 0 260 300" style={{position: 'absolute', width: large ? 320 : 210, left: large ? 485 : 580, top: large ? 35 : 70, transform: `rotate(${Math.sin(frame / 20) * 8}deg)`}}>
    {Array.from({length: 8}, (_, i) => <path key={i} d="M130 0 L130 24" stroke={yellow} strokeWidth="10" strokeLinecap="round" transform={`rotate(${i * 45} 130 130)`}/>)}
    <path d="M74 172 C12 102 66 43 129 43 C199 43 239 112 183 172 Q169 188 170 210 L89 210 Q90 188 74 172 Z" fill={yellow} stroke={ink} strokeWidth="8"/>
    <path d="M115 208 L104 145 L133 164 L157 142 L146 208" fill="none" stroke={ink} strokeWidth="8" strokeLinejoin="round"/>
    <path d="M91 218 L169 218 L163 260 Q130 288 98 260 Z" fill={paper} stroke={ink} strokeWidth="8"/>
    <path d="M96 238 L164 238" stroke={ink} strokeWidth="8"/>
  </svg>
);

const Illustration: React.FC<{scene: VideoScene; frame: number}> = ({scene, frame}) => {
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 15, stiffness: 95}});
  const float = Math.sin(frame / 18) * 13;
  const kind = scene.kind;
  return (
    <div style={{position: 'absolute', top: 585, left: 35, width: 905, height: 710, transform: `translateY(${(1 - pop) * 65}px) scale(${0.9 + pop * 0.1})`}}>
      <svg viewBox="0 0 900 680" style={{position: 'absolute', width: '100%', height: '100%'}}>
        <ellipse cx="450" cy="592" rx="375" ry="63" fill={cyan} opacity=".10"/>
        <path d="M80 588 L815 588" stroke={paper} strokeWidth="4" opacity=".14"/>
        {kind === 'hook' && <>
          <circle cx="450" cy="315" r="247" fill={cyan} opacity=".07"/>
          <circle cx="450" cy="315" r="247" fill="none" stroke={cyan} strokeWidth="3" strokeDasharray="9 20" opacity=".45" transform={`rotate(${frame / 3} 450 315)`}/>
        </>}
        {kind === 'problem' && <>
          <path d="M92 126 Q52 74 105 55 Q125 12 175 51 Q225 15 244 64 Q300 72 278 122 Z" fill="#64768E"/>
          <path d="M626 184 Q594 142 632 117 Q650 70 695 109 Q743 73 766 121 Q821 133 799 181 Z" fill="#64768E"/>
          {[0, 1, 2].map(i => <path key={i} d={`M${120 + i * 53} ${158 + (frame + i * 12) % 45} l-12 25`} stroke={cyan} strokeWidth="9" strokeLinecap="round"/>)}
          <path d="M682 218 L660 266 L691 266 L669 315" fill="none" stroke={yellow} strokeWidth="12" strokeLinejoin="round"/>
          <circle cx="725" cy="455" r="60" fill={coral} opacity=".16"/>
          <path d="M707 434 L744 472 M744 434 L707 472" stroke={coral} strokeWidth="10" strokeLinecap="round"/>
        </>}
        {kind === 'action' && [0, 1, 2].map(i => {
          const grow = interpolate(frame, [i * 6, i * 6 + 20], [0, 1], clamp);
          return <g key={i} opacity={grow} transform={`translate(0 ${(1 - grow) * 80})`}>
            <rect x={546 + i * 83} y={468 - i * 84} width="80" height={120 + i * 84} rx="16" fill={[cyan, yellow, coral][i]}/>
            <path d={`M${565 + i * 83} ${495 - i * 84} l11 12 l23 -25`} fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
          </g>;
        })}
        {kind === 'twist' && <>
          <circle cx="466" cy="302" r="262" fill={yellow} opacity=".06"/>
          {Array.from({length: 12}, (_, i) => <rect key={i} x="452" y="17" width="13" height="39" rx="5" fill={i % 2 ? coral : cyan} transform={`rotate(${i * 30 + frame / 5} 458 302)`}/>)}
        </>}
        {kind === 'end' && <>
          <path d="M639 335 Q718 248 771 288 Q810 350 714 428 L660 410 Z" fill={paper} stroke={ink} strokeWidth="8"/>
          <path d="M733 281 Q757 270 775 291 Q793 312 789 337 Z" fill={coral}/>
          <circle cx="726" cy="337" r="22" fill={cyan} stroke={ink} strokeWidth="7"/>
          <path d={`M651 374 L${604 - Math.sin(frame) * 10} 429 L663 415`} fill={yellow}/>
          <path d="M642 370 L610 369 L626 327 L681 319 M706 421 L708 454 L752 433 L759 381" fill={coral} stroke={ink} strokeWidth="7" strokeLinejoin="round"/>
          <path d="M595 466 Q507 521 492 558" fill="none" stroke={cyan} strokeWidth="4" strokeDasharray="10 14" opacity=".55"/>
        </>}
      </svg>
      <div style={{position: 'absolute', left: kind === 'action' ? 65 : 195, top: 113 + float, width: 505, height: 565, transform: `rotate(${Math.sin(frame / 25) * 2}deg)`}}>
        <Mascot frame={frame} mood={kind}/>
      </div>
      {(kind === 'hook' || kind === 'twist') && <Bulb frame={frame} large={kind === 'twist'}/>}
      {kind !== 'problem' && <>
        <Spark x={100} y={180 + float} size={45} rotation={frame / 2}/>
        <Spark x={758} y={420 - float} size={30} color={cyan} rotation={-frame / 2}/>
        <Spark x={185} y={470} size={22} color={coral}/>
      </>}
    </div>
  );
};

const Scene: React.FC<{scene: VideoScene; index: number; count: number}> = ({scene, index, count}) => {
  const frame = useCurrentFrame();
  const entrance = interpolate(frame, [0, 11], [0, 1], clamp);
  const exit = interpolate(frame, [Math.max(12, scene.durationInFrames - 9), scene.durationInFrames], [1, 0], clamp);
  const accent = scene.kind === 'problem' ? coral : scene.kind === 'twist' ? yellow : cyan;
  const titleSize = scene.title.length > 55 ? 62 : scene.title.length > 35 ? 72 : 84;
  const labels = {hook: 'LA IDEA', problem: 'EL OBSTÁCULO', action: 'EL PRIMER PASO', twist: 'EL GIRO', end: 'TU TURNO'};
  return (
    <AbsoluteFill style={{opacity: entrance * exit, transform: `translateY(${(1 - entrance) * 38}px)`}}>
      <div style={{position: 'absolute', left: 90, top: 240, display: 'flex', alignItems: 'center', gap: 16, color: accent, fontSize: 25, fontWeight: 800, letterSpacing: 5}}>
        <span style={{width: 42, height: 4, background: accent}}/>{labels[scene.kind]}
      </div>
      <div style={{position: 'absolute', left: 86, top: 308, width: 810, color: paper, fontSize: titleSize, fontWeight: 900, lineHeight: 1.04, letterSpacing: -3, overflowWrap: 'break-word'}}>{scene.title}</div>
      <Illustration scene={scene} frame={frame}/>
      <div style={{position: 'absolute', top: 1300, left: 90, display: 'flex', gap: 12}}>
        {Array.from({length: count}, (_, i) => <div key={i} style={{width: i === index ? 68 : 16, height: 8, borderRadius: 10, background: i === index ? accent : '#344256'}}/>)}
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{captions: VideoCaption[]}> = ({captions}) => {
  const frame = useCurrentFrame();
  const caption = captions.find(c => c.startFrame <= frame && frame < c.endFrame);
  if (!caption) return null;
  const pop = interpolate(frame - caption.startFrame, [0, 4], [0.97, 1], clamp);
  return (
    <div style={{position: 'absolute', left: 82, top: 1400, width: 826, minHeight: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', boxSizing: 'border-box', background: paper, borderRadius: 24, transform: `scale(${pop})`, boxShadow: '0 12px 0 rgba(0,0,0,.2)'}}>
      <div style={{fontSize: caption.text.length > 64 ? 38 : 45, fontWeight: 800, lineHeight: 1.18, letterSpacing: -0.8, textAlign: 'center', color: ink, overflowWrap: 'break-word'}}>{caption.text}</div>
    </div>
  );
};

export const Video: React.FC<VideoProps> = ({theme, durationInFrames, scenes, captions, demo}) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / Math.max(1, durationInFrames - 1));
  return (
    <AbsoluteFill style={{background: ink, color: paper, fontFamily: font, overflow: 'hidden'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at 20% 45%, #233C4B 0%, #152439 40%, #101B30 75%)'}}/>
      <div style={{position: 'absolute', width: 640, height: 640, left: 720, top: -290, borderRadius: '50%', border: '1px solid #77E5D32B', transform: `rotate(${frame / 5}deg)`}}/>
      <div style={{position: 'absolute', left: 90, right: 170, top: 118, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontSize: 23, fontWeight: 800, letterSpacing: 4, color: cyan}}>PEQUEÑAS HISTORIAS</div>
        <div style={{fontSize: 19, fontWeight: 800, color: demo ? yellow : paper, border: '1px solid #64768E', borderRadius: 100, padding: '9px 16px'}}>{demo ? 'DEMO' : '2D'}</div>
      </div>
      <div style={{position: 'absolute', top: 177, left: 90, width: 790, fontSize: 23, color: '#AABBCB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{theme}</div>
      {scenes.map((scene, index) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames}>
          <Scene scene={scene} index={index} count={scenes.length}/>
        </Sequence>
      ))}
      <Captions captions={captions}/>
      <div style={{position: 'absolute', left: 90, top: 1604, width: 790, height: 5, borderRadius: 10, background: '#344256', overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${progress * 100}%`, background: cyan}}/>
      </div>
    </AbsoluteFill>
  );
};
