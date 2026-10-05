import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { ifElseProblems, parseProblemInput, problemLines } from '../../data/ifElseBuilder'
import { ifElsePedagogy } from '../../data/ifElsePedagogy'
import { splitCondition } from '../../lib/ifElseLearning'
import { PythonRunError, pythonRunner } from '../../lib/pythonRunner'
import { createSession } from '../../session/progressSession'
import { IfElseBuilder } from './IfElseBuilder'

function Harness() {
  const [progress, setProgress] = useState(createSession('Maya'))
  return <><IfElseBuilder progress={progress} onProgress={setProgress} onBack={() => {}} /><output data-testid="completed">{progress.completed.join(',')}</output><output data-testid="learning">{JSON.stringify(progress.ifElseLearning)}</output></>
}

const bank = () => within(document.querySelector('.ieb-bank') as HTMLElement)
const check = () => fireEvent.click(screen.getByRole('button', { name: 'CHECK CODE + RUN' }))
const retry = () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'TRY AGAIN' }))
function build(index: number) {
  for (const line of problemLines(ifElseProblems[index], ifElsePedagogy[index].useInput)) fireEvent.click(bank().getByRole('button', { name: `Add ${line.trim()}` }))
}
async function advance() {
  const dialog = await screen.findByRole('dialog', { name: /level cleared/i })
  fireEvent.click(within(dialog).getByRole('button', { name: 'NEXT PROBLEM' }))
}
function chooseExpression(index: number) {
  const parts = splitCondition(ifElseProblems[index].condition)
  for (const part of ['left', 'operator', 'right'] as const) fireEvent.click(screen.getByRole('button', { name: `Choose ${part === 'operator' ? 'operator' : `${part} value`} ${parts[part]}` }))
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('IF/ELSE learning progression', () => {
  it('fades support through all ten existing missions, records predictions, and completes only after independent construction', async () => {
    render(<Harness />)
    // 1: all correct pieces, visible structure and both paths, no distractors.
    expect(bank().getAllByRole('button')).toHaveLength(5)
    expect(screen.getByText('Read a value')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'The two paths' })).toBeInTheDocument()
    build(0); check()
    const first = await screen.findByRole('dialog', { name: 'Level cleared!' })
    expect(within(first).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('12 <= 12')
    expect(within(first).getByText('TRUE', { selector: 'code' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    await advance()
    // 2: necessary chunks in a different order; 3: meaningful decoys.
    expect(bank().getAllByRole('button')[0]).not.toHaveAccessibleName(`Add ${problemLines(ifElseProblems[1], false)[0]}`)
    build(1); check(); await advance()
    expect(bank().getAllByRole('button')).toHaveLength(7)
    build(2); check(); await advance()
    // 4: an incorrect prediction unlocks building, without being punished.
    expect(bank().getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Predict Level unlocked' }))
    build(3); check()
    let dialog = await screen.findByRole('dialog', { name: 'Level cleared!' })
    expect(within(dialog).getByText(/your prediction was different/i)).toBeInTheDocument()
    expect(within(dialog).getByText('Keep playing', { selector: 'b' })).toBeInTheDocument()
    await advance()
    // 5: choose the comparison rather than arrange the whole program.
    expect(document.querySelector('.ieb-bank')).toBeNull()
    expect(document.querySelectorAll('.ieb-fixed-line')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Choose operator !=' })); check()
    dialog = await screen.findByRole('dialog', { name: 'Check the condition.' })
    expect(within(dialog).getByText('Check the condition.', { selector: 'p' })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('Access denied')
    expect(within(dialog).queryByText(ifElseProblems[4].explanation)).not.toBeInTheDocument()
    retry(); fireEvent.click(screen.getByRole('button', { name: 'Choose operator ==' })); check(); await advance()
    // 6: a missing ELSE and hidden branch actions; invalid input blocks running.
    const paths = screen.getByRole('region', { name: 'The two paths' })
    expect(paths).not.toHaveTextContent('Approved')
    expect(bank().getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(true)
    fireEvent.click(bank().getByRole('button', { name: 'Add grade = float(input())' }))
    fireEvent.change(screen.getByLabelText('grade input'), { target: { value: 'abc' } })
    expect(screen.getByRole('button', { name: 'CHECK CODE + RUN' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('grade input'), { target: { value: '7.25' } }); check()
    await screen.findByRole('dialog', { name: 'Check the structure.' }); retry()
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 4' }))
    fireEvent.click(bank().getByRole('button', { name: 'Add else:' })); check()
    await screen.findByRole('dialog', { name: 'Level cleared!' })
    fireEvent.click(screen.getByRole('button', { name: 'TRY ANOTHER VALUE' }))
    fireEvent.change(screen.getByLabelText('grade input'), { target: { value: '6.75' } }); check()
    dialog = await screen.findByRole('dialog', { name: 'Level cleared!' })
    expect(within(dialog).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('Try again')
    await advance()
    // 7: valid wrong code actually executes; it cannot pass on a lucky input.
    expect(screen.queryByRole('region', { name: 'The two paths' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose operator >=' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('age input'), { target: { value: '17' } }); check()
    dialog = await screen.findByRole('dialog', { name: 'The logic needs fixing.' })
    expect(within(dialog).getByText(/code runs, but it does not match the mission/)).toHaveTextContent('This input can look right')
    expect(within(dialog).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('Not old enough yet')
    retry(); fireEvent.click(screen.getByRole('button', { name: 'Choose operator >=' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use starting value (18)' })); check()
    dialog = await screen.findByRole('dialog', { name: 'Level cleared!' })
    expect(within(dialog).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('You can vote')
    await advance()
    // 8-9: expressions are built from choices, without a complete condition.
    for (const index of [7, 8]) {
      expect(document.querySelector('.ieb-code')).not.toHaveTextContent(ifElseProblems[index].condition)
      expect(screen.queryByRole('region', { name: 'The two paths' })).not.toBeInTheDocument()
      chooseExpression(index)
      fireEvent.click(screen.getByRole('button', { name: `Use starting value (${ifElseProblems[index].initial})` }))
      check(); await advance()
    }
    // 10: derive a comparison, map the actions, and predict the truth result.
    expect(screen.getByTestId('completed')).toBeEmptyDOMElement()
    expect(document.querySelector('.ieb-code')).not.toHaveTextContent(ifElseProblems[9].condition)
    chooseExpression(9)
    const final = ifElseProblems[9]
    fireEvent.click(screen.getByRole('button', { name: 'Use starting value (50)' }))
    fireEvent.click(screen.getByRole('button', { name: `Use ${final.falseOutput} in IF` }))
    fireEvent.click(screen.getByRole('button', { name: `Use ${final.trueOutput} in ELSE` }))
    fireEvent.click(screen.getByRole('button', { name: 'MAKE A PREDICTION' }))
    expect(screen.getByRole('button', { name: 'Predict TRUE' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Predict FALSE' })); check()
    dialog = await screen.findByRole('dialog', { name: 'Check the branch action.' })
    expect(within(dialog).getByRole('region', { name: 'Python decision trace' })).toHaveTextContent('Delivery fee applies')
    retry()
    fireEvent.click(screen.getByRole('button', { name: `Use ${final.trueOutput} in IF` }))
    fireEvent.click(screen.getByRole('button', { name: `Use ${final.falseOutput} in ELSE` })); check()
    dialog = await screen.findByRole('dialog', { name: 'Final level cleared!' })
    expect(within(dialog).getByText(/predictions do not count as errors/)).toBeInTheDocument()
    expect(screen.getByTestId('completed')).toBeEmptyDOMElement()
    fireEvent.click(within(dialog).getByRole('button', { name: 'FINISH ACTIVITY' }))
    expect(screen.getByRole('heading', { name: 'You built both paths.' })).toBeInTheDocument()
    expect(screen.getByTestId('completed')).toHaveTextContent('if-else')
    const events = JSON.parse(screen.getByTestId('learning').textContent ?? '[]')
    expect(events).toContainEqual(expect.objectContaining({ level: 4, kind: 'prediction', prediction: 'Level unlocked' }))
    expect(events).toContainEqual(expect.objectContaining({ level: 4, kind: 'check', prediction: 'Level unlocked', actualOutput: 'Keep playing', errorKind: null }))
    expect(events).toContainEqual(expect.objectContaining({ level: 7, kind: 'check', errorKind: 'logic' }))
    fireEvent.click(screen.getByRole('button', { name: 'PLAY AGAIN' }))
    expect(screen.getByRole('heading', { name: 'Movie night' })).toBeInTheDocument()
    expect(bank().getAllByRole('button')).toHaveLength(5)
  }, 60_000)

  it('uses progressive structure feedback, preserves the build, and reveals a model only on request after four attempts', () => {
    render(<Harness />)
    const runner = vi.spyOn(pythonRunner, 'runScript')
    for (const line of problemLines(ifElseProblems[0], false).reverse()) fireEvent.click(bank().getByRole('button', { name: `Add ${line.trim()}` }))
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      check()
      const dialog = screen.getByRole('dialog', { name: 'Check the structure.' })
      expect(within(dialog).queryByText('MODEL FOR THIS PIECE')).not.toBeInTheDocument()
      if (attempt === 1) expect(within(dialog).getByText('Check the structure and line order.')).toBeInTheDocument()
      if (attempt === 2) expect(within(dialog).getByText(/Python reads from top to bottom/)).toBeInTheDocument()
      if (attempt === 3) expect(within(dialog).getByText(/else: lines up with if/)).toBeInTheDocument()
      if (attempt === 4) {
        fireEvent.click(within(dialog).getByRole('button', { name: 'SHOW A MODEL OF THIS PIECE' }))
        expect(within(dialog).getByText('MODEL FOR THIS PIECE')).toBeInTheDocument()
      }
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.getByRole('button', { name: 'Remove line 1' })).toHaveFocus()
      expect(document.querySelectorAll('.ieb-code .is-filled')).toHaveLength(5)
    }
    expect(runner).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'NEXT PROBLEM' })).not.toBeInTheDocument()
  })

  it('separates a runtime failure from a mission mismatch', async () => {
    vi.spyOn(pythonRunner, 'runScript').mockRejectedValueOnce(new PythonRunError('Python is temporarily unavailable.'))
    render(<Harness />); build(0); check()
    const dialog = await screen.findByRole('dialog', { name: 'Run paused.' })
    expect(within(dialog).getByText('Python is temporarily unavailable.')).toBeInTheDocument()
    expect(within(dialog).queryByText(/code runs, but/)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'BACK TO MY CODE' })); check()
    await screen.findByRole('dialog', { name: 'Level cleared!' })
  })

  it('highlights execution in order and cancels animation on unmount', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    vi.useFakeTimers()
    const record = vi.fn()
    const mounted = render(<IfElseBuilder progress={createSession('Maya')} onProgress={record} onBack={() => {}} />)
    build(0); check()
    await act(async () => { await Promise.resolve() })
    expect(document.querySelector('.ieb-code .is-executing > span')).toHaveTextContent('1')
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(document.querySelector('.ieb-code .is-executing > span')).toHaveTextContent('2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.ieb-output')).toBeNull()
    await act(async () => { vi.advanceTimersByTime(960) })
    expect(document.querySelector('.ieb-code .is-executing > span')).toHaveTextContent('3')
    expect(screen.getByRole('dialog', { name: 'Level cleared!' })).toBeInTheDocument()
    expect(record).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'REVIEW MY CODE' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear program' }))
    build(0); check()
    await act(async () => { await Promise.resolve() })
    mounted.unmount()
    await act(async () => { vi.runAllTimers() })
    expect(record).toHaveBeenCalledTimes(1)
  })

  it('accepts valid decimal inputs and rejects fractional ages and invalid numbers', () => {
    expect(parseProblemInput(ifElseProblems[5], '7.25')).toBe(7.25)
    expect(parseProblemInput(ifElseProblems[5], '10.25')).toBeNull()
    expect(parseProblemInput(ifElseProblems[6], '18.5')).toBeNull()
    expect(parseProblemInput(ifElseProblems[8], '-3')).toBe(-3)
    for (const value of ['', 'NaN', 'Infinity', '2abc', '1e3']) expect(parseProblemInput(ifElseProblems[9], value)).toBeNull()
  })
})
