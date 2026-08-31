import { Gamepad2, Map, Trophy, UserRound } from 'lucide-react'
import type { AppRoute } from '../types'

interface BottomNavProps {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
}

export function BottomNav({ route, onNavigate }: BottomNavProps) {
  const links: Array<{ route: AppRoute; label: string; icon: typeof Gamepad2 }> = [
    { route: 'home', label: 'Play', icon: Gamepad2 },
    { route: 'journey', label: 'Journey', icon: Map },
    { route: 'ranking', label: 'Ranking', icon: Trophy },
    { route: 'profile', label: 'Profile', icon: UserRound },
  ]

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {links.map(({ route: linkRoute, label, icon: Icon }) => (
        <button key={linkRoute} className={route === linkRoute ? 'is-active' : ''} onClick={() => onNavigate(linkRoute)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
