import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { Brand } from '../components/Brand'
import { PixelAvatar } from '../components/PixelAvatar'
import { avatars } from '../data/avatars'

interface AvatarScreenProps {
  displayName: string
  initialAvatar?: string | null
  onComplete: (avatarId: string) => void
}

export function AvatarScreen({ displayName, initialAvatar, onComplete }: AvatarScreenProps) {
  const [selected, setSelected] = useState(initialAvatar ?? avatars[0].id)

  return (
    <main className="avatar-screen">
      <header className="simple-header"><Brand compact /><span>PLAYER SETUP // 01</span></header>
      <section className="avatar-intro">
        <p className="kicker">WELCOME, {displayName.toUpperCase()}</p>
        <h1>Choose your lab identity.</h1>
        <p>This player will travel with you through every experiment.</p>
      </section>
      <section className="avatar-grid" aria-label="Choose an avatar">
        {avatars.map((avatar) => (
          <button
            key={avatar.id}
            className={`avatar-card ${selected === avatar.id ? 'is-selected' : ''}`}
            onClick={() => setSelected(avatar.id)}
            aria-pressed={selected === avatar.id}
          >
            {selected === avatar.id && <span className="avatar-card__check"><Check size={15} /></span>}
            <PixelAvatar avatarId={avatar.id} size="large" selected={selected === avatar.id} />
            <strong>{avatar.name}</strong>
            <small>{avatar.accessory ?? 'lab gear'}</small>
          </button>
        ))}
      </section>
      <button className="primary-button avatar-confirm" onClick={() => onComplete(selected)}>
        THAT'S ME <ArrowRight size={19} />
      </button>
      <p className="avatar-note">You can change this later in your profile.</p>
    </main>
  )
}
