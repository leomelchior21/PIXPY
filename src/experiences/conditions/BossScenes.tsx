import type { CSSProperties, ReactNode } from 'react'

// A looping backdrop for every boss, showing where the mission happens: the club door, the lab,
// the vault… Decoration only, drawn behind the boss and the fighter.

const range = (count: number) => Array.from({ length: count }, (_, i) => i)
const delay = (seconds: number) => ({ animationDelay: `${seconds}s` }) as CSSProperties

const scenes: Record<number, ReactNode> = {
  // 1. The club door: brick wall, neon sign, velvet rope, sweeping lights, music.
  1: <>
    <rect width="400" height="260" fill="#1d1020" />
    {range(9).map((row) => range(11).map((col) => <rect key={`${row}-${col}`} x={col * 40 - (row % 2) * 20} y={row * 22} width="38" height="20" fill={(row + col) % 3 ? '#3a1b2a' : '#341726'} />))}
    <polygon className="bs-beam" points="200,0 140,260 190,260" fill="#ff5fd2" opacity=".14" />
    <polygon className="bs-beam bs-beam--b" points="200,0 230,260 280,260" fill="#5ff0ff" opacity=".12" />
    <rect x="150" y="70" width="100" height="150" rx="4" fill="#120a14" stroke="#ff9bd8" strokeWidth="3" />
    <rect x="160" y="80" width="80" height="140" fill="#1e1022" />
    <circle cx="228" cy="150" r="4" fill="#ffd36b" />
    <text className="bs-flicker" x="200" y="56" textAnchor="middle" fontSize="30" fontWeight="900" fill="#ff7ae0" stroke="#ffd6f4" strokeWidth="1">CLUB</text>
    <rect x="90" y="186" width="8" height="40" fill="#d9b44a" /><rect x="302" y="186" width="8" height="40" fill="#d9b44a" />
    <path className="bs-rope" d="M94 192 Q140 214 150 196 M250 196 Q260 214 306 192" stroke="#c4123a" strokeWidth="6" fill="none" strokeLinecap="round" />
    {range(4).map((i) => <text key={i} className="bs-note" style={delay(i * 0.9)} x={260 + i * 26} y="200" fontSize="20" fill="#ffd36b">♪</text>)}
  </>,
  // 2. The overheated lab: shelves of bubbling flasks, a wall thermometer, a ceiling fan.
  2: <>
    <rect width="400" height="260" fill="#0f2230" />
    <rect x="0" y="0" width="400" height="12" fill="#1c3a4f" />
    <g className="bs-spin" style={{ transformOrigin: '320px 28px' }}>{range(4).map((i) => <rect key={i} x="318" y="10" width="4" height="36" rx="2" fill="#9fd8ff" transform={`rotate(${i * 90} 320 28)`} />)}</g>
    <circle cx="320" cy="28" r="6" fill="#d8f1ff" />
    {[60, 120].map((y) => <rect key={y} x="20" y={y} width="170" height="6" fill="#4b6b80" />)}
    {[[40, 60, '#7dffab'], [80, 60, '#ff7aa2'], [130, 60, '#ffd34e'], [50, 120, '#72dcff'], [110, 120, '#b49cff'], [160, 120, '#7dffab']].map(([x, y, color], i) => <g key={i}>
      <path d={`M${x as number - 9} ${y as number} L${x as number - 9} ${y as number - 18} L${x as number - 4} ${y as number - 26} L${x as number - 4} ${y as number - 34} L${x as number + 4} ${y as number - 34} L${x as number + 4} ${y as number - 26} L${x as number + 9} ${y as number - 18} L${x as number + 9} ${y as number} Z`} fill={color as string} opacity=".75" stroke="#d8f1ff" strokeWidth="1.5" />
      {range(3).map((b) => <circle key={b} className="bs-bubble" style={delay(b * 0.7 + i * 0.3)} cx={x as number - 3 + b * 3} cy={y as number - 6} r="2" fill="#fff" />)}
    </g>)}
    <rect x="250" y="70" width="26" height="140" rx="13" fill="#e8f4fb" stroke="#0a1a24" strokeWidth="3" />
    <rect className="bs-mercury" x="258" y="90" width="10" height="112" rx="5" fill="#ff4d4d" />
    <circle cx="263" cy="210" r="16" fill="#ff4d4d" stroke="#0a1a24" strokeWidth="3" />
    {range(3).map((i) => <path key={i} className="bs-heat" style={delay(i * 0.6)} d={`M${300 + i * 26} 230 q8 -12 0 -24 q-8 -12 0 -24`} stroke="#ff9b5e" strokeWidth="3" fill="none" opacity=".5" />)}
  </>,
  // 3. The locked vault: a huge round door with a turning dial, laser beams, gold.
  3: <>
    <rect width="400" height="260" fill="#151a22" />
    {range(10).map((i) => <rect key={i} x={i * 40} y="0" width="2" height="260" fill="#1d2430" />)}
    <circle cx="140" cy="120" r="92" fill="#3a4250" stroke="#0b0e13" strokeWidth="6" />
    <circle cx="140" cy="120" r="72" fill="#525c6c" />
    {range(12).map((i) => <circle key={i} cx={140 + Math.cos(i * Math.PI / 6) * 82} cy={120 + Math.sin(i * Math.PI / 6) * 82} r="5" fill="#8d96a5" />)}
    <g className="bs-dial" style={{ transformOrigin: '140px 120px' }}>
      <circle cx="140" cy="120" r="30" fill="#8d96a5" stroke="#0b0e13" strokeWidth="3" />
      {range(3).map((i) => <rect key={i} x="137" y="78" width="6" height="84" rx="3" fill="#c3cad6" transform={`rotate(${i * 60} 140 120)`} />)}
    </g>
    {range(4).map((i) => <line key={i} className="bs-laser" style={delay(i * 0.5)} x1="0" y1={150 + i * 22} x2="400" y2={120 + i * 30} stroke="#ff2a4a" strokeWidth="2" />)}
    {[[290, 220], [322, 220], [306, 204]].map(([x, y], i) => <g key={i}><rect x={x} y={y} width="30" height="14" rx="2" fill="#ffc246" stroke="#7a5212" strokeWidth="2" /><rect className="bs-glint" style={delay(i * 0.8)} x={x + 4} y={y + 3} width="6" height="3" fill="#fff" /></g>)}
  </>,
  // 4. The hungry arcade: a row of cabinets with blinking screens, coins falling, a neon sign.
  4: <>
    <rect width="400" height="260" fill="#160f26" />
    <text className="bs-flicker" x="200" y="38" textAnchor="middle" fontSize="28" fontWeight="900" fill="#ffd23f" stroke="#ff7aa2" strokeWidth="1.5">ARCADE</text>
    {range(5).map((i) => <g key={i} transform={`translate(${18 + i * 78} 70)`}>
      <path d="M0 160 V20 L10 0 H54 L64 20 V160 Z" fill={['#3b1a5a', '#1a3b5a', '#5a1a3b', '#1a5a3b', '#3b3b5a'][i]} stroke="#000" strokeWidth="2" />
      <rect className="bs-screen" style={delay(i * 0.35)} x="10" y="26" width="44" height="34" fill={['#7dffab', '#72dcff', '#ff7aa2', '#ffd23f', '#b49cff'][i]} />
      <circle cx="22" cy="80" r="5" fill="#ff3b5c" /><circle cx="40" cy="80" r="5" fill="#ffd23f" />
    </g>)}
    {range(6).map((i) => <circle key={i} className="bs-coin" style={delay(i * 0.55)} cx={40 + i * 64} cy="-10" r="7" fill="#ffd34e" stroke="#b07a10" strokeWidth="2" />)}
  </>,
  // 5. The number splitter: even numbers drift up on the left, odd on the right, split by a glowing line.
  5: <>
    <rect width="400" height="260" fill="#151030" />
    <rect className="bs-pulse" x="198" y="0" width="4" height="260" fill="#c3a6ff" />
    <text x="96" y="40" textAnchor="middle" fontSize="18" fontWeight="900" fill="#72dcff">EVEN</text>
    <text x="304" y="40" textAnchor="middle" fontSize="18" fontWeight="900" fill="#ff7aa2">ODD</text>
    {[2, 4, 6, 8, 10, 0].map((n, i) => <text key={`e${n}`} className="bs-rise" style={delay(i * 0.7)} x={40 + (i % 3) * 52} y="270" fontSize="26" fontWeight="900" fill="#72dcff" opacity=".7">{n}</text>)}
    {[1, 3, 5, 7, 9, 11].map((n, i) => <text key={`o${n}`} className="bs-rise" style={delay(i * 0.7 + 0.35)} x={250 + (i % 3) * 52} y="270" fontSize="26" fontWeight="900" fill="#ff7aa2" opacity=".7">{n}</text>)}
    <text className="bs-flicker" x="200" y="140" textAnchor="middle" fontSize="40" fontWeight="900" fill="#ebe0ff" opacity=".35">% 2</text>
  </>,
  // 6. The secret cave: rock arch, stalactites, flickering torches, glowing crystals, a locked door.
  6: <>
    <rect width="400" height="260" fill="#0e1612" />
    <path d="M0 0 H400 V260 H340 C340 120 290 60 200 60 C110 60 60 120 60 260 H0 Z" fill="#1e2b24" />
    {range(9).map((i) => <polygon key={i} points={`${20 + i * 45},0 ${34 + i * 45},${30 + (i % 3) * 14} ${48 + i * 45},0`} fill="#2a3b31" />)}
    <rect x="170" y="130" width="60" height="96" rx="30" fill="#0a0f0c" stroke="#5fd3a8" strokeWidth="3" />
    <text x="200" y="190" textAnchor="middle" fontSize="28" fontWeight="900" fill="#5fd3a8">?</text>
    {[90, 310].map((x) => <g key={x}><rect x={x - 3} y="120" width="6" height="40" fill="#6b4a2a" /><path className="bs-flame" d={`M${x} 98 C${x + 12} 112 ${x + 8} 124 ${x} 124 C${x - 8} 124 ${x - 12} 112 ${x} 98 Z`} fill="#ffb347" /><circle className="bs-glow" cx={x} cy="116" r="26" fill="#ffb347" opacity=".18" /></g>)}
    {[[40, 230], [360, 236], [120, 244]].map(([x, y], i) => <polygon key={i} className="bs-glint" style={delay(i * 0.9)} points={`${x},${y - 26} ${x + 9},${y} ${x - 9},${y}`} fill="#5fd3a8" opacity=".8" />)}
    <g className="bs-eyes"><circle cx="186" cy="100" r="3" fill="#ffcb47" /><circle cx="214" cy="100" r="3" fill="#ffcb47" /></g>
  </>,
  // 7. The school zone: a road with moving lane marks, a 50 sign, cars, and a speed camera flash.
  7: <>
    <rect width="400" height="260" fill="#16222c" />
    <rect x="0" y="170" width="400" height="90" fill="#2a2f36" />
    <g className="bs-lanes">{range(8).map((i) => <rect key={i} x={i * 60} y="212" width="34" height="6" fill="#e9e3c8" />)}</g>
    <rect x="60" y="60" width="6" height="110" fill="#8a929c" />
    <rect x="34" y="40" width="58" height="58" rx="6" fill="#ffd23f" stroke="#000" strokeWidth="3" />
    <text x="63" y="64" textAnchor="middle" fontSize="11" fontWeight="900" fill="#000">SCHOOL</text>
    <circle cx="63" cy="80" r="13" fill="#fff" stroke="#e8213c" strokeWidth="4" /><text x="63" y="85" textAnchor="middle" fontSize="12" fontWeight="900" fill="#000">50</text>
    <rect x="300" y="60" width="6" height="110" fill="#8a929c" />
    <rect x="286" y="52" width="40" height="24" rx="4" fill="#3a4250" stroke="#000" strokeWidth="2" /><circle cx="296" cy="64" r="6" fill="#0b0e13" />
    <circle className="bs-flash" cx="296" cy="64" r="16" fill="#fff" />
    <g className="bs-car">{[0, 1].map((i) => <g key={i} transform={`translate(${i * 230} 0)`}><rect x="0" y="182" width="74" height="22" rx="6" fill={i ? '#72dcff' : '#ff6f94'} /><rect x="14" y="170" width="40" height="16" rx="5" fill={i ? '#4fa8cc' : '#cc4f74'} /><circle cx="16" cy="206" r="7" fill="#111" /><circle cx="58" cy="206" r="7" fill="#111" /></g>)}</g>
  </>,
  // 8. The medal ceremony: a 1-2-3 podium, hanging medals, spotlights, falling confetti.
  8: <>
    <rect width="400" height="260" fill="#1d1426" />
    <polygon className="bs-beam" points="200,0 150,260 250,260" fill="#ffe08a" opacity=".12" />
    <polygon className="bs-beam bs-beam--b" points="80,0 40,260 130,260" fill="#ffe08a" opacity=".08" />
    {[[150, 150, 100, '#ffc246', '1'], [80, 180, 70, '#c3cad6', '2'], [250, 196, 70, '#d48a52', '3']].map(([x, y, w, color, place]) => <g key={place as string}>
      <rect x={x as number} y={y as number} width={w as number} height={260 - (y as number)} fill="#3b2c4f" stroke="#000" strokeWidth="2" />
      <text x={(x as number) + (w as number) / 2} y={(y as number) + 36} textAnchor="middle" fontSize="26" fontWeight="900" fill={color as string}>{place}</text>
    </g>)}
    {[[200, 110, '#ffc246'], [115, 140, '#c3cad6'], [285, 156, '#d48a52']].map(([x, y, color], i) => <g key={i} className="bs-swing" style={{ ...delay(i * 0.4), transformOrigin: `${x}px ${(y as number) - 30}px` }}><path d={`M${(x as number) - 8} ${(y as number) - 30} L${x} ${(y as number) - 12} L${(x as number) + 8} ${(y as number) - 30}`} stroke="#e8213c" strokeWidth="4" fill="none" /><circle cx={x as number} cy={y as number} r="12" fill={color as string} stroke="#000" strokeWidth="2" /></g>)}
    {range(14).map((i) => <rect key={i} className="bs-confetti" style={delay(i * 0.32)} x={14 + i * 28} y="-10" width="6" height="10" fill={['#ffd23f', '#ff7aa2', '#72dcff', '#7dffab'][i % 4]} />)}
  </>,
  // 9. The online shop: a browser window with product cards, swinging price tags, a rolling cart.
  9: <>
    <rect width="400" height="260" fill="#26142a" />
    <rect x="30" y="20" width="340" height="170" rx="10" fill="#fff4f8" stroke="#000" strokeWidth="3" />
    <rect x="30" y="20" width="340" height="24" rx="10" fill="#ff8fb8" />
    {[46, 60, 74].map((x) => <circle key={x} cx={x} cy="32" r="5" fill="#fff" />)}
    <text className="bs-flicker" x="300" y="38" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff">SALE</text>
    {range(3).map((i) => <g key={i} transform={`translate(${56 + i * 104} 58)`}>
      <rect width="84" height="112" rx="8" fill="#ffd2e4" stroke="#cf5486" strokeWidth="2" />
      <rect x="14" y="12" width="56" height="50" rx="6" fill={['#72dcff', '#b9f352', '#ffd23f'][i]} />
      <g className="bs-swing" style={{ ...delay(i * 0.5), transformOrigin: '60px 70px' }}><rect x="44" y="72" width="34" height="18" rx="4" fill="#e8213c" /><text x="61" y="85" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">-10</text></g>
    </g>)}
    <g className="bs-cart"><path d="M0 214 H14 L24 242 H66 L74 220 H20" stroke="#ffd2e4" strokeWidth="4" fill="none" strokeLinejoin="round" /><circle cx="30" cy="250" r="5" fill="#ffd2e4" /><circle cx="60" cy="250" r="5" fill="#ffd2e4" /></g>
  </>,
  // 10. The final report card: a chalkboard of grades, a ticking clock, flying papers.
  10: <>
    <rect width="400" height="260" fill="#2a1712" />
    <rect x="30" y="24" width="250" height="150" rx="6" fill="#1f3d2f" stroke="#7a4b22" strokeWidth="8" />
    <text x="54" y="62" fontSize="20" fontWeight="700" fill="#e9f4ec" opacity=".85">9.5 → Excellent</text>
    <text x="54" y="94" fontSize="20" fontWeight="700" fill="#e9f4ec" opacity=".85">7.0 → Approved</text>
    <text x="54" y="126" fontSize="20" fontWeight="700" fill="#e9f4ec" opacity=".85">5.0 → Recovery</text>
    <text className="bs-flicker" x="54" y="158" fontSize="20" fontWeight="700" fill="#ffe066">4.9 → ?</text>
    <circle cx="336" cy="66" r="38" fill="#fff6e8" stroke="#7a4b22" strokeWidth="6" />
    <rect className="bs-hand-slow" x="334" y="40" width="4" height="28" rx="2" fill="#2a1712" style={{ transformOrigin: '336px 66px' }} />
    <rect className="bs-hand" x="335" y="34" width="2" height="34" rx="1" fill="#e8213c" style={{ transformOrigin: '336px 66px' }} />
    {range(4).map((i) => <g key={i} className="bs-paper" style={delay(i * 1.1)}><rect x={60 + i * 80} y="270" width="30" height="38" rx="2" fill="#fffdf6" transform={`rotate(${i * 13 - 20} ${75 + i * 80} 289)`} /></g>)}
  </>,
}

export function BossScene({ bossId }: { bossId: number }) {
  return <svg className={`ba-scene ba-scene--${bossId}`} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{scenes[bossId]}</svg>
}
