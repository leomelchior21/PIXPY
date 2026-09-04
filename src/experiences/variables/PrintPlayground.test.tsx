import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPrintActivity } from '../../data/printActivities'
import { createSession } from '../../session/progressSession'
import type { ScriptRunResult, SessionProgress } from '../../types'
import { PrintPlayground } from './PrintPlayground'

const { runScript } = vi.hoisted(() => ({ runScript: vi.fn() }))

vi.mock('../../lib/pythonRunner', () => ({ pythonRunner: { runScript } }))
vi.mock('../../components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Python code editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

function Harness({ initial, onUpdate = () => undefined }: { initial: SessionProgress; onUpdate?: (progress: SessionProgress) => void }) {
  const [progress, setProgress] = useState(initial)
  const update = useCallback((next: SessionProgress) => {
    setProgress(next)
    onUpdate(next)
  }, [onUpdate])
  return <PrintPlayground progress={progress} onProgress={update} onBack={() => undefined} />
}

describe('Print Playground screen', () => {
  beforeEach(() => runScript.mockReset())
  afterEach(cleanup)

  it('restores saved activity code and output state', () => {
    const progress = {
      ...createSession('Maya'),
      printPlaygroundActivity: 'draw-frame' as const,
      printPlaygroundCode: { 'draw-frame': 'print("saved frame")' },
      printPlaygroundOutputs: { 'draw-frame': { text: 'saved output', kind: 'output' as const } },
      printPlaygroundVisited: ['draw-frame' as const],
    }
    render(<Harness initial={progress} />)
    expect(screen.getByText('Draw a frame', { selector: '.print-task-card strong' })).toBeInTheDocument()
    expect(screen.getByLabelText('Python code editor')).toHaveValue('print("saved frame")')
    expect(screen.getByText('saved output')).toBeInTheDocument()
  })

  it('resets only the active activity to its starter and clears its output', async () => {
    const user = userEvent.setup()
    const progress = {
      ...createSession('Maya'),
      printPlaygroundActivity: 'draw-frame' as const,
      printPlaygroundCode: { 'morning-chat': 'print("keep me")', 'draw-frame': 'print("change me")' },
      printPlaygroundOutputs: { 'draw-frame': { text: 'old error', kind: 'error' as const } },
      printPlaygroundVisited: ['draw-frame' as const],
    }
    render(<Harness initial={progress} />)
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.getByLabelText('Python code editor')).toHaveValue(getPrintActivity('draw-frame').starterCode)
    expect(screen.getByText('Your output appears here.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^1\. Bom dia, chat!/i }))
    expect(screen.getByLabelText('Python code editor')).toHaveValue('print("keep me")')
  })

  it('clears stale output, errors, and success feedback immediately after an edit', () => {
    const progress = {
      ...createSession('Maya'),
      printPlaygroundOutputs: { 'morning-chat': { text: 'old failure', kind: 'error' as const } },
      printPlaygroundVisited: ['morning-chat' as const],
    }
    render(<Harness initial={progress} />)
    expect(screen.getByText('old failure')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'print("new")' } })
    expect(screen.queryByText('old failure')).not.toBeInTheDocument()
    expect(screen.getByText('Your output appears here.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Activity complete')).not.toBeInTheDocument()
  })

  it('runs through the existing runner, preserves output, and reacts only to a valid result', async () => {
    const user = userEvent.setup()
    runScript.mockResolvedValue({ stdout: 'Bom dia, chat!', variables: {} })
    let latest = createSession('Maya')
    render(<Harness initial={{ ...latest, printPlaygroundCode: { 'morning-chat': 'print("Bom dia, chat!")' }, printPlaygroundVisited: ['morning-chat'] }} onUpdate={(progress) => { latest = progress }} />)

    await user.click(screen.getByRole('button', { name: /run it/i }))
    expect(await screen.findByText('Bom dia, chat!', { selector: '.terminal-screen pre' })).toBeInTheDocument()
    expect(screen.getByLabelText('Activity complete')).toBeInTheDocument()
    expect(latest.printPlaygroundCompleted).toContain('morning-chat')
    expect(runScript).toHaveBeenCalledWith('print("Bom dia, chat!")')
  })

  it('ignores a late execution result after the code changes', async () => {
    let resolveRun!: (result: ScriptRunResult) => void
    runScript.mockReturnValue(new Promise((resolve) => { resolveRun = resolve }))
    let latest = createSession('Maya')
    render(<Harness initial={{ ...latest, printPlaygroundCode: { 'morning-chat': 'print("Bom dia, chat!")' }, printPlaygroundVisited: ['morning-chat'] }} onUpdate={(progress) => { latest = progress }} />)

    await userEvent.click(screen.getByRole('button', { name: /run it/i }))
    fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'print("changed")' } })
    await act(async () => resolveRun({ stdout: 'Bom dia, chat!', variables: {} }))

    await waitFor(() => expect(screen.getByText('Your output appears here.')).toBeInTheDocument())
    expect(screen.queryByLabelText('Activity complete')).not.toBeInTheDocument()
    expect(latest.printPlaygroundCompleted).not.toContain('morning-chat')
  })

  it('does not let completed extras satisfy core completion', async () => {
    const user = userEvent.setup()
    runScript.mockResolvedValue({ stdout: 'Bom dia, chat!', variables: {} })
    let latest = createSession('Maya')
    const progress = {
      ...latest,
      printPlaygroundCode: { 'morning-chat': 'print("Bom dia, chat!")' },
      printPlaygroundVisited: ['morning-chat' as const],
      printPlaygroundCompleted: ['player-id-card', 'crack-code', 'launch-countdown'] as SessionProgress['printPlaygroundCompleted'],
    }
    render(<Harness initial={progress} onUpdate={(next) => { latest = next }} />)
    await user.click(screen.getByRole('button', { name: /run it/i }))
    await waitFor(() => expect(latest.printPlaygroundCompleted).toContain('morning-chat'))
    expect(latest.completed).not.toContain('print-playground')
  })

  it('marks the parent experience complete when the fifth core activity succeeds', async () => {
    const user = userEvent.setup()
    runScript.mockResolvedValue({ stdout: 'M\nA\nY\nA\n2026', variables: {} })
    let latest = createSession('Maya')
    const progress = {
      ...latest,
      printPlaygroundActivity: 'initials-banner' as const,
      printPlaygroundCode: { 'initials-banner': 'print("M")\nprint("A")\nprint("Y")\nprint("A")\nprint("2026")' },
      printPlaygroundVisited: ['initials-banner' as const],
      printPlaygroundCompleted: ['morning-chat', 'introduce-yourself', 'blank-line', 'draw-frame'] as SessionProgress['printPlaygroundCompleted'],
    }
    render(<Harness initial={progress} onUpdate={(next) => { latest = next }} />)
    await user.click(screen.getByRole('button', { name: /run it/i }))
    await waitFor(() => expect(latest.completed).toContain('print-playground'))
  })

  it('labels and classes optional activities as purple extras', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness initial={{ ...createSession('Maya'), printPlaygroundVisited: ['morning-chat'] }} />)
    const extraButton = screen.getByRole('button', { name: /6\. Player ID card — EXTRA/i })
    expect(extraButton).toHaveClass('is-extra')
    await user.click(extraButton)
    expect(screen.getByText('EXTRA')).toBeInTheDocument()
    expect(container.querySelector('.print-experience--extra')).toBeInTheDocument()
    expect(container.querySelector('.print-task-card.is-extra')).toBeInTheDocument()
  })
})
