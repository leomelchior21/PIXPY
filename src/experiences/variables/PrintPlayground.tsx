import { Check, ChevronLeft, ChevronRight, LoaderCircle, Play, RotateCcw, Sparkles, TerminalSquare } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/CodeEditor'
import { ExperienceShell } from '../../components/ExperienceShell'
import { getPrintActivity, printActivities } from '../../data/printActivities'
import { pythonRunner } from '../../lib/pythonRunner'
import { completeActivity } from '../../session/progressSession'
import { printCoreActivityIds, type PrintActivityId, type SessionProgress } from '../../types'

interface Props { progress: SessionProgress; onProgress: (progress: SessionProgress) => void; onBack: () => void }

const EMPTY_OUTPUT = 'Your output appears here.'

export function PrintPlayground({ progress, onProgress, onBack }: Props) {
  const [activityId, setActivityId] = useState<PrintActivityId>(progress.printPlaygroundActivity)
  const [busy, setBusy] = useState(false)
  const executionVersion = useRef(0)
  const activity = getPrintActivity(activityId)
  const activityIndex = printActivities.findIndex((item) => item.id === activityId)
  const code = progress.printPlaygroundCode[activityId] ?? activity.starterCode
  const outputState = progress.printPlaygroundOutputs[activityId]
  const completed = progress.printPlaygroundCompleted.includes(activityId)
  const coreComplete = printCoreActivityIds.every((id) => progress.printPlaygroundCompleted.includes(id))

  useEffect(() => {
    if (progress.printPlaygroundVisited.includes(activityId)) return
    onProgress({ ...progress, printPlaygroundVisited: [...progress.printPlaygroundVisited, activityId] })
  }, [activityId, onProgress, progress])

  const invalidateExecution = () => {
    executionVersion.current += 1
    setBusy(false)
  }

  const chooseActivity = (nextId: PrintActivityId) => {
    if (nextId === activityId) return
    invalidateExecution()
    setActivityId(nextId)
    onProgress({
      ...progress,
      printPlaygroundActivity: nextId,
      printPlaygroundVisited: [...new Set([...progress.printPlaygroundVisited, nextId])],
    })
  }

  const editCode = (value: string) => {
    invalidateExecution()
    const nextOutputs = { ...progress.printPlaygroundOutputs }
    delete nextOutputs[activityId]
    onProgress({
      ...progress,
      printPlaygroundCode: { ...progress.printPlaygroundCode, [activityId]: value },
      printPlaygroundOutputs: nextOutputs,
    })
  }

  const reset = () => {
    invalidateExecution()
    const nextOutputs = { ...progress.printPlaygroundOutputs }
    delete nextOutputs[activityId]
    onProgress({
      ...progress,
      printPlaygroundCode: { ...progress.printPlaygroundCode, [activityId]: activity.starterCode },
      printPlaygroundOutputs: nextOutputs,
    })
  }

  const run = async () => {
    const requestVersion = ++executionVersion.current
    const runningActivity = activity
    const runningCode = code
    setBusy(true)

    try {
      const result = await pythonRunner.runScript(runningCode)
      if (requestVersion !== executionVersion.current) return

      const success = runningActivity.validate(result, runningCode, progress.name)
      const completedActivities = success
        ? [...new Set([...progress.printPlaygroundCompleted, runningActivity.id])]
        : progress.printPlaygroundCompleted
      let nextProgress: SessionProgress = {
        ...progress,
        printPlaygroundCode: { ...progress.printPlaygroundCode, [runningActivity.id]: runningCode },
        printPlaygroundOutputs: {
          ...progress.printPlaygroundOutputs,
          [runningActivity.id]: {
            text: result.stdout || '(Python printed an empty line.)',
            kind: success ? 'success' : 'output',
          },
        },
        printPlaygroundCompleted: completedActivities,
        interestingValues: [...progress.interestingValues, `Printed: ${result.stdout.slice(0, 40)}`].slice(-8),
      }
      if (printCoreActivityIds.every((id) => completedActivities.includes(id))) {
        nextProgress = completeActivity(nextProgress, 'print-playground')
      }
      onProgress(nextProgress)
    } catch (error) {
      if (requestVersion !== executionVersion.current) return
      onProgress({
        ...progress,
        printPlaygroundCode: { ...progress.printPlaygroundCode, [runningActivity.id]: runningCode },
        printPlaygroundOutputs: {
          ...progress.printPlaygroundOutputs,
          [runningActivity.id]: {
            text: error instanceof Error ? error.message : 'Python got tangled. Try again.',
            kind: 'error',
          },
        },
      })
    } finally {
      if (requestVersion === executionVersion.current) setBusy(false)
    }
  }

  return (
    <ExperienceShell key={activity.id} order="02" title="Print Playground" question="How can Python put something on screen?" accent="#ffcb47" hints={activity.hints} completed={coreComplete} objective="Complete the five core print activities. Optional extras do not affect completion." onBack={onBack} className={`print-experience ${activity.extra ? 'print-experience--extra' : ''}`}>
      <section className="code-workbench panel-surface">
        <CodeEditor value={code} onChange={editCode} minHeight="260px" />
        <div className="run-row"><button className="secondary-action" onClick={reset}><RotateCcw /> Reset</button><button className="primary-action" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />} RUN IT</button></div>
        <p className="concept-line"><code>print()</code> sends something to the output.</p>
      </section>
      <section className={`terminal-stage panel-surface ${completed ? 'is-complete' : ''}`}>
        <header className={`print-task-card ${activity.extra ? 'is-extra' : ''}`}>
          <span>{activityIndex + 1}</span>
          <div><small>{activity.extra ? 'EXTRA' : `CORE ${activityIndex + 1} OF 5`}</small><strong>{activity.title}</strong><p>{activity.prompt}</p></div>
        </header>
        <div className={`terminal-screen ${outputState?.kind === 'error' ? 'has-error' : ''}`}>
          <div><TerminalSquare /> PIXPY OUTPUT</div><pre aria-live="polite">{outputState?.text ?? EMPTY_OUTPUT}</pre><span className="terminal-cursor" />
          {outputState?.kind === 'success' && <span className="print-success-reaction" aria-label="Activity complete"><Sparkles /> NICE! <Check /></span>}
        </div>
      </section>
      <nav className="print-activity-navigation panel-surface" aria-label="Print activities">
        <button className="print-step-button" onClick={() => chooseActivity(printActivities[activityIndex - 1].id)} disabled={activityIndex === 0}><ChevronLeft /> PREV</button>
        <div className="print-activity-dots">
          {printActivities.map((item, index) => {
            const done = progress.printPlaygroundCompleted.includes(item.id)
            return <button key={item.id} className={`${item.id === activityId ? 'is-active' : ''} ${done ? 'is-done' : ''} ${item.extra ? 'is-extra' : ''}`} onClick={() => chooseActivity(item.id)} aria-label={`${index + 1}. ${item.title}${item.extra ? ' — EXTRA' : ''}${done ? ' — complete' : ''}`} aria-current={item.id === activityId ? 'step' : undefined}>{done ? <Check /> : <span />}</button>
          })}
        </div>
        <span className="print-core-count">{progress.printPlaygroundCompleted.filter((id) => printCoreActivityIds.includes(id)).length}/5 CORE</span>
        <button className="print-step-button" onClick={() => chooseActivity(printActivities[activityIndex + 1].id)} disabled={activityIndex === printActivities.length - 1}>NEXT <ChevronRight /></button>
      </nav>
    </ExperienceShell>
  )
}
