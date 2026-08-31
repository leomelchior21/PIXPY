import { ArrowRight, Check, Gamepad2, ShieldCheck, Sparkles } from 'lucide-react'
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
        <Brand />
        <div className="login-copy__eyebrow"><span /> STUDENT ACCESS / LAB 01</div>
        <h1>Change the code.<br /><em>Change the world.</em></h1>
        <p>A secret pixel lab where every line of Python does something you can see.</p>
        <ul>
          <li><Gamepad2 size={17} /><span><b>Play first.</b> Learn by changing the game.</span></li>
          <li><Sparkles size={17} /><span><b>Try weird ideas.</b> Curiosity earns XP.</span></li>
          <li><ShieldCheck size={17} /><span><b>Your progress stays.</b> Return where you stopped.</span></li>
        </ul>
        <small>PIXPY SYSTEM 0.1 // CODE CHANGES THE WORLD</small>
      </section>

      <section className="login-panel-wrap">
        <div className="login-orbit login-orbit--one" />
        <div className="login-orbit login-orbit--two" />
        <div className="login-panel">
          <div className="login-panel__status"><i /> LAB NETWORK ONLINE</div>
          <div className="login-panel__icon" aria-hidden="true">
            <span className="login-panel__face">›_</span>
          </div>
          <p className="kicker">WHO ARE YOU?</p>
          <h2>Enter the lab</h2>
          <p className="login-panel__help">Use your first and last name together, in lowercase.</p>

          <form onSubmit={submit}>
            <label htmlFor="access-id">ACCESS ID</label>
            <div className={`login-field ${error ? 'has-error' : ''}`}>
              <span>&gt;</span>
              <input
                id="access-id"
                autoFocus
                autoComplete="username"
                spellCheck={false}
                value={accessId}
                onChange={(event) => setAccessId(normalizeAccessId(event.target.value))}
                placeholder="firstnamelastname"
                aria-describedby={error ? 'login-error' : 'login-tip'}
              />
              {accessId.length >= 3 && <Check size={17} />}
            </div>
            <span id="login-tip" className="field-tip">No spaces · no class number · no email</span>
            {error && <div id="login-error" className="form-error" role="alert">{error}</div>}
            <button className="primary-button login-submit" disabled={accessId.length < 3 || busy}>
              {busy ? 'OPENING LAB...' : 'ENTER PIXPY'} <ArrowRight size={19} />
            </button>
          </form>
          <div className="login-panel__footer"><span>New here?</span> Your teacher already added your access ID.</div>
        </div>
      </section>
    </main>
  )
}
