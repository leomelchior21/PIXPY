import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { ifElseProblems, parseProblemInput, problemLines } from '../../data/ifElseBuilder'
import { createSession } from '../../session/progressSession'
import { IfElseBuilder } from './IfElseBuilder'

function Harness() {
  const [progress, setProgress] = useState(createSession('Maya'))
  return <><IfElseBuilder progress={progress} onProgress={setProgress} onBack={() => {}} /><output data-testid="completed">{progress.completed.join(',')}</output></>
}

function build(index: number) {
  for (const line of problemLines(ifElseProblems[index], index >= 5)) fireEvent.click(screen.getByRole('button', { name: `Add ${line.trim()}` }))
}

describe('IF/ELSE code builder', () => {
  it('rejects a wrong boundary condition and lets the student remove and replace chunks', async () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'CHECK CODE' })).toBeDisabled()
    const problem = ifElseProblems[0]
    const lines = problemLines(problem, false)
    for (const line of [lines[0], `if ${problem.wrongCondition}:`, ...lines.slice(2)]) fireEvent.click(screen.getByRole('button', { name: `Add ${line.trim()}` }))
    fireEvent.click(screen.getByRole('button', { name: 'CHECK CODE' }))
    expect(screen.getByText('Try another order or condition.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next problem/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear program' }))
    build(0)
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }))
    expect(screen.getByRole('button', { name: `Add ${lines[1]}` })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'CHECK CODE' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Clear program' }))
    build(0)
    fireEvent.click(screen.getByRole('button', { name: 'CHECK CODE' }))
    await screen.findByText('Nice build!')
    expect(screen.getByText('You get a child discount!', { selector: 'pre' })).toBeInTheDocument()
  })

  it('rejects correct chunks in the wrong order', () => {
    render(<Harness />)
    for (const line of problemLines(ifElseProblems[0], false).reverse()) fireEvent.click(screen.getByRole('button', { name: `Add ${line.trim()}` }))
    fireEvent.click(screen.getByRole('button', { name: 'CHECK CODE' }))
    expect(screen.getByText('Try another order or condition.')).toBeInTheDocument()
  })

  it('runs all ten programs, requires input from problem six, and marks completion only at the end', async () => {
    render(<Harness />)
    for (let index = 0; index < ifElseProblems.length; index += 1) {
      const problem = ifElseProblems[index]
      build(index)
      const check = screen.getByRole('button', { name: index >= 5 ? 'CHECK + RUN' : 'CHECK CODE' })
      if (index >= 5) {
        expect(check).toBeDisabled()
        const input = screen.getByLabelText(`${problem.variable} input`)
        fireEvent.change(input, { target: { value: 'abc' } })
        expect(check).toBeDisabled()
        fireEvent.change(input, { target: { value: String(problem.initial) } })
      } else expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      fireEvent.click(check)
      await screen.findByText('Nice build!')
      expect(document.querySelector('.ieb-output pre')?.textContent).toBeTruthy()
      expect(screen.getByTestId('completed')).toBeEmptyDOMElement()
      if (index === 5) {
        const input = screen.getByLabelText('grade input')
        expect(document.querySelector('.ieb-output pre')).toHaveTextContent('Approved')
        fireEvent.change(input, { target: { value: '6.75' } })
        expect(screen.queryByRole('button', { name: /next problem/i })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'CHECK + RUN' }))
        await waitFor(() => expect(document.querySelector('.ieb-output pre')).toHaveTextContent('Try again'))
      }
      fireEvent.click(screen.getByRole('button', { name: index === 9 ? 'FINISH ACTIVITY' : 'NEXT PROBLEM' }))
    }
    expect(screen.getByRole('heading', { name: 'You built both paths.' })).toBeInTheDocument()
    expect(screen.getByTestId('completed')).toHaveTextContent('if-else')
    fireEvent.click(screen.getByRole('button', { name: 'PLAY AGAIN' }))
    expect(screen.getByRole('heading', { name: 'Movie night' })).toBeInTheDocument()
    expect(screen.getByTestId('completed')).toHaveTextContent('if-else')
  }, 20_000)

  it('accepts decimal grades but rejects fractional ages, out-of-range values, and invalid numbers', () => {
    expect(parseProblemInput(ifElseProblems[5], '7.25')).toBe(7.25)
    expect(parseProblemInput(ifElseProblems[5], '10.25')).toBeNull()
    expect(parseProblemInput(ifElseProblems[6], '18.5')).toBeNull()
    expect(parseProblemInput(ifElseProblems[8], '-3')).toBe(-3)
    for (const value of ['', 'NaN', 'Infinity', '2abc', '1e3']) expect(parseProblemInput(ifElseProblems[9], value)).toBeNull()
  })
})
