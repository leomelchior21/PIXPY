import { ArrowRight, Atom, BadgeCheck, Trophy } from 'lucide-react'
import { PixelAvatar } from '../components/PixelAvatar'
import type { AppRoute, StudentProfile } from '../types'

interface HomeScreenProps {
  profile: StudentProfile
  onNavigate: (route: AppRoute) => void
}

export function HomeScreen({ profile, onNavigate }: HomeScreenProps) {
  const completed = profile.completedMissions.length
  const progress = completed * 20

  return (
    <main className="app-page home-screen">
      <section className="page-heading home-heading">
        <div>
          <p className="kicker">LAB NETWORK // ONLINE</p>
          <h1>Your private lab<br />is open, <em>{profile.displayName}</em>.</h1>
          <p>One experience. Five strange missions. Every number changes the world.</p>
        </div>
        <div className="home-level">
          <PixelAvatar avatarId={profile.avatarId} size="large" />
          <span>LEVEL {Math.max(1, Math.floor(profile.xp / 300) + 1)}</span>
        </div>
      </section>

      <section className="home-grid">
        <article className="continue-card">
          <div className="continue-card__scene" aria-hidden="true">
            <div className="mini-moon" />
            <div className="mini-grid" />
            <div className="mini-runner"><span /><i /></div>
            <div className="mini-block mini-block--one" />
            <div className="mini-block mini-block--two" />
          </div>
          <div className="continue-card__content">
            <div><span className="status-dot" /> AVAILABLE NOW</div>
            <small>EXPERIENCE 01</small>
            <h2>Runner Lab</h2>
            <p>Hack a tiny runner with real Python variables. Make them fast, floaty, giant, or completely chaotic.</p>
            <div className="progress-line"><i style={{ width: `${Math.max(5, progress)}%` }} /></div>
            <div className="continue-card__meta"><span>{completed}/5 missions</span><span>{progress}% complete</span></div>
            <button className={`primary-button ${completed ? 'continue-experiment-button' : ''}`} onClick={() => onNavigate('dino-lab')}>
              {completed ? 'CONTINUE EXPERIMENT' : 'ENTER THE LAB'} <ArrowRight size={18} />
            </button>
          </div>
        </article>

        <div className="home-side-stack">
          <button className="mini-feature" onClick={() => onNavigate('journey')}>
            <span className="mini-feature__icon"><Atom /></span>
            <span><small>YOUR PATH</small><strong>Journey</strong><em>1 world unlocked</em></span>
            <ArrowRight size={18} />
          </button>
          <button className="mini-feature" onClick={() => onNavigate('ranking')}>
            <span className="mini-feature__icon mini-feature__icon--gold"><Trophy /></span>
            <span><small>CLASS ENERGY</small><strong>Ranking</strong><em>Explore, don't rush</em></span>
            <ArrowRight size={18} />
          </button>
          <button className="mini-feature" onClick={() => onNavigate('profile')}>
            <span className="mini-feature__icon mini-feature__icon--pink"><BadgeCheck /></span>
            <span><small>COLLECTION</small><strong>{profile.badges.length} badges</strong><em>More secrets to find</em></span>
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

    </main>
  )
}
