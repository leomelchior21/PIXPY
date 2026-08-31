import { ArrowRight, Check } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Brand } from '../components/Brand'
import { normalizeAccessId } from '../lib/access'

interface LoginScreenProps {
  onIdentify: (accessId: string) => Promise<void>
}

export function LoginScreen({ onIdentify }: LoginScreenProps) {
  const [accessId, setAccessId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (accessId.length < 3 || busy) return
    setBusy(true)
    setError('')
    try {
      await onIdentify(accessId)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The lab door did not open. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-copy">
        <div className="retro-titlebar"><span>PIXPY_WELCOME.EXE</span><i>— □ ×</i></div>
        <Brand />
        <div className="login-copy__eyebrow"><span /> STUDENT ACCESS / LAB 01</div>
        <h1>Change the code.<br /><em>Change the world.</em></h1>
        <p>A secret pixel lab where every line of Python does something you can see.</p>
        <small>PIXPY SYSTEM 0.1 // CODE CHANGES THE WORLD</small>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <h2>Enter the lab</h2>
          <p id="login-help" className="login-panel__help">Use your first and last name together, in lowercase, with no spaces.</p>

          <form onSubmit={submit}>
            <div className={`login-field ${error ? 'has-error' : ''}`}>
              <span>&gt;</span>
              <input
                id="access-id"
                aria-label="ACCESS ID"
                autoFocus
                autoComplete="username"
                spellCheck={false}
                value={accessId}
                onChange={(event) => setAccessId(normalizeAccessId(event.target.value))}
                placeholder="firstnamelastname"
                aria-describedby={error ? 'login-error' : 'login-help'}
              />
              {accessId.length >= 3 && <Check size={17} />}
            </div>
            {error && <div id="login-error" className="form-error" role="alert">{error}</div>}
            <button className="primary-button login-submit" disabled={accessId.length < 3 || busy}>
              {busy ? 'OPENING LAB...' : 'ENTER PIXPY'} <ArrowRight size={19} />
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
