import { ArrowLeft, ArrowRight, Check, LoaderCircle, Play, Skull, Trophy } from 'lucide-react'
import { useState } from 'react'
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
  const completed = progress.completed.includes('final-bosses')

  const run = async () => {
    setBusy(true)
    try {
      const output = await pythonRunner.runScript(code, boss.inputs)
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
      setVictory(false)
      setResult(error instanceof Error ? error.message : 'The boss blocked that run.')
    } finally {
      setBusy(false)
    }
  }

  const choose = (index: number) => {
    const nextIndex = Math.max(0, Math.min(variableBosses.length - 1, index))
    const nextBoss = variableBosses[nextIndex]
    setBossIndex(nextIndex)
    setCode(nextBoss.code)
    setResult('Change the code. Defeat the boss.')
    setVictory(progress.bossProgress.includes(nextBoss.id))
  }

  return (
    <ExperienceShell order="07" title="Final Bosses" question="Can you use what you discovered?" accent="#ff855e" hints={['Look at the input names above result.', 'Build the formula using those variables.', `This boss gives input: ${boss.inputs.join(', ')}.`]} completed={completed} objective="No lesson. No locks. Pick any boss and make the expected output." onBack={onBack} onComplete={() => onProgress(completeActivity(progress, 'final-bosses'))} className="boss-experience">
      <section className="boss-stage panel-surface">
        <div className="boss-title"><span><Skull /></span><div><small>BOSS {String(boss.id).padStart(2, '0')} / {variableBosses.length}</small><h2>{boss.title}</h2><p>{boss.prompt}</p></div></div>
        <div className="boss-io"><article><small>INPUT</small><strong>{boss.inputs.join('  ·  ')}</strong></article><i>VS</i><article><small>EXPECTED</small><strong>{boss.expected ?? 'YOUR RULE'}</strong></article></div>
        <div className={`boss-result ${victory ? 'is-victory' : ''}`}>{victory ? <Trophy /> : <Skull />}<span><small>{victory ? 'VICTORY' : 'RESULT'}</small><strong>{result}</strong></span></div>
        <div className="boss-grid" aria-label="Choose a boss">{variableBosses.map((item, index) => <button key={item.id} className={`${index === bossIndex ? 'is-active' : ''} ${progress.bossProgress.includes(item.id) ? 'is-done' : ''}`} onClick={() => choose(index)}>{progress.bossProgress.includes(item.id) ? <Check /> : String(item.id).padStart(2, '0')}</button>)}</div>
      </section>
      <section className="code-workbench panel-surface">
        <CodeEditor value={code} onChange={setCode} minHeight="260px" />
        <button className="primary-action full-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN AGAINST BOSS</button>
        <div className="boss-navigation"><button onClick={() => choose(bossIndex - 1)} disabled={bossIndex === 0}><ArrowLeft /> PREVIOUS</button><span>{progress.bossProgress.length} / {variableBosses.length} DEFEATED</span><button onClick={() => choose(bossIndex + 1)} disabled={bossIndex === variableBosses.length - 1}>NEXT <ArrowRight /></button></div>
      </section>
    </ExperienceShell>
  )
}

function matches(actual: string, expected: string): boolean {
  const left = actual.trim()
  const right = expected.trim()
  if (left === right) return true
  if (!left.includes('\n') && !right.includes('\n')) {
    const a = Number(left)
    const b = Number(right)
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001
  }
  return false
}
