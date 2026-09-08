import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { InputMachine } from './InputMachine'
import { BuildBlackBox } from './BuildBlackBox'
import { MemoryMachine } from './MemoryMachine'
import { FinalBosses } from './FinalBosses'

const { runScript } = vi.hoisted(() => ({ runScript: vi.fn() }))
vi.mock('../../lib/pythonRunner', () => ({ pythonRunner: { runScript } }))
vi.mock('../../components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Python code editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

const activities = { input: InputMachine, build: BuildBlackBox, memory: MemoryMachine, bosses: FinalBosses }
function Harness({ activity, initial = createSession('Maya'), onUpdate = () => {} }: {
  activity: keyof typeof activities; initial?: SessionProgress; onUpdate?: (next: SessionProgress) => void
}) {
  const [progress, setProgress] = useState(initial)
  const Activity = activities[activity]
  return <Activity progress={progress} onProgress={(next) => { setProgress(next); onUpdate(next) }} onBack={() => {}} />
}

beforeEach(() => runScript.mockReset())

it('keeps machine drafts when switching and restores only the active starter on reset', () => {
  render(<Harness activity="input" />)
  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'print("my draft")' } })
  fireEvent.change(screen.getByLabelText('YOUR MESSAGE'), { target: { value: 'Maya' } })
  fireEvent.click(screen.getByRole('button', { name: 'DOUBLE' }))
  fireEvent.click(screen.getByRole('button', { name: 'RAW INPUT' }))
  expect(screen.getByLabelText('Python code editor')).toHaveValue('print("my draft")')
  expect(screen.getByLabelText('YOUR MESSAGE')).toHaveValue('Maya')
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByLabelText('Python code editor')).toHaveValue('message = input()\nprint(message)')
})

it('sends the typed value, shows errors, and does not award completion for an error', async () => {
  const update = vi.fn()
  runScript.mockRejectedValueOnce(new Error('Use a whole number.'))
  render(<Harness activity="input" onUpdate={update} />)
  fireEvent.click(screen.getByRole('button', { name: 'DOUBLE' }))
  fireEvent.change(screen.getByLabelText('YOUR NUMBER'), { target: { value: 'hello' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'SEND' })))
  expect(runScript).toHaveBeenCalledWith(expect.stringContaining('int(input())'), ['hello'])
  expect(screen.getByText('Use a whole number.')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})

it('clears evidence when a box rule changes and requires new tests of that rule', async () => {
  const initial = { ...createSession('Maya'), blackBoxCode: 'number = int(input())\nresult = number * 2\nprint(result)', blackBoxTests: [{ input: 10, output: 20 }] }
  let latest = initial as SessionProgress
  render(<Harness activity="build" initial={initial} onUpdate={(next) => { latest = next }} />)
  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'number = int(input())\nresult = number + 1\nprint(result)' } })
  expect(latest.blackBoxTests).toEqual([])
  runScript.mockResolvedValue({ stdout: '11', variables: {} })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'TEST 10' })))
  expect(latest.blackBoxTests).toEqual([{ input: 10, output: 11 }])
  expect(latest.completed).not.toContain('build-black-box')
  fireEvent.change(screen.getByLabelText('Test input'), { target: { value: '20' } })
  runScript.mockResolvedValue({ stdout: '21', variables: {} })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'TEST 20' })))
  expect(latest.completed).toContain('build-black-box')
})

it('does not treat empty output as the number zero', async () => {
  runScript.mockResolvedValue({ stdout: '', variables: {} })
  render(<Harness activity="build" />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'TEST 10' })))
  expect(screen.getByText(/use print\(result\) to send one number/i)).toBeInTheDocument()
})

it('keeps quiz feedback until Next, and allows revisiting examples without erasing quiz progress', () => {
  render(<Harness activity="memory" initial={{ ...createSession('Maya'), memoryExamples: ['create', 'change', 'two', 'reuse', 'input'] }} />)
  expect(screen.getByText(/quiz unlocked/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /start quiz/i }))
  const next = screen.getByRole('button', { name: /next question/i })
  expect(next).toBeDisabled()
  fireEvent.click(document.querySelector('.memory-quiz-options button')!)
  expect(next).toBeEnabled()
  expect(document.querySelector('.memory-quiz-header > strong')).toHaveTextContent('1/10')
  fireEvent.click(next)
  expect(document.querySelector('.memory-quiz-header > strong')).toHaveTextContent('2/10')
  fireEvent.click(screen.getByRole('button', { name: /revisit the examples/i }))
  expect(screen.getByRole('button', { name: /execute line 1/i })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /return to quiz/i }))
  expect(document.querySelector('.memory-quiz-header > strong')).toHaveTextContent('2/10')
})

it('preserves a boss solution when exploring another challenge', () => {
  render(<Harness activity="bosses" />)
  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'result = a + b' } })
  fireEvent.click(screen.getByRole('button', { name: 'Boss 2: Difference' }))
  fireEvent.click(screen.getByRole('button', { name: 'Boss 1: Two Numbers' }))
  expect(screen.getByLabelText('Python code editor')).toHaveValue('result = a + b')
})
