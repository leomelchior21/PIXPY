import { ArrowLeft, ArrowRight, Check, LoaderCircle, Play, RotateCcw, Skull, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { variableBosses } from '../../data/bosses'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

export function FinalBosses({ progress, onProgress, onBack }: Props) {
  const [bossIndex, setBossIndex] = useState(0)
  const boss = variableBosses[bossIndex]
  const [code, setCode] = useState(boss.code)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('Change the code. Defeat the boss.')
  const [victory, setVictory] = useState(false)
  const drafts = useRef<Record<number, string>>({})
  const version = useRef(0)
  useEffect(() => () => { version.current += 1 }, [])
  const completed = progress.completed.includes('final-bosses')

  const run = async () => {
    if (busy) return
    const request = ++version.current
    setBusy(true)
    try {
      const output = await pythonRunner.runScript(code, boss.inputs)
      if (request !== version.current) return
      const won = boss.expected === undefined ? output.stdout.trim().length > 0 : matches(output.stdout, boss.expected)
      if (!won) {
        setVictory(false)
        setResult(`Python made ${output.stdout || 'nothing'}. The boss expected ${boss.expected}.`)
        return
      }
      const defeated = [...new Set([...progress.bossProgress, boss.id])].sort((a, b) => a - b)
      let next = { ...progress, bossProgress: defeated }
      if (defeated.length === variableBosses.length) next = completeActivity(next, 'final-bosses')
      onProgress(next)
      setVictory(true)
      setResult(boss.expected === undefined ? `YOUR FORMULA MADE ${output.stdout}. BOSS DEFEATED.` : `OUTPUT ${output.stdout}. BOSS DEFEATED.`)
    } catch (error) {
      if (request !== version.current) return
      setVictory(false)
      setResult(error instanceof Error ? error.message : 'The boss blocked that run.')
    } finally {
      if (request === version.current) setBusy(false)
    }
  }

  const choose = (index: number) => {
    if (busy) return
    drafts.current[boss.id] = code
    const nextIndex = Math.max(0, Math.min(variableBosses.length - 1, index))
    const nextBoss = variableBosses[nextIndex]
    setBossIndex(nextIndex)
    setCode(drafts.current[nextBoss.id] ?? nextBoss.code)
    setResult(progress.bossProgress.includes(nextBoss.id) ? 'Already defeated. Try a different solution!' : 'Change the code. Defeat the boss.')
    setVictory(progress.bossProgress.includes(nextBoss.id))
  }

  return (
    <ExperienceShell order="07" title="Final Bosses" question="Can you use what you discovered?" accent="#ff855e" hints={['Look at the input names above result.', 'Build the formula using those variables.', `This boss gives input: ${boss.inputs.join(', ')}.`]} completed={completed} objective="No lesson. No locks. Pick any boss and make the expected output." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'final-bosses'))} className="boss-experience">
      <section className="boss-stage panel-surface">
        <div className="boss-title"><span><Skull /></span><div><small>BOSS {String(boss.id).padStart(2, '0')} / {variableBosses.length}</small><h2>{boss.title}</h2><p>{boss.prompt}</p></div></div>
        <div className="boss-io"><article><small>INPUT</small><strong>{boss.inputs.join('  ·  ')}</strong></article><i>VS</i><article><small>EXPECTED</small><strong>{boss.expected ?? 'YOUR RULE'}</strong></article></div>
        <div className={`boss-result ${victory ? 'is-victory' : ''}`} role="status">{victory ? <Trophy /> : <Skull />}<span><small>{victory ? 'VICTORY' : 'RESULT'}</small><strong>{result}</strong></span></div>
        <div className="boss-grid" aria-label="Choose a boss">{variableBosses.map((item, index) => <button key={item.id} disabled={busy} aria-label={`Boss ${item.id}: ${item.title}${progress.bossProgress.includes(item.id) ? ', defeated' : ''}`} aria-pressed={index === bossIndex} className={`${index === bossIndex ? 'is-active' : ''} ${progress.bossProgress.includes(item.id) ? 'is-done' : ''}`} onClick={() => choose(index)}>{progress.bossProgress.includes(item.id) ? <Check /> : String(item.id).padStart(2, '0')}<span>{item.title}</span></button>)}</div>
      </section>
      <section className="code-workbench panel-surface">
        <header className="workbench-heading"><span>YOUR SOLUTION</span><h2>Make the values work together.</h2><p>Edit the formula below, then test your code.</p></header>
        <CodeEditor value={code} readOnly={busy} onChange={(value) => { setCode(value); setVictory(false); setResult('Code changed. Run it to see your new result.') }} minHeight="180px" />
        <div className="run-row"><button className="secondary-action" disabled={busy} onClick={() => { setCode(boss.code); setVictory(false); setResult('Starter code restored. Try a new formula.') }}><RotateCcw /> Reset</button><button className="primary-action full-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} TEST MY CODE</button></div>
        <div className="boss-navigation"><button onClick={() => choose(bossIndex - 1)} disabled={busy || bossIndex === 0}><ArrowLeft /> PREVIOUS</button><span>{progress.bossProgress.length} / {variableBosses.length} DEFEATED</span><button onClick={() => choose(bossIndex + 1)} disabled={busy || bossIndex === variableBosses.length - 1}>NEXT <ArrowRight /></button></div>
      </section>
    </ExperienceShell>
  )
}

function matches(actual: string, expected: string): boolean {
  const left = actual.trim()
  const right = expected.trim()
  if (!left) return false
  if (left === right) return true
  if (!left.includes('\n') && !right.includes('\n')) {
    const a = Number(left)
    const b = Number(right)
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001
  }
  return false
}
