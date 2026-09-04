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
      <header className="name-header">
        <Brand />
      </header>
      <section className="name-stage">
        <div className="name-copy">
          <h1>Your playground is ready!</h1>
        </div>
        <form className="name-card" onSubmit={submit}>
          <label htmlFor="student-name">What should we call you?</label>
          <div className="name-field">
            <input id="student-name" autoFocus autoComplete="off" value={name} onChange={(event) => setName(cleanName(event.target.value))} placeholder="insert your name" />
            <button disabled={name.trim().length < 2} aria-label="Let's go"><span>LET'S GO</span><ArrowRight size={21} /></button>
          </div>
        </form>
      </section>
    </main>
  )
}
