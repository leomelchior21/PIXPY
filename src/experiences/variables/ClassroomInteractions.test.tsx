import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

async function enterInputLab() {
  fireEvent.click(screen.getByRole('button', { name: /let python listen/i }))
  expect(screen.getByLabelText('YOUR AGE')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('YOUR AGE'), { target: { value: '12' } })
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: /calculate birth year/i }))
  await act(async () => vi.advanceTimersByTime(1200))
  vi.useRealTimers()
  expect(screen.getByText('2014')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /how did it do that/i }))
  fireEvent.click(screen.getByRole('button', { name: /stored my age/i }))
  fireEvent.click(screen.getByRole('button', { name: /show me the code/i }))
  expect(screen.getByText('age = int(input())')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /build it step by step/i }))
  fireEvent.click(screen.getByRole('button', { name: /open the lab/i }))
}

async function runInputMachine(buttonName: RegExp) {
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  await act(async () => vi.runAllTimersAsync())
  vi.useRealTimers()
}

it('guides a change, explains the catch, checks the fix, and opens the chapter quiz', async () => {
  runScript.mockResolvedValue({ stdout: 'Maya', variables: {} })
  render(<Harness activity="input" />)
  await enterInputLab()
  fireEvent.change(screen.getByLabelText('YOUR MESSAGE'), { target: { value: 'Maya' } })
  await runInputMachine(/send input/i)
  expect(screen.getByText('TRY THIS')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: '# Try replacing input() with your name in quotes\nmessage = "Maya"\nprint(message)' } })
  await runInputMachine(/run code/i)
  expect(screen.getByText('DID YOU NOTICE?')).toBeInTheDocument()
  expect(screen.getByText(/stopped listening because input\(\) is gone/i)).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: '# Try replacing input() with your name in quotes\nmessage = input()\nprint(message)' } })
  await runInputMachine(/run code/i)
  const quickQuiz = screen.getByRole('button', { name: /quick quiz/i })
  expect(quickQuiz).toBeEnabled()
  fireEvent.click(quickQuiz)

  fireEvent.click(screen.getByRole('button', { name: /message$/i }))
  fireEvent.click(screen.getByRole('button', { name: /next question/i }))
  fireEvent.click(screen.getByRole('button', { name: /rocket$/i }))
  fireEvent.click(screen.getByRole('button', { name: /next question/i }))
  fireEvent.click(screen.getByRole('button', { name: /message = input\(\)$/i }))
  fireEvent.click(screen.getByRole('button', { name: /next chapter/i }))
  expect(screen.getByText('Now make the input grow.')).toBeInTheDocument()
}, 15_000)

it('sends the typed value, shows errors, and does not award completion for an error', async () => {
  const update = vi.fn()
  runScript.mockRejectedValueOnce(new Error('Use a whole number.'))
  render(<Harness activity="input" onUpdate={update} />)
  await enterInputLab()
  fireEvent.click(screen.getByRole('button', { name: /send input/i }))
  expect(screen.getByText(/type something in the message field first/i)).toBeInTheDocument()
  expect(runScript).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'message = int(input())\nprint(message)' } })
  fireEvent.change(screen.getByLabelText('YOUR MESSAGE'), { target: { value: 'hello' } })
  await runInputMachine(/send input/i)
  expect(runScript).toHaveBeenCalledWith(expect.stringContaining('int(input())'), ['hello'])
  await waitFor(() => expect(screen.getByText('Use a whole number.')).toBeInTheDocument(), { timeout: 2000 })
  expect(update).not.toHaveBeenCalled()
}, 10_000)

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
