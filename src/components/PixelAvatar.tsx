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
      aria-label={`${avatar.name} avatar`}
      role="img"
    >
      <div className="pixel-avatar__antenna" />
      <div className="pixel-avatar__hair" />
      <div className="pixel-avatar__head">
        <span className="pixel-avatar__eye pixel-avatar__eye--left" />
        <span className="pixel-avatar__eye pixel-avatar__eye--right" />
        <span className="pixel-avatar__smile" />
        {avatar.accessory === 'glasses' && <span className="pixel-avatar__glasses" />}
        {avatar.accessory === 'visor' && <span className="pixel-avatar__visor" />}
      </div>
      <div className="pixel-avatar__hair-side" />
      <div className="pixel-avatar__body">
        <span className="pixel-avatar__badge">P</span>
      </div>
      {avatar.accessory === 'headphones' && <span className="pixel-avatar__phones" />}
      {avatar.accessory === 'cap' && <span className="pixel-avatar__cap" />}
    </div>
  )
}
