import { ArrowRight } from 'lucide-react'
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
      <div className="name-confetti" aria-hidden="true">
        <i>{'{ }'}</i><i>=</i><i>_</i><i>+</i>
      </div>
      <header className="name-header">
        <Brand />
        <span>PYTHON, BUT PLAYFUL.</span>
      </header>
      <section className="name-stage">
        <div className="name-copy">
          <p className="name-eyebrow"><span /> YOUR PLAYGROUND IS READY</p>
          <h1>Make one change.<br /><em>Watch it come alive.</em></h1>
          <p>No account. No setup. Just a name and a whole lot of things to try.</p>
        </div>
        <form className="name-card" onSubmit={submit}>
          <div className="name-preview" aria-hidden="true">
            <small>YOUR FIRST VARIABLE</small>
            <code><span>player</span> = <b>&quot;{name.trim() || 'you'}&quot;</b><i /></code>
          </div>
          <label htmlFor="student-name">What should we call you?</label>
          <div className="name-field">
            <input id="student-name" autoFocus autoComplete="off" value={name} onChange={(event) => setName(cleanName(event.target.value))} placeholder="insert your name" aria-describedby="name-privacy" />
            <button disabled={name.trim().length < 2} aria-label="Let's go"><span>LET'S GO</span><ArrowRight size={21} /></button>
          </div>
          <small id="name-privacy">Your progress stays in this browser.</small>
        </form>
      </section>
      <footer className="name-footer" aria-hidden="true"><span>CHANGE</span><i>→</i><span>RUN</span><i>→</i><span>SEE</span></footer>
    </main>
  )
}
