import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { InputMachine } from './InputMachine'
import { MemoryMachine } from './MemoryMachine'
import { FinalBosses } from './FinalBosses'

const { runScript } = vi.hoisted(() => ({ runScript: vi.fn() }))
vi.mock('../../lib/pythonRunner', () => ({ pythonRunner: { runScript } }))
vi.mock('../../components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Python code editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}))

const activities = { memory: MemoryMachine, bosses: FinalBosses }
function Harness({ activity, initial = createSession('Maya'), onUpdate = () => {}, onNext = () => {} }: {
  activity: 'input' | keyof typeof activities; initial?: SessionProgress; onUpdate?: (next: SessionProgress) => void; onNext?: () => void
}) {
  const [progress, setProgress] = useState(initial)
  const props = { progress, onProgress: (next: SessionProgress) => { setProgress(next); onUpdate(next) }, onBack: () => {} }
  if (activity === 'input') return <InputMachine {...props} onNext={onNext} />
  const Activity = activities[activity]
  return <Activity {...props} />
}

beforeEach(() => runScript.mockReset())

async function enterInputLab() {
  fireEvent.click(screen.getByRole('button', { name: /open the lab/i }))
  expect(screen.getByLabelText('YOUR MESSAGE')).toBeInTheDocument()
}

async function runInputMachine(buttonName: RegExp) {
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  await act(async () => vi.runAllTimersAsync())
  vi.useRealTimers()
}

it('guides a change, explains the catch, checks the fix, and completes the quick quiz', async () => {
  runScript.mockResolvedValue({ stdout: 'Maya', variables: {} })
  const onNext = vi.fn()
  render(<Harness activity="input" onNext={onNext} />)
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
  fireEvent.click(screen.getByRole('button', { name: /finish input machine/i }))
  expect(screen.getByText('EXPLORED')).toBeInTheDocument()
  const nextExperiment = screen.getByRole('button', { name: /next experiment: memory machine/i })
  expect(nextExperiment).toHaveClass('next-experiment-button')
  fireEvent.click(nextExperiment)
  expect(onNext).toHaveBeenCalledOnce()
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

it('traces code through memory, requires an experiment, and opens a three-question checkpoint', async () => {
  runScript.mockResolvedValue({ stdout: '9', variables: { x: 9 } })
  render(<Harness activity="memory" />)

  fireEvent.click(screen.getByRole('button', { name: /^next/i }))
  fireEvent.click(screen.getByRole('button', { name: /x = 3/i }))
  fireEvent.click(screen.getByRole('button', { name: /^next/i }))
  fireEvent.click(screen.getByRole('button', { name: /start the machine/i }))
  fireEvent.click(screen.getByRole('button', { name: /see it move/i }))

  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: /execute line 1/i }))
  await act(async () => vi.runAllTimersAsync())
  expect(screen.getByRole('button', { name: /execute line 2/i })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: /execute line 2/i }))
  await act(async () => vi.runAllTimersAsync())
  vi.useRealTimers()
  expect(screen.getByText('TRY THIS')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /experiment first/i })).toBeDisabled()

  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'x = 9  # Try another number\nprint(x)' } })
  vi.useFakeTimers()
  fireEvent.click(screen.getByRole('button', { name: /execute line 1/i }))
  await act(async () => vi.runAllTimersAsync())
  fireEvent.click(screen.getByRole('button', { name: /execute line 2/i }))
  await act(async () => vi.runAllTimersAsync())
  vi.useRealTimers()

  expect(screen.getByText('x')).toBeInTheDocument()
  expect(screen.getAllByText('9').length).toBeGreaterThan(0)
  const quiz = screen.getByRole('button', { name: /quick quiz/i })
  expect(quiz).toBeEnabled()
  fireEvent.click(quiz)

  const next = screen.getByRole('button', { name: /next question/i })
  expect(next).toBeDisabled()
  fireEvent.click(document.querySelector('.chapter-quiz-options button')!)
  expect(screen.getByText(/x is the name/i)).toBeInTheDocument()
  expect(next).toBeEnabled()
  fireEvent.click(next)
  expect(screen.getByText('What value is stored in x?')).toBeInTheDocument()
})

it('preserves a boss solution when exploring another challenge', () => {
  render(<Harness activity="bosses" />)
  fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'result = a + b' } })
  fireEvent.click(screen.getByRole('button', { name: 'Boss 2: Difference' }))
  fireEvent.click(screen.getByRole('button', { name: 'Boss 1: Two Numbers' }))
  expect(screen.getByLabelText('Python code editor')).toHaveValue('result = a + b')
})

it('unlocks boss missions in completed groups of three', () => {
  const first = render(<Harness activity="bosses" />)
  expect(screen.getByRole('button', { name: 'Boss 3: Double It' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Boss 4: Triple It, locked' })).toBeDisabled()
  first.unmount()

  render(<Harness activity="bosses" initial={{ ...createSession('Maya'), bossProgress: [1, 2, 3] }} />)
  expect(screen.getByRole('button', { name: 'Boss 4: Triple It' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Boss 7: Celsius to Fahrenheit, locked' })).toBeDisabled()
})

it('runs three surprise phone tests before completing a boss mission', async () => {
  runScript.mockImplementation((_code: string, inputs: string[] = []) => Promise.resolve({
    stdout: inputs.length === 2 ? String(Number(inputs[0]) + Number(inputs[1])) : '',
    variables: {},
  }))
  vi.useFakeTimers()
  try {
    render(<Harness activity="bosses" />)
    fireEvent.change(screen.getByLabelText('Python code editor'), { target: { value: 'a = int(input())\nb = int(input())\nresult = a + b\nprint(result)' } })
    fireEvent.click(screen.getByRole('button', { name: /run 3 tests/i }))

    await act(async () => vi.runAllTimersAsync())

    expect(runScript).toHaveBeenCalledTimes(3)
    expect(screen.getAllByText('PASSED')).toHaveLength(3)
    expect(screen.getByText('All 3 tests passed. Mission complete!')).toBeInTheDocument()
    expect(screen.queryByText(/expected/i)).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})
