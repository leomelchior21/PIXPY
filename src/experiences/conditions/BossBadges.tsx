import { Award, X } from 'lucide-react'
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
  return <div className="bb-backdrop" onClick={onClose}>
    <div className="bb-case" role="dialog" aria-modal="true" aria-labelledby="bb-case-title" onClick={(event) => event.stopPropagation()}>
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
