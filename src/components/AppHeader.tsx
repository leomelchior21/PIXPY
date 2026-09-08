import { Check, Home, List, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { variableExperiences } from '../data/variables'
import type { AppRoute, SessionProgress } from '../types'
import { Brand } from './Brand'

interface AppHeaderProps {
  route: AppRoute
  progress: SessionProgress
  onNavigate: (route: AppRoute) => void
}

export function AppHeader({ route, progress, onNavigate }: AppHeaderProps) {
  const [listOpen, setListOpen] = useState(false)
  const listRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!listOpen) return
    listRef.current?.querySelector<HTMLButtonElement>('.is-current')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setListOpen(false); toggleRef.current?.focus() }
    }
    const outside = (event: PointerEvent) => {
      if (!listRef.current?.contains(event.target as Node) && !toggleRef.current?.contains(event.target as Node)) setListOpen(false)
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('pointerdown', outside) }
  }, [listOpen])

  const navigate = (next: AppRoute) => {
    setListOpen(false)
    onNavigate(next)
  }

  return (
    <header className="app-header no-print">
      <button className="brand-button" onClick={() => navigate('home')} aria-label="PixPy home"><Brand compact /></button>
      <nav aria-label="Main navigation">
        <button className={route === 'home' ? 'is-active' : ''} onClick={() => navigate('home')}><Home size={17} /> Explore</button>
        <button className={route === 'variables' || variableExperiences.some((item) => item.id === route) ? 'is-active' : ''} onClick={() => navigate('variables')}>Variables <span>{progress.completed.length}/7</span></button>
      </nav>
      <div className="header-actions">
        <div className="student-chip"><span>PLAYING AS</span><strong>{progress.name}</strong></div>
        <button ref={toggleRef} className={`quick-list-button ${listOpen ? 'is-active' : ''}`} onClick={() => setListOpen((value) => !value)} aria-label="Open Variables activity list" aria-expanded={listOpen} aria-controls="activity-list"><List size={21} /><span>Activities</span></button>
      </div>

      {listOpen && (
        <aside ref={listRef} id="activity-list" className="quick-list" aria-label="Variables activities">
          <header><div><small>CURRENT GROUP</small><strong>Variables</strong></div><button onClick={() => setListOpen(false)} aria-label="Close activity list"><X /></button></header>
          <div>
            {variableExperiences.map((experience) => {
              const Icon = experience.icon
              const done = progress.completed.includes(experience.id)
              return (
                <button key={experience.id} className={route === experience.id ? 'is-current' : ''} onClick={() => navigate(experience.id)}>
                  <span style={{ '--quick-accent': experience.color } as React.CSSProperties}><Icon /></span>
                  <i>{experience.order}</i>
                  <strong>{experience.title}</strong>
                  {done ? <Check className="quick-done" /> : null}
                </button>
              )
            })}
          </div>
        </aside>
      )}
    </header>
  )
}
