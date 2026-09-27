import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildStopStarter } from '../../lib/stopAnalyzer'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { StopStringSheet } from './StopStringSheet'

const runner = vi.hoisted(() => {
  class PythonRunError extends Error {
    line: number | null
    constructor(message: string, line: number | null = null) {
      super(message)
      this.name = 'PythonRunError'
      this.line = line
    }
  }
  return { runScript: vi.fn(), PythonRunError }
})

vi.mock('../../lib/pythonRunner', () => ({
  pythonRunner: { runScript: runner.runScript, getState: () => 'ready', subscribe: () => () => undefined },
  PythonRunError: runner.PythonRunError,
}))

vi.mock('../../components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, label, attentionLine }: { value: string; onChange: (value: string) => void; label?: string; attentionLine?: number | null }) => (
    <textarea aria-label={label ?? 'Python code editor'} value={value} data-attention-line={attentionLine ?? undefined} onChange={(event) => onChange(event.target.value)} />
  ),
}))

function Harness({ initial, onUpdate }: { initial: SessionProgress; onUpdate?: (progress: SessionProgress) => void }) {
  const [progress, setProgress] = useState(initial)
  const update = useCallback((next: SessionProgress) => {
    setProgress(next)
    onUpdate?.(next)
  }, [onUpdate])
  return <StopStringSheet progress={progress} onProgress={update} onBack={() => undefined} />
}

const sixLabels = ['a', 'b', 'c', 'd', 'e', 'f']
  .flatMap((name) => [`${name} = "${name.toUpperCase()}"`, `print("${name.toUpperCase()}: " + ${name})`])
  .join('\n')

describe('STOP string sheet', () => {
  beforeEach(() => { runner.runScript.mockReset() })
  afterEach(cleanup)

  it('seeds the starter with the student name and builds the sheet without running', () => {
    render(<Harness initial={createSession('Maya')} />)
    expect(screen.getByLabelText('STOP sheet code editor')).toHaveValue(buildStopStarter('Maya'))
    const board = screen.getByLabelText('Stop sheet rows')
    expect(within(board).getByText('NAME')).toBeInTheDocument()
    expect(within(board).getByText('Maya')).toBeInTheDocument()
    expect(within(board).getByText('VALID')).toBeInTheDocument()
    expect(screen.getByText('SHEET LIVE')).toBeInTheDocument()
    expect(runner.runScript).not.toHaveBeenCalled()
  })

  it('updates the live sheet for concatenation, comma and f-string prints', () => {
    render(<Harness initial={createSession('Maya')} />)
    fireEvent.change(screen.getByLabelText('STOP sheet code editor'), {
      target: { value: 'name = "Ada"\nprint("Name: " + name)\nprint("Age:", 12)\nprint(f"City: {name}")' },
    })
    const board = screen.getByLabelText('Stop sheet rows')
    expect(within(board).getByText('NAME')).toBeInTheDocument()
    expect(within(board).getByText('AGE')).toBeInTheDocument()
    expect(within(board).getByText('CITY')).toBeInTheDocument()
    expect(within(board).getAllByText('VALID')).toHaveLength(3)
  })

  it('updates one column when a label repeats and keeps a COMBO chip for built values', () => {
    render(<Harness initial={createSession('Maya')} />)
    fireEvent.change(screen.getByLabelText('STOP sheet code editor'), {
      target: { value: 'first = "Ada"\nlast = "Lovelace"\nfull = first + " " + last\nprint("Name: " + first)\nprint("Name: " + full)' },
    })
    const board = screen.getByLabelText('Stop sheet rows')
    expect(within(board).getAllByText('NAME')).toHaveLength(1)
    expect(within(board).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(board).getByText('COMBO')).toBeInTheDocument()
  })

  it('confirms before restoring the starter code', async () => {
    const user = userEvent.setup()
    render(<Harness initial={createSession('Maya')} />)
    const editor = screen.getByLabelText('STOP sheet code editor')
    fireEvent.change(editor, { target: { value: 'print("Work I do not want to lose")' } })

    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.getByText('RESET CODE?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /keep mine/i }))
    expect(editor).toHaveValue('print("Work I do not want to lose")')

    await user.click(screen.getByRole('button', { name: /reset/i }))
    await user.click(screen.getByRole('button', { name: /^reset$/i }))
    expect(editor).toHaveValue(buildStopStarter('Maya'))
  })

  it('runs safely, shows a validation banner and reacts to the board', async () => {
    const user = userEvent.setup()
    runner.runScript.mockResolvedValue({ stdout: 'Name: Maya', variables: {} })
    render(<Harness initial={createSession('Maya')} />)
    await user.click(screen.getByRole('button', { name: /run/i }))
    expect(runner.runScript).toHaveBeenCalledWith(buildStopStarter('Maya'))
    expect(await screen.findByText('Python ran your code cleanly.')).toBeInTheDocument()
    expect(screen.getByText('Sheet updated. Add another category to grow the board.')).toBeInTheDocument()
  })

  it('shows a friendly error and highlights the failing line', async () => {
    const user = userEvent.setup()
    runner.runScript.mockImplementation(() => { throw new runner.PythonRunError("NameError: name 'answer2' is not defined", 4) })
    render(<Harness initial={createSession('Maya')} />)
    await user.click(screen.getByRole('button', { name: /run/i }))

    expect(await screen.findByText(/Line 4: NameError: Python does not know answer2 yet\./)).toBeInTheDocument()
    expect(screen.getByLabelText('STOP sheet code editor')).toHaveAttribute('data-attention-line', '4')
    expect(screen.getByText('CHECK CODE')).toBeInTheDocument()
    expect(screen.getByLabelText('STOP sheet code editor')).toHaveValue(buildStopStarter('Maya'))
  })

  it('maps fallback runner errors to friendly language', async () => {
    const user = userEvent.setup()
    runner.runScript.mockImplementation(() => { throw new Error('answer2 is not defined.') })
    render(<Harness initial={createSession('Maya')} />)
    await user.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByText(/NameError: Python does not know answer2 yet\./)).toBeInTheDocument()
  })

  it('runs with Ctrl+Enter and completes the activity at six labels', async () => {
    const updates: SessionProgress[] = []
    runner.runScript.mockResolvedValue({ stdout: '', variables: {} })
    render(<Harness initial={createSession('Maya')} onUpdate={(progress) => updates.push(progress)} />)

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(runner.runScript).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('STOP sheet code editor'), { target: { value: sixLabels } })
    expect(await screen.findByText('STOP! SHEET COMPLETE')).toBeInTheDocument()
    expect(screen.getByText('STOP READY')).toBeInTheDocument()
    expect(updates.some((progress) => progress.completed.includes('stop'))).toBe(true)
    expect(updates.some((progress) => progress.stopSheetComplete)).toBe(true)
  })
})
