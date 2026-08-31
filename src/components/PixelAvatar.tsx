import type { CSSProperties } from 'react'
import { getAvatar } from '../data/avatars'

interface PixelAvatarProps {
  avatarId?: string | null
  size?: 'small' | 'medium' | 'large'
  selected?: boolean
}

export function PixelAvatar({ avatarId, size = 'medium', selected = false }: PixelAvatarProps) {
  const avatar = getAvatar(avatarId)
  const colors = {
    '--skin': avatar.skin,
    '--hair': avatar.hair,
    '--outfit': avatar.outfit,
    '--accent': avatar.accent,
  } as CSSProperties

  return (
    <div
      className={`pixel-avatar pixel-avatar--${size} ${selected ? 'pixel-avatar--selected' : ''}`}
      style={colors}
      aria-label="Pixel avatar"
      role="img"
    >
      <svg viewBox="0 0 20 20" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="var(--hair)" d="M4 2h12v2h2v9h-2v3H4v-3H2V5h2z" />
        <path fill="var(--skin)" d="M4 6h12v7h-2v2H6v-2H4z" />
        <path fill="var(--skin)" d="M3 8h2v3H3zm12 0h2v3h-2z" />
        <path fill="var(--hair)" d={hairPath(avatar.id)} />
        <path fill="#001d2a" d="M6 9h2v2H6zm6 0h2v2h-2z" />
        <path fill="#001d2a" d={avatar.id === 'flux' ? 'M8 12h4v1H8z' : 'M8 12h1v1h3v-1h1v2H8z'} />
        <path fill="var(--outfit)" d="M4 16h12v4H4z" />
        <path fill="var(--accent)" d="M9 16h2v2H9z" />
        {avatar.accessory === 'glasses' && <path fill="var(--accent)" d="M5 8h4v4H5V8zm6 0h4v4h-4V8zM9 9h2v1H9zM6 9v2h2V9H6zm6 0v2h2V9h-2z" />}
        {avatar.accessory === 'visor' && <path fill="var(--accent)" d="M5 8h10v3H5z" opacity=".92" />}
        {avatar.accessory === 'headphones' && <path fill="var(--accent)" d="M2 6h2v6H2zm14 0h2v6h-2zM4 4h12v1H4z" />}
        {avatar.accessory === 'cap' && <path fill="var(--accent)" d="M3 3h12v3h3v1H8V5H3z" />}
      </svg>
    </div>
  )
}

function hairPath(avatarId: string): string {
  const paths: Record<string, string> = {
    nova: 'M4 3h12v4h-2V6h-2v2h-2V6H8v2H6V6H4z',
    byte: 'M4 3h12v4h-2V6H6v2H4z',
    echo: 'M3 4h13v2h-2v2h-2V6H9v2H7V6H3z',
    flux: 'M4 3h12v3H8v1H6v2H4z',
    moss: 'M3 3h4V2h3v2h3V2h4v6h-2V6h-3v2H9V6H6v2H3z',
    orbit: 'M4 3h12v2h2v4h-3V6H8v1H6v2H3V5h1z',
  }
  return paths[avatarId] ?? paths.nova
}
