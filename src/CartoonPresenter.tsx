import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

const outline = '#201D1B';
const skin = '#F5B77F';
const shade = '#D88757';

export const cartoonBackground = 'radial-gradient(ellipse at 45% 33%, #90F2F7 0%, #42D5EC 43%, #17A9D2 100%)';

/** Original, reusable 2D presenter. All motion depends only on the video frame. */
export const CartoonPresenter: React.FC<{frame: number; speaking?: boolean; wave?: boolean}> = ({frame, speaking = false, wave = true}) => {
  const blink = frame % 137 >= 131;
  const breath = Math.sin(frame / 18) * 3;
  const handAngle = wave ? Math.sin(frame / 7) * 8 - 7 : -3;
  const mouthOpen = speaking ? 13 + (Math.sin(frame * 0.72) + 1) * 9 : 0;
  return (
    <svg viewBox="0 0 800 1250" width="100%" height="100%" aria-label="Presentador cartoon de cabello castaño, camiseta verde y jeans azules">
      <ellipse cx="384" cy="1190" rx="237" ry="30" fill="#087C9F" opacity=".25"/>
      <g stroke={outline} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M276 804 L365 807 L359 1105 L258 1106 L266 970 Z" fill="#477DB6"/>
        <path d="M365 807 L452 805 L487 1097 L387 1107 L356 927 Z" fill="#4D8AC5"/>
        <path d="M284 840 L311 845 L306 1079 L267 1085 L278 972 Z" fill="#386696" stroke="none"/>
        <path d="M414 841 L443 833 L476 1089 L437 1090 Z" fill="#386696" stroke="none"/>
        <path d="M356 843 L356 924" fill="none" stroke="#2D5176" strokeWidth="5"/>
        <path d="M280 858 Q306 894 333 863 M389 861 Q419 890 447 856" fill="none" stroke="#B5D3E9" strokeWidth="4"/>
        <path d="M255 1094 L359 1093 L361 1143 Q350 1172 299 1172 L218 1172 Q208 1149 229 1134 L254 1121 Z" fill="#FFFDF9"/>
        <path d="M383 1096 L484 1086 L498 1120 L533 1138 Q551 1154 537 1172 L421 1172 Q396 1169 389 1150 Z" fill="#FFFDF9"/>
        <path d="M217 1158 L354 1158 M407 1158 L541 1158" stroke="#B7C5CE" strokeWidth="7"/>
        <path d="M270 1125 L312 1125 M265 1140 L307 1140 M436 1121 L477 1119 M444 1137 L484 1135" stroke="#4A5960" strokeWidth="5"/>
        <g transform={`translate(0 ${breath})`}>
          <path d="M263 488 Q224 486 208 528 L170 665 Q162 706 194 729 L245 766 L273 721 L230 680 L273 563 Z" fill={skin}/>
          <path d="M205 550 L224 561 L194 673 Q187 691 209 711 L244 737 L236 753 L194 724 Q170 709 180 674 Z" fill={shade} stroke="none"/>
          <path d="M249 704 Q270 698 281 715 L295 744 Q299 756 285 758 L266 744 L275 766 Q275 782 261 777 L240 755 L226 730 Z" fill={skin} strokeWidth="6"/>
          <g transform={`rotate(${handAngle} 475 518)`}>
            <path d="M461 486 Q484 476 506 492 L552 541 L588 449 L633 467 L598 591 Q585 621 557 612 L482 558 Z" fill={skin}/>
            <path d="M500 515 L558 570 Q567 581 577 565 L611 471 L627 477 L595 588 Q584 609 565 600 L489 541 Z" fill={shade} stroke="none"/>
            <path d="M584 458 L579 421 L558 385 Q552 372 564 367 Q573 365 583 378 L596 395 L590 340 Q589 324 602 323 Q614 321 617 339 L623 375 L626 320 Q628 304 640 306 Q651 309 650 323 L648 376 L657 335 Q662 320 673 325 Q684 330 679 344 L671 389 L687 361 Q695 348 705 355 Q716 363 704 379 L675 430 Q662 455 635 467 L615 478 Z" fill={skin} strokeWidth="6"/>
            <path d="M604 415 Q620 396 640 403 M621 375 L622 394 M648 376 L645 397 M671 389 L664 408" fill="none" stroke={shade} strokeWidth="5"/>
          </g>
          <path d="M278 468 Q319 446 367 452 Q418 447 457 468 L499 493 L487 568 L457 560 L467 806 Q388 847 263 810 L271 565 L242 564 L228 505 Z" fill="#65BE4D"/>
          <path d="M271 565 L291 554 L292 791 Q350 814 462 786 L467 806 Q382 839 263 810 Z" fill="#399244" stroke="none"/>
          <path d="M407 470 Q438 471 458 488 L471 552 L455 549 L443 501 Z" fill="#8DD76B" stroke="none"/>
          <path d="M313 451 L313 401 L407 402 L410 452 Q390 492 361 491 Q333 486 313 451 Z" fill={skin}/>
          <path d="M315 417 L407 414 L408 443 Q373 460 315 434 Z" fill={shade} stroke="none"/>
          <path d="M307 461 Q360 513 416 460" fill="none" stroke="#2E793C" strokeWidth="7"/>
          <path d="M307 589 Q332 601 348 591 M408 742 L435 729" stroke="#399244" strokeWidth="5" fill="none"/>
          <ellipse cx="225" cy="280" rx="32" ry="43" fill={skin}/>
          <ellipse cx="491" cy="279" rx="31" ry="42" fill={skin}/>
          <path d="M219 270 Q232 264 233 285 M495 270 Q483 264 483 285" fill="none" stroke={shade} strokeWidth="5"/>
          <path d="M225 220 Q229 111 355 110 Q491 109 492 233 L482 329 Q469 395 408 420 Q359 440 305 411 Q248 386 233 329 Z" fill={skin}/>
          <path d="M458 205 Q476 281 453 342 Q436 389 399 414 Q460 395 476 345 Q497 299 487 228 Z" fill={shade} stroke="none"/>
          <path d="M238 227 L226 276 L209 251 L211 180 Q191 143 222 106 L202 90 L258 84 L252 45 L309 71 L326 25 L369 63 L419 38 L428 79 Q492 91 504 151 L491 248 L470 271 L461 193 Q405 206 364 178 Q302 220 257 194 Z" fill="#6B3E27"/>
          <path d="M233 154 Q240 118 288 111 L276 85 L323 101 L342 65 L371 99 L417 77 L415 108 Q462 111 475 150 Q426 137 390 152 Q332 178 281 163 Z" fill="#955C35" stroke="none"/>
          <path d="M230 214 L239 184 Q294 200 353 165 Q405 194 465 176" fill="none" stroke="#43291E" strokeWidth="9"/>
          <path d="M266 241 Q291 222 321 231 M389 230 Q419 220 447 239" fill="none" stroke="#4E2C20" strokeWidth="12"/>
          {blink ? <>
            <path d="M264 279 Q289 296 319 278 M389 278 Q416 295 446 277" strokeWidth="8" fill="none"/>
          </> : <>
            <ellipse cx="291" cy="281" rx="35" ry="42" fill="#FFFDF6" strokeWidth="6"/>
            <ellipse cx="417" cy="281" rx="35" ry="42" fill="#FFFDF6" strokeWidth="6"/>
            <ellipse cx="298" cy="285" rx="20" ry="27" fill="#805132" strokeWidth="4"/>
            <ellipse cx="410" cy="285" rx="20" ry="27" fill="#805132" strokeWidth="4"/>
            <ellipse cx="300" cy="286" rx="11" ry="18" fill={outline} stroke="none"/>
            <ellipse cx="409" cy="286" rx="11" ry="18" fill={outline} stroke="none"/>
            <ellipse cx="292" cy="274" rx="7" ry="9" fill="white" stroke="none"/>
            <ellipse cx="402" cy="274" rx="7" ry="9" fill="white" stroke="none"/>
          </>}
          <path d="M350 278 Q335 307 349 318 L364 319" fill="none" stroke={shade} strokeWidth="6"/>
          <ellipse cx="263" cy="329" rx="21" ry="10" fill="#F18E70" opacity=".55" stroke="none"/>
          <ellipse cx="443" cy="329" rx="21" ry="10" fill="#F18E70" opacity=".55" stroke="none"/>
          {speaking ? <>
            <path d={`M310 350 Q355 363 402 349 Q392 ${375 + mouthOpen} 358 ${377 + mouthOpen} Q324 ${374 + mouthOpen} 310 350 Z`} fill="#6D2929" strokeWidth="6"/>
            <path d="M320 354 Q355 363 391 354 L385 368 Q354 377 326 367 Z" fill="#FFFDF6" stroke="none"/>
            <path d={`M337 ${375 + mouthOpen - 3} Q357 ${361 + mouthOpen} 379 ${374 + mouthOpen - 3}`} fill="#E67B7A" stroke="none"/>
          </> : <path d="M314 351 Q356 385 398 350" fill="none" strokeWidth="6"/>}
          <path d="M344 404 Q359 409 373 402" fill="none" stroke={shade} strokeWidth="4"/>
        </g>
      </g>
    </svg>
  );
};

/** Clean reference image used by external video generation, without UI or text. */
export const CharacterReference: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: cartoonBackground}}>
      <div style={{position: 'absolute', left: 65, top: 180, width: 940, height: 1500}}>
        <CartoonPresenter frame={frame} wave speaking={false}/>
      </div>
    </AbsoluteFill>
  );
};
