import { fireEvent, render, screen, within } from '@testing-library/react'
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
  const [progress, setProgress] = useState<SessionProgress>(() => ({ ...(initial ?? createSession('Maya')), bossTutorialSeen: initial?.bossTutorialSeen ?? true }))
  latest = progress
  return <BossArena progress={progress} onProgress={setProgress} onBack={() => {}} />
}

const attack = () => fireEvent.click(screen.getByRole('button', { name: /ATTACK · \d+ TESTS/ }))
const settle = { timeout: 10000 }
const write = (code: string) => fireEvent.change(screen.getByRole('textbox', { name: /Code to defeat/ }), { target: { value: code } })

describe('Conditions final bosses', { timeout: 40000 }, () => {
  it('builds a fighter in the intro, then shows it in the arena', () => {
    render(<Harness initial={{ ...createSession('Maya'), bossTutorialSeen: false }} />)
    expect(screen.getByRole('dialog', { name: 'Create your fighter' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Cat' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Violet' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Fighter name' }), { target: { value: 'Zed' } })
    fireEvent.click(screen.getByRole('button', { name: /READY/ }))
    for (const title of ['Your fighter against ten bosses', 'Right answers hit, wrong answers hurt', 'Two tests shown, three surprises', 'Each round, you write more', 'Ten bosses wait in the arena']) {
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
      if (title !== 'Ten bosses wait in the arena') fireEvent.click(screen.getByRole('button', { name: /NEXT/ }))
    }
    fireEvent.click(screen.getByRole('button', { name: /ENTER THE ARENA/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(latest).toMatchObject({ bossTutorialSeen: true, bossFighter: { base: 'cat', color: 4, name: 'Zed' } })
    expect(screen.getByRole('img', { name: 'Zed, your fighter' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'How the arena works' }))
    expect(screen.getByRole('dialog', { name: 'Create your fighter' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Fighter name' })).toHaveValue('Zed')
  })

  it('starts round 1 with the if and else written, missing only the last print', () => {
    render(<Harness />)
    expect(screen.getByText('ROUND 1 · WRITE THE LAST PRINT')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Code to defeat/ })).toHaveValue('# Write the print for anyone younger, under else.\nage = int(input())\nif age >= 18:\n    print("Welcome in")\nelse:\n    ')
  })

  it('fights with real tests, explains a boundary miss, and records each attack', async () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'The club door' })).toBeInTheDocument()
    // Locked bosses stay hidden, name and all.
    expect(screen.getByRole('button', { name: 'Boss 2: locked' })).toBeDisabled()
    expect(screen.getAllByText('surprise')).toHaveLength(3)

    write('age = int(input())\nif age > 18:\n    print("Welcome in")\nelse:\n    print("Too young")')
    attack()
    expect(await screen.findByText('Gate Slime survived with 1 HP.', {}, settle)).toBeInTheDocument()
    expect(screen.getByText('WHAT HAPPENED IN TEST 3')).toBeInTheDocument()
    expect(screen.getByText('18 > 18 → False')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Gate Slime health' })).toHaveAttribute('aria-valuenow', '1')
    // The one failed test is one hit on the student's fighter.
    expect(screen.getByRole('meter', { name: 'Maya health' })).toHaveAttribute('aria-valuenow', '4')

    write('age = int(input())\nif age >= 18:\n    print("Welcome in")\nelse:\n    print("Too young")')
    attack()
    expect(await screen.findByText('Gate Slime defeated!', {}, settle)).toBeInTheDocument()
    expect(screen.getByText('DEFEATED!')).toBeInTheDocument()
    expect(latest.conditionBosses).toEqual([1])
    expect(latest.conditionBossLog.map((event) => event.hits)).toEqual([4, 5])
    // The first win awards a badge, which then sits in the badge case.
    expect(await screen.findByRole('dialog', { name: 'Gate Badge' }, settle)).toBeInTheDocument()
    // Adding it opens the case, where the new badge drops into its slot.
    fireEvent.click(screen.getByRole('button', { name: 'ADD TO BADGE CASE' }))
    const badgeCase = screen.getByRole('dialog', { name: 'Badge case' })
    expect(within(badgeCase).getByText('+1 BADGE')).toBeInTheDocument()
    expect(within(badgeCase).getByText('Gate Badge')).toBeInTheDocument()
    expect(within(badgeCase).getAllByText('???')).toHaveLength(9)
    fireEvent.click(within(badgeCase).getByRole('button', { name: 'Close the badge case' }))
    fireEvent.click(screen.getByRole('button', { name: 'Badge case: 1 of 10 badges' }))
    expect(screen.getByRole('dialog', { name: 'Badge case' })).not.toHaveTextContent('+1 BADGE')
    fireEvent.click(screen.getByRole('button', { name: 'Close the badge case' }))
    fireEvent.click(screen.getByRole('button', { name: /NEXT BOSS/ }))
    expect(screen.getByRole('heading', { name: 'The overheated lab' })).toBeInTheDocument()
  })

  it('reveals hints one at a time and saves them with the next attack', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Need a hint/ }))
    fireEvent.click(screen.getByRole('button', { name: /Another hint/ }))
    expect(screen.getByText('Indent the print under else', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText('Text needs quotes', { exact: false })).not.toBeInTheDocument()
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
