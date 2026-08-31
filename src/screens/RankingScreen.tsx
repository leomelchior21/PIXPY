import { Medal, Radio, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PixelAvatar } from '../components/PixelAvatar'
import { fetchRanking } from '../lib/supabase'
import type { RankingEntry, StudentProfile } from '../types'

interface RankingScreenProps {
  profile: StudentProfile
}

const previewRanking: RankingEntry[] = [
  { rank: 1, displayName: 'Nova P.', avatarId: 'nova', xp: 920, progress: 80, badges: 4 },
  { rank: 2, displayName: 'Pixel R.', avatarId: 'byte', xp: 840, progress: 75, badges: 3 },
  { rank: 3, displayName: 'Orbit K.', avatarId: 'orbit', xp: 790, progress: 65, badges: 4 },
  { rank: 4, displayName: 'Echo M.', avatarId: 'echo', xp: 710, progress: 60, badges: 2 },
  { rank: 5, displayName: 'Flux T.', avatarId: 'flux', xp: 650, progress: 55, badges: 3 },
]

export function RankingScreen({ profile }: RankingScreenProps) {
  const [scope, setScope] = useState<'class' | 'all'>('class')
  const [entries, setEntries] = useState<RankingEntry[]>(profile.isTeacher ? previewRanking : [])
  const [loading, setLoading] = useState(!profile.isTeacher)

  useEffect(() => {
    if (profile.isTeacher) return
    let active = true
    void fetchRanking(profile)
      .then((ranking) => { if (active) setEntries(ranking) })
      .catch(() => { if (active) setEntries([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profile])

  return (
    <main className="app-page ranking-screen">
      <section className="page-heading">
        <div>
          <p className="kicker">CLASS SIGNAL // FRIENDLY MODE</p>
          <h1>Lab <em>Ranking</em></h1>
          <p>XP rewards exploring, debugging, and finishing missions — never just speed.</p>
        </div>
        <Trophy className="page-heading__icon" />
      </section>

      <div className="segmented-control" aria-label="Ranking scope">
        <button className={scope === 'class' ? 'is-active' : ''} onClick={() => setScope('class')}>MY CLASS</button>
        <button className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>ALL CLASSES</button>
      </div>

      {loading ? (
        <div className="empty-state"><span className="loading-pixel" /><strong>Receiving class signal...</strong></div>
      ) : entries.length ? (
        <section className="ranking-board">
          <div className="ranking-board__header"><span>RANK / PLAYER</span><span>JOURNEY</span><span>BADGES</span><span>XP</span></div>
          {entries.map((entry) => (
            <article className={`ranking-row ${entry.isCurrent ? 'is-current' : ''}`} key={`${entry.rank}-${entry.displayName}`}>
              <strong className="ranking-position">{entry.rank <= 3 ? <Medal size={21} /> : `#${entry.rank}`}</strong>
              <PixelAvatar avatarId={entry.avatarId} size="small" />
              <div className="ranking-name"><strong>{entry.displayName}</strong>{entry.isCurrent && <small>YOU</small>}</div>
              <div className="ranking-progress"><div><i style={{ width: `${entry.progress}%` }} /></div><span>{entry.progress}%</span></div>
              <span className="ranking-badges">◆ {entry.badges}</span>
              <strong className="ranking-xp">{entry.xp} <small>XP</small></strong>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <Radio size={28} />
          <strong>The class signal is quiet.</strong>
          <p>Ranking appears after the Supabase classroom setup is applied and students earn XP.</p>
        </div>
      )}
      {profile.isTeacher && <p className="preview-note">Teacher preview uses fictional player names. Real class data stays private in Supabase.</p>}
    </main>
  )
}
