import { Award, Map, Menu, Volume2, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import type { AppRoute, StudentProfile } from '../types'
import { Brand } from './Brand'
import { PixelAvatar } from './PixelAvatar'

interface HudProps {
  profile: StudentProfile
  route: AppRoute
  soundOn: boolean
  onToggleSound: () => void
  onNavigate: (route: AppRoute) => void
}

export function Hud({ profile, route, soundOn, onToggleSound, onNavigate }: HudProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const progress = Math.min(100, profile.completedMissions.length * 20)

  return (
    <header className="hud">
      <button className="hud__brand" onClick={() => onNavigate('home')} aria-label="Go home">
        <Brand compact />
      </button>

      <div className="hud__player">
        <PixelAvatar avatarId={profile.avatarId} size="small" />
        <div className="hud__identity">
          <span>{profile.displayName}</span>
          <div className="hud__xp-row">
            <div className="hud__xp-track" aria-label={`${progress}% journey progress`}>
              <i style={{ width: `${Math.max(progress, 8)}%` }} />
            </div>
            <b>{profile.xp} XP</b>
          </div>
        </div>
      </div>

      <nav className="hud__nav" aria-label="Main navigation">
        <button className={route === 'journey' ? 'is-active' : ''} onClick={() => onNavigate('journey')}>
          <Map size={17} /> Journey
        </button>
        <button className={route === 'profile' ? 'is-active' : ''} onClick={() => onNavigate('profile')}>
          <Award size={17} /> Badges
        </button>
      </nav>

      <button className="icon-button" onClick={onToggleSound} aria-label={soundOn ? 'Mute sound' : 'Turn sound on'}>
        {soundOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
      <button className="icon-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Open menu" aria-expanded={menuOpen}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {menuOpen && (
        <div className="hud-menu">
          <button onClick={() => { onNavigate('home'); setMenuOpen(false) }}>Play</button>
          <button onClick={() => { onNavigate('journey'); setMenuOpen(false) }}>Journey</button>
          <button onClick={() => { onNavigate('ranking'); setMenuOpen(false) }}>Ranking</button>
          <button onClick={() => { onNavigate('profile'); setMenuOpen(false) }}>Profile</button>
          {profile.isTeacher && <button onClick={() => { onNavigate('teacher'); setMenuOpen(false) }}>Teacher mode</button>}
        </div>
      )}
    </header>
  )
}
