/**
 * The finale of every repair: a monkey misses the nail twice, then drives it home,
 * and the last bit of the repair bar fills. Pure SVG and CSS, about 3.4 seconds.
 */
export function MonkeyFix({ last }: { last: boolean }) {
  return <div className="mk" aria-hidden="true">
    <svg className="mk__scene" viewBox="0 0 340 210">
      {/* The nail sits partly inside the plank; the plank is drawn after it so it hides the buried part. */}
      <g className="mk-nail">
        <rect x="238" y="115" width="4" height="44" rx="1" fill="#aab1bb" />
        <rect x="230" y="110" width="20" height="6" rx="2" fill="#d5dae1" stroke="#3a3f4a" strokeWidth="1.5" />
      </g>
      <rect x="170" y="150" width="150" height="44" rx="4" fill="#b07a45" stroke="#5e3a1f" strokeWidth="2" />
      <path d="M176 162 H312 M176 176 H300 M190 186 H316" stroke="#8a5a30" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <g className="mk-monkey">
        <path d="M80 176 C52 182 40 152 60 140 C72 133 82 146 70 151" fill="none" stroke="#7a4b22" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="84" cy="190" rx="12" ry="7" fill="#6f4520" />
        <ellipse cx="116" cy="190" rx="12" ry="7" fill="#6f4520" />
        <ellipse cx="100" cy="160" rx="30" ry="30" fill="#8b5a2b" />
        <ellipse cx="100" cy="166" rx="18" ry="20" fill="#e2b98f" />
        <ellipse cx="76" cy="160" rx="8" ry="16" fill="#8b5a2b" transform="rotate(18 76 160)" />
        <circle cx="70" cy="88" r="12" fill="#8b5a2b" /><circle cx="70" cy="88" r="7" fill="#e2b98f" />
        <circle cx="130" cy="88" r="12" fill="#8b5a2b" /><circle cx="130" cy="88" r="7" fill="#e2b98f" />
        <circle cx="100" cy="92" r="30" fill="#8b5a2b" />
        <ellipse cx="100" cy="103" rx="21" ry="15" fill="#e2b98f" />
        <ellipse cx="91" cy="89" rx="10" ry="11" fill="#e2b98f" />
        <ellipse cx="109" cy="89" rx="10" ry="11" fill="#e2b98f" />
        <g className="mk-eyes">
          <circle cx="92" cy="90" r="4" fill="#1b1d2a" /><circle cx="93.4" cy="88.6" r="1.3" fill="#fff" />
          <circle cx="108" cy="90" r="4" fill="#1b1d2a" /><circle cx="109.4" cy="88.6" r="1.3" fill="#fff" />
        </g>
        <ellipse cx="100" cy="100" rx="3.5" ry="2.2" fill="#5a3412" />
        <path className="mk-mouth" d="M92 107 Q100 114 108 107" fill="none" stroke="#5a3412" strokeWidth="2.5" strokeLinecap="round" />
        <path className="mk-sweat" d="M134 64 C138 70 140 74 136 77 C132 79 129 75 131 71 Z" fill="#7fd0ff" />
        {/* The hammer arm turns around the shoulder at (122, 128). */}
        <g className="mk-arm">
          <rect x="120" y="123" width="40" height="10" rx="5" fill="#8b5a2b" />
          <rect x="158" y="125" width="82" height="6" rx="3" fill="#a06a35" />
          <circle cx="160" cy="128" r="7" fill="#e2b98f" />
          <rect x="230" y="112" width="20" height="32" rx="3" fill="#5d6470" stroke="#2a2d36" strokeWidth="2" />
          <rect x="233" y="115" width="5" height="26" rx="2" fill="#8d95a3" />
        </g>
      </g>
      <g className="mk-hit mk-hit--one"><path d="M212 128 l5 10 11 -3 -7 9 8 8 -11 -1 -2 11 -6 -9 -10 5 4 -10 -9 -7 11 -1 z" fill="#ffe066" stroke="#1b1d2a" strokeWidth="1.5" /><text x="196" y="122">BONK!</text></g>
      <g className="mk-hit mk-hit--two"><path d="M264 128 l5 10 11 -3 -7 9 8 8 -11 -1 -2 11 -6 -9 -10 5 4 -10 -9 -7 11 -1 z" fill="#ff8fa1" stroke="#1b1d2a" strokeWidth="1.5" /><text x="250" y="122">OOPS!</text></g>
      <g className="mk-hit mk-hit--three">
        <path d="M240 100 v-22 M222 106 l-14 -12 M258 106 l14 -12 M216 120 h-18 M264 120 h18" stroke="#ffe066" strokeWidth="4" strokeLinecap="round" />
        <text x="218" y="66">DING!</text>
      </g>
    </svg>
    <div className="mk__bar"><span className="mk__fill" /><b>REPAIRED 100%</b></div>
    <p className="mk__bubble">{last ? 'Fixed it! Every machine in the shop works again!' : 'Fixed it! On to the next machine?'}</p>
  </div>
}
