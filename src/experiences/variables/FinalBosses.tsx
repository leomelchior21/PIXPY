import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  LoaderCircle,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { variableBosses, type BossTestCase } from '../../data/bosses'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity, resetActivityProgress } from '../../session/progressSession'
import type { SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }
type TestStatus = 'waiting' | 'running' | 'passed' | 'failed'
interface TestRun extends BossTestCase { number: number; output: string; status: TestStatus; error?: string }

const mysteryEmoji = ['❔', '🔒', '🕵️', '🌫️']
const missionBatchSize = 3

export function FinalBosses({ progress, onProgress, onBack }: Props) {
  const [bossIndex, setBossIndex] = useState(() => firstOpenMission(progress.bossProgress))
  const boss = variableBosses[bossIndex]
  const [code, setCode] = useState(boss.code)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(() => progress.bossProgress.includes(boss.id) ? 'Mission already cleared. You can test another solution.' : 'Your phone is ready for three surprise tests.')
  const [victory, setVictory] = useState(() => progress.bossProgress.includes(boss.id))
  const [testRuns, setTestRuns] = useState<TestRun[]>(makeEmptyRuns)
  const [activeTest, setActiveTest] = useState<number | null>(null)
  const [guideVisible, setGuideVisible] = useState(true)
  const drafts = useRef<Record<number, string>>({})
  const version = useRef(0)
  useEffect(() => () => { version.current += 1 }, [])
  const completed = progress.completed.includes('final-bosses')
  const activeRun = activeTest === null ? null : testRuns[activeTest]
  const phoneState = busy ? 'testing' : victory ? 'victory' : testRuns.some((test) => test.status === 'failed') ? 'failed' : 'ready'

  const run = async () => {
    if (busy) return
    const request = ++version.current
    const selected = chooseRandomTests(boss.testCases)
    const runs: TestRun[] = selected.map((test, index) => ({ ...test, number: index + 1, output: '', status: 'waiting' }))
    let allPassed = true
    setBusy(true)
    setVictory(false)
    setGuideVisible(false)
    setResult('Testing your rule with three surprise inputs…')
    setTestRuns(runs.map((test) => ({ ...test })))

    try {
      for (let index = 0; index < runs.length; index += 1) {
        if (request !== version.current) return
        runs[index] = { ...runs[index], status: 'running' }
        setActiveTest(index)
        setTestRuns(runs.map((test) => ({ ...test })))
        await pause(260)

        try {
          const output = await pythonRunner.runScript(code, runs[index].inputs)
          if (request !== version.current) return
          const expected = runs[index].expected
          const passed = expected === undefined
            ? output.stdout.trim().length > 0
            : matches(output.stdout, expected)
          allPassed = allPassed && passed
          runs[index] = { ...runs[index], output: output.stdout.trim(), status: passed ? 'passed' : 'failed' }
        } catch (error) {
          allPassed = false
          runs[index] = {
            ...runs[index],
            output: '',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Python could not run that test.',
          }
        }
        setTestRuns(runs.map((test) => ({ ...test })))
        await pause(420)
      }

      if (request !== version.current) return
      if (!allPassed) {
        const failed = runs.find((test) => test.status === 'failed')
        setResult(failed?.error ?? `Test ${failed?.number ?? 1} found a mismatch. Check the mission and adjust your formula.`)
        return
      }

      const defeated = [...new Set([...progress.bossProgress, boss.id])].sort((a, b) => a - b)
      let next = { ...progress, bossProgress: defeated }
      if (defeated.length === variableBosses.length) next = completeActivity(next, 'final-bosses')
      onProgress(next)
      setVictory(true)
      setResult('All 3 tests passed. Mission complete!')
    } finally {
      if (request === version.current) setBusy(false)
    }
  }

  const choose = (index: number) => {
    if (busy) return
    const nextIndex = Math.max(0, Math.min(variableBosses.length - 1, index))
    if (!isMissionUnlocked(nextIndex, progress.bossProgress)) return
    drafts.current[boss.id] = code
    const nextBoss = variableBosses[nextIndex]
    const savedDraft = drafts.current[nextBoss.id]
    setBossIndex(nextIndex)
    setCode(savedDraft ?? nextBoss.code)
    setTestRuns(makeEmptyRuns())
    setActiveTest(null)
    setGuideVisible(savedDraft === undefined)
    const alreadyDefeated = progress.bossProgress.includes(nextBoss.id)
    setResult(alreadyDefeated ? 'Mission already cleared. You can test another solution.' : 'Your phone is ready for three surprise tests.')
    setVictory(alreadyDefeated)
  }

  const editCode = (value: string) => {
    setCode(value)
    setVictory(false)
    setGuideVisible(false)
    setTestRuns(makeEmptyRuns())
    setActiveTest(null)
    setResult('New code loaded. Run three tests when you are ready.')
  }

  const resetMission = () => {
    setCode(boss.code)
    setVictory(false)
    setGuideVisible(true)
    setTestRuns(makeEmptyRuns())
    setActiveTest(null)
    setResult('Starter code restored. Find the line that needs your formula.')
  }

  const resetLevel = () => {
    version.current += 1
    drafts.current = {}
    setBusy(false)
    setBossIndex(0)
    setCode(variableBosses[0].code)
    setTestRuns(makeEmptyRuns())
    setActiveTest(null)
    setGuideVisible(true)
    setResult('Your phone is ready for three surprise tests.')
    setVictory(false)
    onProgress(resetActivityProgress(progress, 'final-bosses'))
  }

  return (
    <ExperienceShell
      order="06"
      title="Final Bosses"
      question="Can your code pass every surprise test?"
      accent="#ff855e"
      hints={[
        'Read the mission carefully, then change only the formula line.',
        `Build your formula with ${boss.inputNames.join(' and ')}. Keep input() and print() in place.`,
        'One example is not enough: your rule must work with every number the phone tries.',
      ]}
      completed={completed}
      objective="Solve each mission with a rule that works for three surprise tests."
      onBack={onBack}
      onReset={resetLevel}
      onComplete={() => onProgress(completeActivity(progress, 'final-bosses'))}
      className="boss-experience"
    >
      <div className="boss-layout">
        <aside className="boss-trail panel-surface" aria-label="Mission trail">
          <header>
            <span><Trophy size={16} /></span>
            <div><small>MISSION TRAIL</small><strong>{progress.bossProgress.length} / {variableBosses.length}</strong></div>
          </header>
          <div className="boss-trail-meter" aria-hidden="true"><i style={{ height: `${(progress.bossProgress.length / variableBosses.length) * 100}%` }} /></div>
          <nav className="boss-grid" aria-label="Choose a mission">
            {variableBosses.map((item, index) => {
              const done = progress.bossProgress.includes(item.id)
              const current = index === bossIndex
              const unlocked = isMissionUnlocked(index, progress.bossProgress)
              const sameBatch = Math.floor(index / missionBatchSize) === Math.floor(bossIndex / missionBatchSize)
              const titleVisible = current || (!done && unlocked && sameBatch)
              return (
                <button
                  key={item.id}
                  disabled={busy || !unlocked}
                  aria-label={`Boss ${item.id}: ${item.title}${done ? ', defeated' : unlocked ? '' : ', locked'}`}
                  aria-pressed={current}
                  className={`${current ? 'is-active' : ''} ${done ? 'is-done' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'} ${titleVisible ? 'is-revealed' : 'is-mystery'}`}
                  onClick={() => choose(index)}
                >
                  <span className="boss-trail-dot" aria-hidden="true">
                    {done ? <Check /> : titleVisible ? String(item.id).padStart(2, '0') : mysteryEmoji[index % mysteryEmoji.length]}
                  </span>
                  <span className="boss-trail-copy">
                    {titleVisible && <strong>{item.title}</strong>}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <section className="boss-stage code-workbench panel-surface">
          <article className="boss-mission-card">
            <div className="boss-mission-number"><small>MISSION</small><strong>{String(boss.id).padStart(2, '0')}</strong></div>
            <div className="boss-mission-copy">
              <span>YOUR TASK</span>
              <h2>{boss.title}</h2>
              <p>{boss.prompt}</p>
            </div>
            <div className="boss-mission-nav">
              <button onClick={() => choose(bossIndex - 1)} disabled={busy || bossIndex === 0} aria-label="Previous mission"><ArrowLeft /></button>
              <button onClick={() => choose(bossIndex + 1)} disabled={busy || bossIndex === variableBosses.length - 1 || !isMissionUnlocked(bossIndex + 1, progress.bossProgress)} aria-label="Next mission"><ArrowRight /></button>
            </div>
          </article>

          <div className="boss-editor-shell">
            <CodeEditor
              value={code}
              readOnly={busy}
              onChange={editCode}
              minHeight="180px"
              attentionLine={guideVisible && boss.id <= 5 ? boss.editLine : null}
            />
            {guideVisible && (
              <aside className={`boss-try-popup ${boss.id <= 5 ? `boss-try-popup--line-${boss.editLine}` : 'boss-try-popup--editor'}`} role="status">
                <Sparkles />
                <div><strong>TRY THIS</strong><p>{boss.id <= 5 ? `Start on line ${boss.editLine}. Replace 0 with your formula.` : 'Scan the editor, find the unfinished formula, and make it match the mission.'}</p></div>
                <button onClick={() => setGuideVisible(false)} aria-label="Dismiss coding tip"><X /></button>
              </aside>
            )}
            <div className="boss-editor-actions">
              <button className="boss-code-reset" disabled={busy} onClick={resetMission}><RotateCcw /> Reset code</button>
              <button className="primary-action boss-run" onClick={run} disabled={busy}>
                {busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />}
                {busy ? `RUNNING TEST ${(activeTest ?? 0) + 1} / 3` : 'RUN 3 TESTS'}
              </button>
            </div>
          </div>
        </section>

        <section className="boss-phone-stage" aria-label="Test phone">
          <div className={`boss-phone is-${phoneState}`}>
            <div className="boss-phone-hardware"><i /><span /><i /></div>
            <div className="boss-phone-screen">
              <header className="boss-test-slots" aria-label="Test progress">
                {testRuns.map((test) => (
                  <div key={test.number} className={`is-${test.status}`}>
                    <span>{test.status === 'passed' ? <Check /> : test.status === 'failed' ? <X /> : test.status === 'running' ? <LoaderCircle className="spin" /> : <Circle />}</span>
                    <small>TEST {test.number}</small>
                    <strong>{test.status === 'waiting' ? 'WAITING' : test.status.toUpperCase()}</strong>
                  </div>
                ))}
              </header>

              <div className="boss-phone-content" aria-live="polite">
                <div className="boss-phone-appbar"><Smartphone /><span><small>PIX<span>PY</span> TEST LAB</small><strong>{busy ? 'Checking your rule…' : victory ? 'Mission passed!' : 'Ready to test'}</strong></span><i /></div>
                <div className="boss-phone-fields">
                  <small>INPUTS SENT TO PYTHON</small>
                  <div className={`boss-input-fields count-${boss.inputNames.length}`}>
                    {boss.inputNames.map((name, index) => (
                      <div className="boss-phone-field" key={name}>
                        <span>{name}</span>
                        <strong>{activeRun?.inputs[index] ?? '?'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={`boss-phone-output ${activeRun?.status === 'failed' ? 'is-error' : ''}`}>
                  <small>PYTHON OUTPUT</small>
                  <pre>{activeRun?.error ?? (activeRun?.output || '—')}</pre>
                </div>
                <div className="boss-phone-result" role="status">
                  {victory ? <Trophy /> : testRuns.some((test) => test.status === 'failed') ? <X /> : busy ? <LoaderCircle className="spin" /> : <Sparkles />}
                  <p>{result}</p>
                </div>
                {victory && bossIndex < variableBosses.length - 1 && isMissionUnlocked(bossIndex + 1, progress.bossProgress) && <button className="boss-phone-next" onClick={() => choose(bossIndex + 1)}>NEXT MISSION <ArrowRight /></button>}
              </div>
            </div>
            <div className="boss-phone-home" />
          </div>
        </section>
      </div>
    </ExperienceShell>
  )
}

function isMissionUnlocked(index: number, completed: number[]): boolean {
  if (index < missionBatchSize) return true
  const batchStart = Math.floor(index / missionBatchSize) * missionBatchSize
  return variableBosses.slice(0, batchStart).every((mission) => completed.includes(mission.id))
}

function firstOpenMission(completed: number[]): number {
  const next = variableBosses.findIndex((mission, index) => !completed.includes(mission.id) && isMissionUnlocked(index, completed))
  return next === -1 ? variableBosses.length - 1 : next
}

function makeEmptyRuns(): TestRun[] {
  return [1, 2, 3].map((number) => ({ number, inputs: [], output: '', status: 'waiting' }))
}

function chooseRandomTests(testCases: BossTestCase[]): BossTestCase[] {
  const shuffled = testCases.map((test) => ({ ...test, inputs: [...test.inputs] }))
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }
  return shuffled.slice(0, 3)
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

function pause(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
