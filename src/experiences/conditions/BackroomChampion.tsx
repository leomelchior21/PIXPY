import { Trophy } from 'lucide-react'
import { championGates } from '../../lib/backroomEngine'
import './backroomChampion.css'

export function BackroomChampionBadge() {
  return <span className="br-badge br-badge--champion"><Trophy size={18} /> BACKROOM CHAMPION</span>
}

export function BackroomChampionAward({ celebrate = false }: { celebrate?: boolean }) {
  return <aside className={`br-champion-award ${celebrate ? 'br-champion-award--celebrate' : ''}`} role={celebrate ? 'status' : undefined}>
    <Trophy size={38} />
    <div><small>{celebrate ? 'CHAMPION UNLOCKED' : 'YOUR EARNED TITLE'}</small><strong>BACKROOM CHAMPION</strong><p>{championGates} gates cleared in one run.</p>{celebrate && <span>Keep running. The pace keeps climbing.</span>}</div>
  </aside>
}
