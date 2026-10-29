import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { BossArena } from './BossArena'

vi.mock('../../lib/pythonRunner', async () => {
  const { runGuidedPython } = await import('../../lib/guidedPython')
  class PythonRunError extends Error { line: number | null = null }
  return {
    PythonRunError,
    pythonRunner: {
      getState: () => 'ready',
      subscribe: () => () => true,
      runScript: async (code: string, inputs: string[]) => runGuidedPython(code, inputs),
    },
  }
})

vi.mock('../../components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, label, readOnly }: { value: string; onChange: (value: string) => void; label: string; readOnly?: boolean }) =>
    <textarea aria-label={label} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />,
}))

let latest: SessionProgress
function Harness({ initial }: { initial?: SessionProgress }) {
  const [progress, setProgress] = useState<SessionProgress>(() => initial ?? createSession('Maya'))
  latest = progress
  return <BossArena progress={progress} onProgress={setProgress} onBack={() => {}} />
}

const attack = () => fireEvent.click(screen.getByRole('button', { name: /ATTACK · \d+ TESTS/ }))
const settle = { timeout: 10000 }
const write = (code: string) => fireEvent.change(screen.getByRole('textbox', { name: /Code to defeat/ }), { target: { value: code } })

describe('Conditions final bosses', { timeout: 40000 }, () => {
  it('fights with real tests, explains a boundary miss, and records each attack', async () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'The club door' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Boss 2: Fan Golem, locked/ })).toBeDisabled()
    expect(screen.getAllByText('surprise')).toHaveLength(3)

    write('age = int(input())\nif age > 18:\n    print("Welcome in")\nelse:\n    print("Too young")')
    attack()
    expect(await screen.findByText('Gate Slime survived with 1 HP.', {}, settle)).toBeInTheDocument()
    expect(screen.getByText('WHAT HAPPENED IN TEST 3')).toBeInTheDocument()
    expect(screen.getByText('18 > 18 → False')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Gate Slime health' })).toHaveAttribute('aria-valuenow', '1')

    write('age = int(input())\nif age >= 18:\n    print("Welcome in")\nelse:\n    print("Too young")')
    attack()
    expect(await screen.findByText('Gate Slime defeated!', {}, settle)).toBeInTheDocument()
    expect(screen.getByText('DEFEATED!')).toBeInTheDocument()
    expect(latest.conditionBosses).toEqual([1])
    expect(latest.conditionBossLog.map((event) => event.hits)).toEqual([4, 5])
    fireEvent.click(screen.getByRole('button', { name: /NEXT BOSS/ }))
    expect(screen.getByRole('heading', { name: 'The overheated lab' })).toBeInTheDocument()
  })

  it('reveals hints one at a time and saves them with the next attack', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Need a hint/ }))
    fireEvent.click(screen.getByRole('button', { name: /Another hint/ }))
    expect(screen.getByText('Indent the print under the if', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Is 18 itself allowed in?', { exact: false })).not.toBeInTheDocument()
    attack()
    expect(await screen.findByText(/survived with 5 HP/, {}, settle)).toBeInTheDocument()
    expect(latest.conditionBossLog.at(-1)).toMatchObject({ boss: 1, hits: 0, hints: 2 })
  })

  it('completes the activity after the final boss', async () => {
    render(<Harness initial={{ ...createSession('Maya'), conditionBosses: [1, 2, 3, 4, 5, 6, 7, 8, 9] }} />)
    expect(screen.getByRole('heading', { name: 'The final report card' })).toBeInTheDocument()
    write('grade = float(input())\nif grade >= 9:\n    print("Excellent")\nelse:\n    if grade >= 7:\n        print("Approved")\n    else:\n        if grade >= 5:\n            print("Recovery")\n        else:\n            print("Failed")')
    attack()
    expect(await screen.findByText('The Grade Judge defeated!', {}, settle)).toBeInTheDocument()
    expect(latest.completed).toContain('conditions-final-bosses')
    fireEvent.click(screen.getByRole('button', { name: /CLAIM THE CROWN/ }))
    expect(screen.getByRole('heading', { name: 'Conditions Champion' })).toBeInTheDocument()
  })
})
