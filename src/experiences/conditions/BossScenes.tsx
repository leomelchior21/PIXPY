import type { CSSProperties, ReactNode } from 'react'

// A place for every boss fight: the club door, the lab, the vault… Each scene has a back wall, a floor
// in perspective and one key prop right behind the boss (centre x ≈ 283, standing on the horizon at
// y ≈ 210), so the boss stands in the scene instead of floating over a backdrop. Decoration only.

const range = (count: number) => Array.from({ length: count }, (_, i) => i)
const delay = (seconds: number) => ({ animationDelay: `${seconds}s` }) as CSSProperties
const HORIZON = 210

/** A floor from the horizon down, with perspective lines running to a vanishing point. */
function Floor({ fill, line, glow }: { fill: string; line: string; glow?: string }) {
  return <g>
    <rect y={HORIZON} width="400" height={400 - HORIZON} fill={fill} />
    {glow && <ellipse cx="283" cy={HORIZON + 30} rx="150" ry="40" fill={glow} opacity=".35" />}
    {range(13).map((i) => <line key={`v${i}`} x1={200 + (i - 6) * 12} y1={HORIZON} x2={200 + (i - 6) * 110} y2="400" stroke={line} strokeWidth="1.5" opacity=".5" />)}
    {[232, 262, 304, 360].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke={line} strokeWidth="1.5" opacity=".45" />)}
    <rect y={HORIZON - 2} width="400" height="4" fill="#000" opacity=".35" />
  </g>
}

const scenes: Record<number, ReactNode> = {
  // 1. The club door: the boss guards the doorway under a neon sign.
  1: <>
    <rect width="400" height={HORIZON} fill="#2a1430" />
    {range(10).map((row) => range(11).map((col) => <rect key={`${row}-${col}`} x={col * 40 - (row % 2) * 20} y={row * 21} width="38" height="19" fill={(row + col) % 3 ? '#4a1f3e' : '#421b37'} />))}
    <polygon className="bs-beam" points="283,0 230,210 300,210" fill="#ff5fd2" opacity=".18" />
    <polygon className="bs-beam bs-beam--b" points="283,0 266,210 336,210" fill="#5ff0ff" opacity=".14" />
    <rect x="34" y="62" width="74" height="96" rx="4" fill="#ffd23f" stroke="#000" strokeWidth="3" />
    <text x="71" y="102" textAnchor="middle" fontSize="22" fontWeight="900" fill="#2a1430">DJ</text>
    <text x="71" y="128" textAnchor="middle" fontSize="12" fontWeight="900" fill="#2a1430">TONIGHT</text>
    <rect x="215" y="56" width="136" height="156" rx="6" fill="#140a18" stroke="#ff9bd8" strokeWidth="4" />
    <rect x="227" y="68" width="112" height="144" fill="url(#bs-club-door)" />
    <text className="bs-flicker" x="283" y="44" textAnchor="middle" fontSize="32" fontWeight="900" fill="#ff7ae0" stroke="#ffe0f6" strokeWidth="1.2">CLUB</text>
    <Floor fill="#1b1220" line="#5a2f55" glow="#ff7ae0" />
    {[196, 370].map((x) => <g key={x}><rect x={x - 4} y="196" width="8" height="46" fill="#d9b44a" /><circle cx={x} cy="194" r="7" fill="#ffd36b" /></g>)}
    <path className="bs-rope" d="M196 206 Q220 236 232 214 M334 214 Q346 236 370 206" stroke="#c4123a" strokeWidth="6" fill="none" strokeLinecap="round" />
    {range(4).map((i) => <text key={i} className="bs-note" style={delay(i * 0.9)} x={250 + i * 22} y="130" fontSize="20" fill="#ffd36b">♪</text>)}
    <defs><linearGradient id="bs-club-door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1450" /><stop offset="1" stopColor="#ff7ae0" stopOpacity=".55" /></linearGradient></defs>
  </>,
  // 2. The overheated lab: a giant wall fan behind the boss, flasks bubbling, a thermometer climbing.
  2: <>
    <rect width="400" height={HORIZON} fill="#123040" />
    {range(10).map((i) => <line key={i} x1={i * 40} y1="0" x2={i * 40} y2={HORIZON} stroke="#1c4256" strokeWidth="2" />)}
    {range(5).map((i) => <line key={i} x1="0" y1={i * 42} x2="400" y2={i * 42} stroke="#1c4256" strokeWidth="2" />)}
    <circle cx="283" cy="122" r="78" fill="#0a1a24" stroke="#9fd8ff" strokeWidth="6" />
    <g className="bs-spin" style={{ transformOrigin: '283px 122px' }}>{range(4).map((i) => <path key={i} d="M283 122 C270 80 300 56 310 70 C318 84 300 104 283 122 Z" fill="#7fc8f0" transform={`rotate(${i * 90} 283 122)`} />)}</g>
    <circle cx="283" cy="122" r="12" fill="#d8f1ff" stroke="#0a1a24" strokeWidth="3" />
    {range(8).map((i) => <line key={i} x1="283" y1="122" x2={283 + Math.cos(i * Math.PI / 4) * 78} y2={122 + Math.sin(i * Math.PI / 4) * 78} stroke="#9fd8ff" strokeWidth="2" opacity=".6" />)}
    <rect x="20" y="70" width="140" height="6" fill="#4b6b80" /><rect x="20" y="132" width="140" height="6" fill="#4b6b80" />
    {[[38, 70, '#7dffab'], [76, 70, '#ff7aa2'], [118, 70, '#ffd34e'], [48, 132, '#72dcff'], [100, 132, '#b49cff'], [140, 132, '#7dffab']].map(([x, y, color], i) => <g key={i}>
      <path d={`M${x as number - 9} ${y as number} V${y as number - 18} L${x as number - 4} ${y as number - 26} V${y as number - 34} H${x as number + 4} V${y as number - 26} L${x as number + 9} ${y as number - 18} V${y as number} Z`} fill={color as string} opacity=".85" stroke="#d8f1ff" strokeWidth="1.5" />
      {range(3).map((b) => <circle key={b} className="bs-bubble" style={delay(b * 0.7 + i * 0.3)} cx={x as number - 3 + b * 3} cy={y as number - 6} r="2" fill="#fff" />)}
    </g>)}
    <rect x="374" y="50" width="16" height="120" rx="8" fill="#e8f4fb" stroke="#0a1a24" strokeWidth="3" />
    <rect className="bs-mercury" x="379" y="64" width="6" height="96" rx="3" fill="#ff4d4d" />
    <rect x="186" y="20" width="48" height="26" rx="4" fill="#ffd23f" stroke="#000" strokeWidth="2" /><text x="210" y="38" textAnchor="middle" fontSize="13" fontWeight="900" fill="#000">HOT!</text>
    <Floor fill="#cfdde4" line="#8aa3b0" glow="#ff9b5e" />
    {range(3).map((i) => <path key={i} className="bs-heat" style={delay(i * 0.6)} d={`M${330 + i * 22} 250 q8 -12 0 -24 q-8 -12 0 -24`} stroke="#ff7a3d" strokeWidth="3" fill="none" opacity=".5" />)}
  </>,
  // 3. The locked vault: the boss blocks a huge round vault door, lasers sweep the floor.
  3: <>
    <rect width="400" height={HORIZON} fill="#1e242e" />
    {range(5).map((i) => <rect key={i} x={i * 80 + 2} y="4" width="76" height={HORIZON - 8} rx="3" fill="#262e3a" stroke="#141921" strokeWidth="2" />)}
    <circle cx="283" cy="126" r="92" fill="#3a4250" stroke="#0b0e13" strokeWidth="8" />
    <circle cx="283" cy="126" r="72" fill="#5b6575" stroke="#2a313c" strokeWidth="4" />
    {range(12).map((i) => <circle key={i} cx={283 + Math.cos(i * Math.PI / 6) * 82} cy={126 + Math.sin(i * Math.PI / 6) * 82} r="5" fill="#a9b2bf" />)}
    <g className="bs-dial" style={{ transformOrigin: '283px 126px' }}>
      <circle cx="283" cy="126" r="26" fill="#a9b2bf" stroke="#0b0e13" strokeWidth="3" />
      {range(3).map((i) => <rect key={i} x="280" y="88" width="6" height="76" rx="3" fill="#d6dce5" transform={`rotate(${i * 60} 283 126)`} />)}
    </g>
    <rect x="40" y="60" width="70" height="44" rx="4" fill="#0b0e13" stroke="#5b6575" strokeWidth="3" />
    <text className="bs-flicker" x="75" y="88" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ff3b5c">LOCKED</text>
    <Floor fill="#2b313b" line="#4a5564" />
    {range(3).map((i) => <line key={i} className="bs-laser" style={delay(i * 0.6)} x1="0" y1={236 + i * 28} x2="400" y2={214 + i * 40} stroke="#ff2a4a" strokeWidth="2.5" />)}
    {[[350, 214], [376, 214], [363, 202]].map(([x, y], i) => <g key={i}><rect x={x - 13} y={y} width="26" height="12" rx="2" fill="#ffc246" stroke="#7a5212" strokeWidth="2" /><rect className="bs-glint" style={delay(i * 0.8)} x={x - 9} y={y + 3} width="6" height="3" fill="#fff" /></g>)}
  </>,
  // 4. The hungry arcade: the boss stands at a big cabinet, more machines blink behind.
  4: <>
    <rect width="400" height={HORIZON} fill="#1c1030" />
    <text className="bs-flicker" x="96" y="44" textAnchor="middle" fontSize="28" fontWeight="900" fill="#ffd23f" stroke="#ff7aa2" strokeWidth="1.5">ARCADE</text>
    {range(3).map((i) => <g key={i} transform={`translate(${16 + i * 62} 92)`}>
      <path d="M0 118 V18 L8 0 H44 L52 18 V118 Z" fill={['#3b1a5a', '#1a3b5a', '#5a1a3b'][i]} stroke="#000" strokeWidth="2" />
      <rect className="bs-screen" style={delay(i * 0.35)} x="8" y="22" width="36" height="28" fill={['#7dffab', '#72dcff', '#ff7aa2'][i]} />
    </g>)}
    <path d="M222 212 V70 L236 46 H330 L344 70 V212 Z" fill="#ff5c9a" stroke="#000" strokeWidth="3" />
    <rect x="232" y="36" width="102" height="22" fill="#1b0f2a" stroke="#000" strokeWidth="2" />
    <text x="283" y="52" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ffe25c">COIN·3000</text>
    <rect className="bs-screen" x="240" y="78" width="86" height="64" fill="#72dcff" stroke="#000" strokeWidth="3" />
    <Floor fill="#22123a" line="#5a2f7a" glow="#ff5c9a" />
    {range(6).map((i) => <circle key={i} className="bs-coin" style={delay(i * 0.55)} cx={30 + i * 66} cy="-10" r="7" fill="#ffd34e" stroke="#b07a10" strokeWidth="2" />)}
  </>,
  // 5. The number splitter: a glowing % portal behind the boss, even numbers left, odd right.
  5: <>
    <rect width="400" height={HORIZON} fill="#140f30" />
    <circle className="bs-pulse" cx="283" cy="118" r="84" fill="none" stroke="#c3a6ff" strokeWidth="6" />
    <circle cx="283" cy="118" r="70" fill="#2a1f5a" opacity=".7" />
    <rect x="280" y="34" width="6" height="168" fill="#ebe0ff" opacity=".6" />
    <text x="283" y="138" textAnchor="middle" fontSize="52" fontWeight="900" fill="#ebe0ff" opacity=".35">%2</text>
    <text x="60" y="40" fontSize="18" fontWeight="900" fill="#72dcff">EVEN</text>
    <text x="340" y="40" fontSize="18" fontWeight="900" fill="#ff7aa2" textAnchor="end">ODD</text>
    <Floor fill="#120c2a" line="#6a4fe0" glow="#c3a6ff" />
    {[2, 4, 6, 8].map((n, i) => <text key={`e${n}`} className="bs-rise" style={delay(i * 0.9)} x={30 + (i % 2) * 70} y="230" fontSize="26" fontWeight="900" fill="#72dcff">{n}</text>)}
    {[1, 3, 5, 7].map((n, i) => <text key={`o${n}`} className="bs-rise" style={delay(i * 0.9 + 0.45)} x={360 - (i % 2) * 40} y="230" fontSize="26" fontWeight="900" fill="#ff7aa2">{n}</text>)}
  </>,
  // 6. The secret cave: the boss guards a stone door lit by two torches.
  6: <>
    <rect width="400" height={HORIZON} fill="#26402f" />
    <path d="M0 0 H400 V70 C330 40 240 30 160 52 C90 70 40 60 0 80 Z" fill="#1a2c22" />
    {range(9).map((i) => <polygon key={i} points={`${20 + i * 45},0 ${34 + i * 45},${26 + (i % 3) * 14} ${48 + i * 45},0`} fill="#3a5646" />)}
    <path d="M226 212 V110 C226 62 340 62 340 110 V212 Z" fill="#6a7d70" stroke="#0d1612" strokeWidth="5" />
    <path d="M242 212 V116 C242 82 324 82 324 116 V212 Z" fill="#17261e" />
    <text x="283" y="168" textAnchor="middle" fontSize="40" fontWeight="900" fill="#5fd3a8" className="bs-pulse">?</text>
    {[206, 360].map((x) => <g key={x}><rect x={x - 3} y="112" width="6" height="40" fill="#6b4a2a" /><path className="bs-flame" d={`M${x} 88 C${x + 12} 102 ${x + 8} 114 ${x} 114 C${x - 8} 114 ${x - 12} 102 ${x} 88 Z`} fill="#ffb347" /><circle className="bs-glow" cx={x} cy="106" r="30" fill="#ffb347" opacity=".2" /></g>)}
    <g className="bs-eyes"><circle cx="70" cy="110" r="3" fill="#ffcb47" /><circle cx="86" cy="110" r="3" fill="#ffcb47" /></g>
    <Floor fill="#33473b" line="#4f6a5a" glow="#ffb347" />
    {[[360, 236], [384, 250], [30, 222]].map(([x, y], i) => <polygon key={i} className="bs-glint" style={delay(i * 0.9)} points={`${x},${y - 24} ${x + 8},${y} ${x - 8},${y}`} fill="#5fd3a8" />)}
  </>,
  // 7. The school zone: the boss stands outside the school, cars pass on the road, the camera flashes.
  7: <>
    <rect width="400" height={HORIZON} fill="#2a3a5a" />
    <circle cx="70" cy="50" r="22" fill="#ffd96a" opacity=".85" />
    <rect x="200" y="70" width="166" height="142" fill="#c9734a" stroke="#000" strokeWidth="3" />
    <polygon points="190,72 283,30 376,72" fill="#8a3b28" stroke="#000" strokeWidth="3" />
    <circle cx="283" cy="56" r="11" fill="#fff6e8" stroke="#000" strokeWidth="2" /><rect className="bs-hand" x="282" y="47" width="2" height="10" fill="#000" style={{ transformOrigin: '283px 56px' }} />
    <rect x="236" y="84" width="94" height="18" fill="#ffd23f" stroke="#000" strokeWidth="2" /><text x="283" y="98" textAnchor="middle" fontSize="13" fontWeight="900" fill="#000">SCHOOL</text>
    {range(3).map((i) => <rect key={i} x={214 + i * 52} y="116" width="34" height="30" fill="#9fd8ff" stroke="#000" strokeWidth="2" />)}
    <rect x="58" y="96" width="6" height="116" fill="#8a929c" />
    <circle cx="61" cy="88" r="20" fill="#fff" stroke="#e8213c" strokeWidth="6" /><text x="61" y="94" textAnchor="middle" fontSize="16" fontWeight="900" fill="#000">50</text>
    <rect x="150" y="104" width="5" height="108" fill="#8a929c" /><rect x="138" y="96" width="30" height="18" rx="3" fill="#3a4250" stroke="#000" strokeWidth="2" /><circle className="bs-flash" cx="146" cy="105" r="14" fill="#fff" />
    <Floor fill="#3a3f47" line="#5a6270" />
    <g className="bs-lanes">{range(8).map((i) => <rect key={i} x={i * 60} y="226" width="34" height="5" fill="#e9e3c8" />)}</g>
    <g className="bs-car">{[0, 1].map((i) => <g key={i} transform={`translate(${i * 240} 0)`}><rect x="0" y="210" width="60" height="18" rx="5" fill={i ? '#72dcff' : '#ff6f94'} /><rect x="12" y="200" width="32" height="13" rx="4" fill={i ? '#4fa8cc' : '#cc4f74'} /><circle cx="14" cy="230" r="6" fill="#111" /><circle cx="48" cy="230" r="6" fill="#111" /></g>)}</g>
  </>,
  // 8. The medal ceremony: the boss stands on the top step of the podium under spotlights.
  8: <>
    <rect width="400" height={HORIZON} fill="#241830" />
    <path d="M0 0 H60 C50 80 70 160 40 210 H0 Z M400 0 H340 C350 80 330 160 360 210 H400 Z" fill="#a0162e" />
    <polygon className="bs-beam" points="283,0 230,210 336,210" fill="#ffe08a" opacity=".2" />
    <polygon className="bs-beam bs-beam--b" points="160,0 120,210 200,210" fill="#ffe08a" opacity=".12" />
    <rect x="243" y="150" width="80" height="62" fill="#4a3866" stroke="#000" strokeWidth="3" /><text x="283" y="190" textAnchor="middle" fontSize="28" fontWeight="900" fill="#ffc246">1</text>
    <rect x="171" y="170" width="72" height="42" fill="#3e2f58" stroke="#000" strokeWidth="3" /><text x="207" y="200" textAnchor="middle" fontSize="22" fontWeight="900" fill="#d6dce5">2</text>
    <rect x="323" y="180" width="72" height="32" fill="#3e2f58" stroke="#000" strokeWidth="3" /><text x="359" y="204" textAnchor="middle" fontSize="20" fontWeight="900" fill="#d48a52">3</text>
    {[[110, 70, '#ffc246'], [140, 80, '#d6dce5'], [80, 84, '#d48a52']].map(([x, y, color], i) => <g key={i} className="bs-swing" style={{ ...delay(i * 0.4), transformOrigin: `${x}px 0px` }}><line x1={x as number} y1="0" x2={x as number} y2={(y as number) - 12} stroke="#e8213c" strokeWidth="3" /><circle cx={x as number} cy={y as number} r="12" fill={color as string} stroke="#000" strokeWidth="2" /></g>)}
    <Floor fill="#5a3a24" line="#7a5233" glow="#ffe08a" />
    {range(14).map((i) => <rect key={i} className="bs-confetti" style={delay(i * 0.32)} x={14 + i * 28} y="-10" width="6" height="10" fill={['#ffd23f', '#ff7aa2', '#72dcff', '#7dffab'][i % 4]} />)}
  </>,
  // 9. The online shop: the boss stands in front of a giant shop window, a cart rolls by.
  9: <>
    <rect width="400" height={HORIZON} fill="#3a1838" />
    <text className="bs-flicker" x="80" y="56" textAnchor="middle" fontSize="30" fontWeight="900" fill="#ffd23f" stroke="#e8213c" strokeWidth="1.5">SALE</text>
    <rect x="198" y="34" width="176" height="178" rx="10" fill="#fff4f8" stroke="#000" strokeWidth="4" />
    <rect x="198" y="34" width="176" height="24" rx="10" fill="#ff8fb8" />
    {[212, 226, 240].map((x) => <circle key={x} cx={x} cy="46" r="5" fill="#fff" />)}
    {range(2).map((i) => <g key={i} transform={`translate(${210 + i * 82} 70)`}>
      <rect width="70" height="96" rx="8" fill="#ffd2e4" stroke="#cf5486" strokeWidth="2" />
      <rect x="10" y="10" width="50" height="44" rx="6" fill={['#72dcff', '#b9f352'][i]} />
      <g className="bs-swing" style={{ ...delay(i * 0.5), transformOrigin: '52px 60px' }}><rect x="34" y="62" width="32" height="18" rx="4" fill="#e8213c" /><text x="50" y="75" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">-10</text></g>
    </g>)}
    {range(3).map((i) => <rect key={i} x={20 + i * 52} y="110" width="40" height="60" rx="6" fill="#5a2a56" stroke="#000" strokeWidth="2" />)}
    <Floor fill="#4a2047" line="#7a3a74" glow="#ff8fb8" />
    <g className="bs-cart"><path d="M0 222 H12 L20 244 H56 L62 226 H16" stroke="#ffd2e4" strokeWidth="4" fill="none" strokeLinejoin="round" /><circle cx="24" cy="250" r="5" fill="#ffd2e4" /><circle cx="50" cy="250" r="5" fill="#ffd2e4" /></g>
  </>,
  // 10. The final report card: the boss stands before the chalkboard of grade rules.
  10: <>
    <rect width="400" height={HORIZON} fill="#3a2418" />
    <rect x="190" y="40" width="200" height="140" rx="6" fill="#1f3d2f" stroke="#7a4b22" strokeWidth="8" />
    <text x="206" y="74" fontSize="17" fontWeight="700" fill="#e9f4ec" opacity=".9">9 → Excellent</text>
    <text x="206" y="102" fontSize="17" fontWeight="700" fill="#e9f4ec" opacity=".9">7 → Approved</text>
    <text x="206" y="130" fontSize="17" fontWeight="700" fill="#e9f4ec" opacity=".9">5 → Recovery</text>
    <text className="bs-flicker" x="206" y="158" fontSize="17" fontWeight="700" fill="#ffe066">4.9 → ?</text>
    <circle cx="80" cy="70" r="34" fill="#fff6e8" stroke="#7a4b22" strokeWidth="6" />
    <rect className="bs-hand-slow" x="78" y="46" width="4" height="26" rx="2" fill="#2a1712" style={{ transformOrigin: '80px 70px' }} />
    <rect className="bs-hand" x="79" y="40" width="2" height="32" rx="1" fill="#e8213c" style={{ transformOrigin: '80px 70px' }} />
    <rect x="30" y="130" width="120" height="8" fill="#7a4b22" />{range(4).map((i) => <rect key={i} x={36 + i * 28} y={104 - (i % 2) * 6} width="20" height={26 + (i % 2) * 6} fill={['#e8213c', '#2b6fd6', '#5cd17d', '#ffd23f'][i]} />)}
    <Floor fill="#6a4428" line="#8a5a35" />
    {range(4).map((i) => <g key={i} className="bs-paper" style={delay(i * 1.1)}><rect x={40 + i * 90} y="300" width="26" height="34" rx="2" fill="#fffdf6" transform={`rotate(${i * 13 - 20} ${53 + i * 90} 317)`} /></g>)}
  </>,
}

export function BossScene({ bossId }: { bossId: number }) {
  return <svg className={`ba-scene ba-scene--${bossId}`} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{scenes[bossId]}</svg>
}
