import { Award, Crown, Lock, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { bossBadges, type BadgeShape, type BossBadge } from '../../data/bossBadges'
import { conditionBosses } from '../../data/conditionBosses'

function polygon(sides: number, radius: number, turn = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = turn + (i / sides) * Math.PI * 2
    return `${(50 + Math.cos(angle) * radius).toFixed(1)},${(50 + Math.sin(angle) * radius).toFixed(1)}`
  }).join(' ')
}

function star(points: number, outer: number, inner: number) {
  return Array.from({ length: points * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2
    const radius = i % 2 === 0 ? outer : inner
    return `${(50 + Math.cos(angle) * radius).toFixed(1)},${(50 + Math.sin(angle) * radius).toFixed(1)}`
  }).join(' ')
}

const shapes: Record<BadgeShape, string> = {
  circle: 'M50 4 A46 46 0 1 1 49.9 4 Z',
  hexagon: `M${polygon(6, 47, 0)}Z`,
  shield: 'M50 3 L91 17 V48 C91 73 72 90 50 97 C28 90 9 73 9 48 V17 Z',
  star: `M${star(5, 48, 26)}Z`,
  diamond: `M${polygon(4, 48)}Z`,
  octagon: `M${polygon(8, 47, -Math.PI / 8)}Z`,
  drop: 'M50 3 C66 25 88 44 88 62 A38 38 0 0 1 12 62 C12 44 34 25 50 3 Z',
  burst: `M${star(8, 48, 36)}Z`,
  pentagon: `M${polygon(5, 48)}Z`,
  crest: `M${star(6, 48, 33)}Z`,
}

/** A badge drawn as SVG: a metal rim in the boss's accent colour around a face in its body colour. */
export function BadgeArt({ badge, size, locked = false }: { badge: BossBadge; size: number; locked?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const boss = conditionBosses.find((item) => item.id === badge.id)!
  const Icon = badge.icon
  const d = shapes[badge.shape]
  return <span className={`bb-art ${locked ? 'is-locked' : ''}`} style={{ width: size, height: size, '--icon': `${Math.round(size * 0.36)}px` } as CSSProperties} aria-hidden="true">
    <svg className="bb-art__shape" viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`rim${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={locked ? '#34374a' : '#fff6d8'} />
          <stop offset=".35" stopColor={locked ? '#23252f' : boss.palette.accent} />
          <stop offset=".7" stopColor={locked ? '#191a22' : boss.palette.shade} />
          <stop offset="1" stopColor={locked ? '#2a2d3d' : '#fff6d8'} />
        </linearGradient>
        <radialGradient id={`face${uid}`} cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor={locked ? '#1d1f29' : boss.palette.light} />
          <stop offset=".45" stopColor={locked ? '#15161d' : boss.palette.body} />
          <stop offset="1" stopColor={locked ? '#0e0f14' : boss.palette.shade} />
        </radialGradient>
      </defs>
      <path d={d} fill={`url(#rim${uid})`} stroke="#14151c" strokeWidth="3" strokeLinejoin="round" />
      <path d={d} transform="translate(50 50) scale(.76) translate(-50 -50)" fill={`url(#face${uid})`} stroke="#00000066" strokeWidth="2.5" strokeLinejoin="round" />
      {!locked && <ellipse cx="38" cy="28" rx="20" ry="8" fill="#ffffff" opacity=".32" transform="rotate(-28 38 28)" />}
    </svg>
    {locked ? <b className="bb-art__mystery">?</b> : <Icon className="bb-art__icon" strokeWidth={2.4} />}
  </span>
}

/**
 * Badge 11, the Master Badge: a gold twelve-point star around a ring with one jewel per boss.
 * Locked, it is a dark star whose sockets light up as the ten badges are earned.
 */
export function MasterBadgeArt({ size, earned, unlocked }: { size: number; earned: number[]; unlocked: boolean }) {
  const uid = useId().replace(/:/g, '')
  const Icon = unlocked ? Crown : Lock
  return <span className={`bb-art bb-master-art ${unlocked ? 'is-unlocked' : 'is-locked'}`} style={{ width: size, height: size, '--icon': `${Math.round(size * 0.3)}px` } as CSSProperties} aria-hidden="true">
    <svg className="bb-art__shape" viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`mrim${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={unlocked ? '#fff6c8' : '#3a3d4e'} />
          <stop offset=".4" stopColor={unlocked ? '#ffc93d' : '#24262f'} />
          <stop offset=".75" stopColor={unlocked ? '#b8740f' : '#17181f'} />
          <stop offset="1" stopColor={unlocked ? '#fff2b0' : '#2e3140'} />
        </linearGradient>
        <radialGradient id={`mcore${uid}`} cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor={unlocked ? '#4a3a9a' : '#1d1f29'} />
          <stop offset="1" stopColor={unlocked ? '#140c3a' : '#0c0d12'} />
        </radialGradient>
      </defs>
      <path d={`M${star(12, 49, 40)}Z`} fill={`url(#mrim${uid})`} stroke="#14151c" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="36" fill="#14151c" />
      {conditionBosses.map((boss, i) => {
        const has = earned.includes(boss.id)
        const from = (i / 10) * Math.PI * 2 - Math.PI / 2, to = ((i + 1) / 10) * Math.PI * 2 - Math.PI / 2 - 0.06
        const arc = (r: number, a: number) => `${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`
        return <path key={boss.id} className={`bb-master-art__gem ${has ? 'is-lit' : ''}`} style={{ '--i': i } as CSSProperties}
          d={`M${arc(34, from)} A34 34 0 0 1 ${arc(34, to)} L${arc(26, to)} A26 26 0 0 0 ${arc(26, from)} Z`}
          fill={has ? boss.palette.body : '#262833'} stroke={has ? boss.palette.light : '#30333f'} strokeWidth="1" />
      })}
      <circle cx="50" cy="50" r="24" fill={`url(#mcore${uid})`} stroke={unlocked ? '#ffe066' : '#3a3d4e'} strokeWidth="2" />
      {unlocked && <ellipse cx="38" cy="26" rx="16" ry="6" fill="#fff" opacity=".35" transform="rotate(-28 38 26)" />}
    </svg>
    <Icon className="bb-art__icon bb-master-art__icon" strokeWidth={2.4} />
  </span>
}

/** Every badge, earned or still waiting, in a velvet case. */
export function BadgeCase({ earned, arriving, onClose }: { earned: number[]; arriving?: number; onClose: () => void }) {
  const grid = useRef<HTMLOListElement>(null)
  // How far the arriving badge's slot sits from the middle of the case: the badge starts there, big, and drops in.
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const slot = grid.current?.querySelector('.is-arriving .bb-case__slot')
    if (!grid.current || !slot) return
    const box = grid.current.getBoundingClientRect(), place = slot.getBoundingClientRect()
    setStart({ x: box.left + box.width / 2 - (place.left + place.width / 2), y: box.top + box.height / 2 - (place.top + place.height / 2) })
  }, [arriving])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const count = bossBadges.filter((badge) => earned.includes(badge.id)).length
  const complete = count === bossBadges.length
  // When the tenth badge lands, all ten send their light into the Master Badge and forge it.
  const forgeNow = complete && arriving !== undefined
  const [forge, setForge] = useState<'idle' | 'charging' | 'forged'>(forgeNow ? 'idle' : 'forged')
  const [orbs, setOrbs] = useState<Array<{ id: number; x: number; y: number; dx: number; dy: number; color: string }>>([])
  const caseRef = useRef<HTMLDivElement>(null)
  const masterRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!forgeNow) return
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm) { setForge('forged'); return }
    const charge = window.setTimeout(() => {
      const box = caseRef.current?.getBoundingClientRect(), target = masterRef.current?.getBoundingClientRect()
      if (box && target && grid.current) {
        const tx = target.left + target.width / 2 - box.left, ty = target.top + target.height / 2 - box.top
        setOrbs([...grid.current.querySelectorAll('.bb-case__slot')].map((slot, i) => {
          const r = slot.getBoundingClientRect(), x = r.left + r.width / 2 - box.left, y = r.top + r.height / 2 - box.top
          return { id: i, x, y, dx: tx - x, dy: ty - y, color: conditionBosses[i].palette.body }
        }))
      }
      setForge('charging')
    }, 1800)
    const done = window.setTimeout(() => setForge('forged'), 1800 + 10 * 90 + 700)
    return () => { window.clearTimeout(charge); window.clearTimeout(done) }
  }, [forgeNow])
  const masterLit = forge === 'forged' && complete
  return <div className="bb-backdrop" onClick={onClose}>
    <div className="bb-case" ref={caseRef} role="dialog" aria-modal="true" aria-labelledby="bb-case-title" onClick={(event) => event.stopPropagation()}>
      <button className="bb-close" onClick={onClose} aria-label="Close the badge case"><X size={18} /></button>
      <header><Award size={26} /><div><h2 id="bb-case-title">Badge case</h2><p>{count} of {bossBadges.length} badges · one for every boss you defeat</p></div>{arriving && <span className="bb-case__new" key={arriving}>+1 BADGE</span>}</header>
      <ol className="bb-case__grid" ref={grid}>{bossBadges.map((badge, i) => {
        const has = earned.includes(badge.id)
        const boss = conditionBosses[i]
        const landing = badge.id === arriving
        return <li key={badge.id} className={`${has ? 'is-earned' : ''} ${landing ? 'is-arriving' : ''}`} style={{ '--i': i } as CSSProperties}>
          <span className="bb-case__slot">
            {landing && <BadgeArt badge={badge} size={74} locked />}
            {landing ? start && <span className="bb-case__drop" style={{ '--fx': `${start.x}px`, '--fy': `${start.y}px` } as CSSProperties}><BadgeArt badge={badge} size={74} /></span> : <BadgeArt badge={badge} size={74} locked={!has} />}
            {landing && <span className="bb-case__ring" aria-hidden="true" />}
          </span>
          <b>{has ? badge.name : '???'}</b>
          <small>{has ? badge.skill : `Defeat boss ${String(badge.id).padStart(2, '0')}`}</small>
          {has && <i>{boss.name}</i>}
        </li>
      })}</ol>
      <section className={`bb-master ${masterLit ? 'is-complete' : ''} ${forge === 'charging' ? 'is-charging' : ''} ${forgeNow && masterLit ? 'is-forged' : ''}`} aria-label="Master badge">
        <span className="bb-master__slot" ref={masterRef}>
          {masterLit && <span className="bb-master__rays" aria-hidden="true" />}
          <MasterBadgeArt key={masterLit ? 'lit' : 'dark'} size={92} earned={forge === 'idle' && forgeNow ? earned.filter((id) => id !== arriving) : earned} unlocked={masterLit} />
          {forgeNow && masterLit && <span className="bb-master__flash" aria-hidden="true" />}
        </span>
        <div className="bb-master__copy">
          <small>BADGE 11 · MASTER</small>
          <b>{masterLit ? 'Conditions Master' : 'Master Badge'}</b>
          <p>{masterLit ? 'All ten bosses beaten: every decision, every edge case.' : complete ? 'All ten badges are here. The Master Badge is forming…' : `Earn all ten badges to forge it. ${count} of ${bossBadges.length} so far.`}</p>
          <div className="bb-master__pips" aria-hidden="true">{conditionBosses.map((boss, i) => <i key={boss.id} className={earned.includes(boss.id) ? 'is-lit' : ''} style={{ '--c': boss.palette.body, '--i': i } as CSSProperties} />)}</div>
        </div>
        {forgeNow && masterLit && <span className="bb-master__new">+ MASTER BADGE</span>}
      </section>
      {forge === 'charging' && orbs.map((orb) => <span key={orb.id} className="bb-orb" aria-hidden="true" style={{ left: orb.x, top: orb.y, '--dx': `${orb.dx}px`, '--dy': `${orb.dy}px`, '--c': orb.color, animationDelay: `${orb.id * 90}ms` } as CSSProperties} />)}
    </div>
  </div>
}

/** The award scene the first time a boss falls. */
export function BadgeAward({ badge, total, onClose }: { badge: BossBadge; total: number; onClose: () => void }) {
  const boss = conditionBosses.find((item) => item.id === badge.id)!
  return <div className="bb-award-backdrop">
    <div className="bb-award" role="dialog" aria-modal="true" aria-labelledby="bb-award-title" style={{ '--glow': boss.palette.accent, '--body': boss.palette.body } as CSSProperties}>
      <div className="bb-award__rays" aria-hidden="true" />
      <div className="bb-award__sparks" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--a': `${i * 22.5}deg`, '--d': `${700 + (i % 4) * 90}ms` } as CSSProperties} />)}</div>
      <p className="bb-award__kicker">{boss.name.toUpperCase()} DEFEATED</p>
      <div className="bb-award__badge"><BadgeArt badge={badge} size={170} /><span className="bb-award__sheen" aria-hidden="true" /></div>
      <h2 id="bb-award-title">{badge.name}</h2>
      <p className="bb-award__skill">{badge.skill}</p>
      <p className="bb-award__count"><Award size={15} /> {total} / {bossBadges.length} BADGES</p>
      <button className="bb-award__button" autoFocus onClick={onClose}>ADD TO BADGE CASE</button>
    </div>
  </div>
}
