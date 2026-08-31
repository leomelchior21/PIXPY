import { Award, LogOut, Pencil, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { PixelAvatar } from '../components/PixelAvatar'
import { avatars } from '../data/avatars'
import type { StudentProfile } from '../types'

interface ProfileScreenProps {
  profile: StudentProfile
  onChangeAvatar: () => void
  onLogout: () => void
}

const badgeCatalog = [
  { id: 'first-run', title: 'First Signal', note: 'Ran Python for the first time', icon: Zap },
  { id: 'experimenter', title: 'Experimenter', note: 'Tried three different modes', icon: Sparkles },
  { id: 'chaos-engineer', title: 'Chaos Engineer', note: 'Created an extreme configuration', icon: Award },
  { id: 'lab-survivor', title: 'Lab Survivor', note: 'Completed every Dino Lab mission', icon: ShieldCheck },
]

export function ProfileScreen({ profile, onChangeAvatar, onLogout }: ProfileScreenProps) {
  const avatar = avatars.find((item) => item.id === profile.avatarId) ?? avatars[0]

  return (
    <main className="app-page profile-screen">
      <section className="profile-hero">
        <div className="profile-hero__avatar"><PixelAvatar avatarId={profile.avatarId} size="large" /></div>
        <div>
          <p className="kicker">PLAYER PROFILE</p>
          <h1>{profile.displayName}</h1>
          <p>{avatar.name} operator · Level {Math.max(1, Math.floor(profile.xp / 300) + 1)}</p>
          <button className="ghost-button" onClick={onChangeAvatar}><Pencil size={15} /> Change avatar</button>
        </div>
        <div className="profile-xp"><strong>{profile.xp}</strong><span>TOTAL XP</span></div>
      </section>

      <section className="profile-stats">
        <article><strong>{profile.completedMissions.length}</strong><span>Missions solved</span></article>
        <article><strong>{profile.badges.length}</strong><span>Badges found</span></article>
        <article><strong>{profile.completedMissions.length * 20}%</strong><span>Journey mapped</span></article>
      </section>

      <section className="badge-section">
        <div className="section-title"><div><p className="kicker">COLLECTION</p><h2>Your badges</h2></div><span>{profile.badges.length}/{badgeCatalog.length} FOUND</span></div>
        <div className="badge-grid">
          {badgeCatalog.map(({ id, title, note, icon: Icon }) => {
            const unlocked = profile.badges.includes(id)
            return (
              <article className={`badge-card ${unlocked ? 'is-unlocked' : ''}`} key={id}>
                <span className="badge-card__icon"><Icon /></span>
                <div><strong>{unlocked ? title : 'Encrypted badge'}</strong><p>{unlocked ? note : 'Keep experimenting to reveal it.'}</p></div>
              </article>
            )
          })}
        </div>
      </section>

      <button className="logout-button" onClick={onLogout}><LogOut size={16} /> Leave this profile</button>
    </main>
  )
}
