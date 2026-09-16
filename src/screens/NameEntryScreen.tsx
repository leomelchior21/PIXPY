import { ArrowRight, KeyRound, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Brand } from '../components/Brand'
import { cleanUsername } from '../session/progressSession'

interface NameEntryScreenProps {
  onStart: (username: string) => Promise<void>
}

export function NameEntryScreen({ onStart }: NameEntryScreenProps) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleaned = cleanUsername(username)
    if (cleaned.length < 3 || busy) return
    setBusy(true)
    setError('')
    try {
      await onStart(cleaned)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PixPy could not log you in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="name-screen">
      <header className="name-header">
        <Brand />
      </header>
      <section className="name-stage">
        <div className="name-copy">
          <h1>Your playground is <em>ready!</em></h1>
          <p>Sign in to keep your Python progress wherever you play.</p>
        </div>
        <form className="name-card" onSubmit={submit}>
          <div className="login-badge"><KeyRound /> CLASSROOM LOGIN</div>
          <label htmlFor="student-name">Enter your PixPy login</label>
          <p className="login-instruction">Your first name + last name, together. No spaces.</p>
          <div className="name-field">
            <input id="student-name" autoFocus autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(event) => { setUsername(cleanUsername(event.target.value)); setError('') }} placeholder="firstnamelastname" />
            <button disabled={username.length < 3 || busy} aria-label="Log in to PixPy"><span>{busy ? 'CHECKING…' : 'LOG IN'}</span>{busy ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={21} />}</button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <small>Your progress is saved to your classroom profile.</small>
        </form>
      </section>
    </main>
  )
}
