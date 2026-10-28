import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { createSession } from '../../session/progressSession'
import type { SessionProgress } from '../../types'
import { RepairShop } from './RepairShop'

let latest: SessionProgress
const seen = (fixed: number[] = []): SessionProgress => ({ ...createSession('Maya'), repairTickets: fixed, repairTutorialSeen: true })
function Harness({ initial }: { initial?: SessionProgress }) {
  const [progress, setProgress] = useState<SessionProgress>(() => initial ?? seen())
  latest = progress
  return <RepairShop progress={progress} onProgress={setProgress} onBack={() => {}} />
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const line = (number: number) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Line ${number}:`) }))
const part = (code: string) => fireEvent.click(screen.getByRole('radio', { name: code }))

// Each test plays whole tickets through the full page, which takes several seconds on slower machines.
describe('Make it work: the repair shop', { timeout: 30000 }, () => {
  it('opens the guide on the first visit, remembers it was read, and reopens it from the help button', () => {
    render(<Harness initial={createSession('Maya')} />)
    const guide = screen.getByRole('dialog', { name: 'Customers bring you broken machines' })
    for (const title of ['Make the bug happen', 'Name the kind of bug', 'Tap the broken line', 'Swap the part, then test everything']) {
      fireEvent.click(within(guide).getByRole('button', { name: /NEXT/ }))
      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
    }
    fireEvent.click(within(guide).getByRole('button', { name: /START REPAIRING/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(latest.repairTutorialSeen).toBe(true)
    click('How the repair shop works')
    expect(screen.getByRole('dialog', { name: 'Customers bring you broken machines' })).toBeInTheDocument()
  })

  it('keeps all eight tickets in one row and shows the machine without WebGL', () => {
    render(<Harness />)
    expect(within(screen.getByRole('navigation', { name: 'Repair tickets' })).getAllByRole('button')).toHaveLength(8)
    expect(screen.getByRole('img', { name: 'ARCADE-3000: ready' })).toHaveClass('rs-stage--flat')
  })

  it('walks one ticket through reproduce, diagnose, locate, fix, and verify', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'The arcade cabinet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ticket 2: The safe door, locked/ })).toBeDisabled()

    click('5'); click('RUN WITH 5')
    expect(screen.getByText('Works with 5.')).toBeInTheDocument()
    click('3'); click('RUN WITH 3')
    expect(screen.getByText('Bug reproduced!')).toBeInTheDocument()
    expect(screen.getByText('Insert more coins', { selector: '.rs-console pre' })).toBeInTheDocument()

    click(/SYNTAX ERROR/)
    expect(screen.getByText('Not a syntax error.')).toBeInTheDocument()
    click(/LOGIC ERROR/)
    expect(screen.getByText('Now tap the line you think is broken.', { exact: false })).toBeInTheDocument()

    line(1)
    expect(screen.getByText('Line 1 looks fine.')).toBeInTheDocument()
    line(2)
    expect(screen.getByText('Found it: line 2.')).toBeInTheDocument()

    // == fixes the customer's 3 coins but breaks 4 coins: the bench catches it.
    part('if coins == 3:'); click('INSTALL + RUN')
    expect(screen.getByText('Test failed with 4.')).toBeInTheDocument()
    part('if coins >= 3:'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()

    expect(latest.repairTickets).toEqual([1])
    expect(latest.repairLog).toEqual([expect.objectContaining({ ticket: 1, stampMisses: 1, locateMisses: 1, verifyFails: 1, fixMisses: 0 })])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'NEXT TICKET' }))
    expect(screen.getByRole('heading', { name: 'The safe door' })).toBeInTheDocument()
  })

  it('shows Python’s real report for a crash and explains a crash line that is not the bug', () => {
    render(<Harness initial={seen([1, 2, 3])} />)
    expect(screen.getByRole('heading', { name: 'The ride gate' })).toBeInTheDocument()
    click('RUN WITH 120')
    expect(screen.getByText(/TypeError: '>=' not supported between instances of 'str' and 'int'/)).toBeInTheDocument()
    click(/RUNTIME ERROR/)
    line(2)
    expect(screen.getByText(/Python crashed here, but this comparison is fine/)).toBeInTheDocument()
    line(1)
    part('height = int(input())'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()
  })

  it('reveals the second bug in the snack machine after the syntax error is fixed', () => {
    render(<Harness initial={seen([1, 2, 3, 4, 5, 6, 7])} />)
    expect(screen.getByText('BUG 1 OF 2')).toBeInTheDocument()
    click('5'); click('RUN WITH 5')
    expect(screen.getByText(/SyntaxError: expected ':'/)).toBeInTheDocument()
    click(/SYNTAX ERROR/); line(4); part('else:'); click('INSTALL + RUN')
    expect(screen.getByText('One bug down… and another appears!')).toBeInTheDocument()
    expect(screen.getByText('BUG 2 OF 2')).toBeInTheDocument()
    click(/LOGIC ERROR/); line(2); part('if money >= 5:'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()
    expect(latest.repairTickets).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(latest.completed).toContain('make-it-work')
  })
})
