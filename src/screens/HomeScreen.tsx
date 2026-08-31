import { ArrowRight, Atom, BadgeCheck, Braces, LockKeyhole, Trophy, Zap } from 'lucide-react'
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
          <h1>Ready to break<br />something, <em>{profile.displayName}</em>?</h1>
          <p>Your experiment is waiting. Change one value and see what happens.</p>
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
            <h2>Dino Lab</h2>
            <p>Hack a runner game with real Python variables. Make it fast, floaty, giant, or completely chaotic.</p>
            <div className="progress-line"><i style={{ width: `${Math.max(5, progress)}%` }} /></div>
            <div className="continue-card__meta"><span>{completed}/5 missions</span><span>{progress}% complete</span></div>
            <button className="primary-button" onClick={() => onNavigate('dino-lab')}>
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

      <section className="coming-strip">
        <div><span><Braces size={18} /></span><small>NEXT SIGNAL</small><strong>Game Maker</strong><em>Strings</em></div>
        <div><span><Zap size={18} /></span><small>LOCKED</small><strong>Terminal Zero</strong><em>print()</em></div>
        <div><span><LockKeyhole size={18} /></span><small>LOCKED</small><strong>Security Gate</strong><em>if</em></div>
      </section>
    </main>
  )
}
