import { ArrowRight, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Brand } from '../components/Brand'
import { cleanName } from '../session/progressSession'

interface NameEntryScreenProps {
  onStart: (name: string) => void
}

export function NameEntryScreen({ onStart }: NameEntryScreenProps) {
  const [name, setName] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const cleaned = cleanName(name).trim()
    if (cleaned.length >= 2) onStart(cleaned)
  }

  return (
    <main className="name-screen">
      <div className="name-grid" aria-hidden="true" />
      <section className="name-hero">
        <p className="pixel-kicker"><Sparkles size={16} /> PYTHON EXPERIENCE PLAYGROUND</p>
        <Brand />
        <h1>Change one thing.<br /><em>See what happens.</em></h1>
        <p>Short Python experiments made for the classroom.</p>
        <div className="name-loop"><span>PLAY</span><i>→</i><span>CHANGE</span><i>→</i><span>RUN</span><i>→</i><span>SEE</span></div>
      </section>
      <section className="name-panel">
        <form onSubmit={submit}>
          <span className="name-step">01 / ONE TINY THING</span>
          <label htmlFor="student-name">WHAT'S YOUR NAME?</label>
          <p>Just a name. No account. No password.</p>
          <div className="name-field"><span>&gt;</span><input id="student-name" autoFocus autoComplete="off" value={name} onChange={(event) => setName(cleanName(event.target.value))} placeholder="Leo" /></div>
          <button disabled={name.trim().length < 2}>LET'S GO <ArrowRight size={20} /></button>
          <small>Your progress stays only in this browser session.</small>
        </form>
      </section>
    </main>
  )
}
