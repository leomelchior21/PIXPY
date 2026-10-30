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
const build = (...pieces: string[]) => pieces.forEach((piece) => click(`Add ${piece}`))
/** The customer's demo: arrive, type the value, run the machine, then hand over. */
const watch = () => { click(/NEXT/); click(/RUN IT/); click(/FIND THE BROKEN LINE/) }

// Each test plays whole tickets through the full page, which takes several seconds on slower machines.
describe('Make it work: the repair shop', { timeout: 30000 }, () => {
  it('invites the student to add a photo to the finished certificate and save it', () => {
    render(<Harness initial={seen([1, 2, 3, 4, 5, 6, 7, 8])} />)
    expect(screen.getByRole('heading', { name: 'Certified Bug Fixer' })).toBeInTheDocument()
    expect(screen.getByText('Maya')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add your photo!/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /SAVE CERTIFICATE/ })).toBeInTheDocument()
    // From any ticket, the certificate button at the end of the row brings it back.
    click(/Ticket 3: The phone dock/)
    expect(screen.getByRole('heading', { name: 'The phone dock' })).toBeInTheDocument()
    click('Your Certified Bug Fixer certificate')
    expect(screen.getByRole('heading', { name: 'Certified Bug Fixer' })).toBeInTheDocument()
  })

  it('opens the guide on the first visit, remembers it was read, and reopens it from the help button', () => {
    render(<Harness initial={createSession('Maya')} />)
    const guide = screen.getByRole('dialog', { name: 'Customers bring you broken machines' })
    for (const title of ['The customer shows you the problem', 'Tap the broken line', 'Rebuild the line, then test everything']) {
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

  it('walks one ticket through watch, locate, rebuild, and verify', () => {
    render(<Harness />)
    expect(screen.getByRole('heading', { name: 'The arcade cabinet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ticket 2: The safe door, locked/ })).toBeDisabled()

    // The customer shows the problem before the student touches anything.
    expect(screen.queryByRole('button', { name: /^Line 2:/ })).not.toBeInTheDocument()
    click(/NEXT/)
    expect(screen.getByText('Nina types 3.')).toBeInTheDocument()
    click(/RUN IT/)
    expect(screen.getByText('Nina: “See? It said Insert more coins!”')).toBeInTheDocument()
    expect(screen.getByText('Insert more coins', { selector: '.rs-console pre' })).toBeInTheDocument()
    click(/FIND THE BROKEN LINE/)

    line(1)
    expect(screen.getByText('Line 1 looks fine.')).toBeInTheDocument()
    line(2)
    expect(screen.getByText('Found it: line 2.')).toBeInTheDocument()

    // A tapped piece can be taken back out of the new line.
    build('if', '<')
    click('Remove <')
    // == fixes the customer's 3 coins but breaks 4 coins: the bench catches it.
    build('coins', '==', '3', ':')
    expect(screen.getByText('if coins == 3:', { selector: '.rs-builder__preview code' })).toBeInTheDocument()
    click('INSTALL + RUN')
    expect(screen.getByText('Test failed with 4.')).toBeInTheDocument()
    click('Clear the new line')
    build('if', 'coins', '>=', '3', ':'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()

    expect(latest.repairTickets).toEqual([1])
    expect(latest.repairLog).toEqual([expect.objectContaining({ ticket: 1, stampMisses: 0, locateMisses: 1, verifyFails: 1, fixMisses: 0 })])
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'NEXT TICKET' }))
    expect(screen.getByRole('heading', { name: 'The safe door' })).toBeInTheDocument()
  })

  it('shows Python’s real report for a misspelled name and keeps a wrong rebuild broken', () => {
    render(<Harness initial={seen([1, 2, 3])} />)
    expect(screen.getByRole('heading', { name: 'The ride gate' })).toBeInTheDocument()
    click(/NEXT/); click(/RUN IT/)
    expect(screen.getByText(/NameError: name 'heigth' is not defined/)).toBeInTheDocument()
    click(/FIND THE BROKEN LINE/)
    line(2)
    build('if', 'Height', '>=', '130', ':'); click('INSTALL + RUN')
    expect(screen.getByText('Still broken with 140.')).toBeInTheDocument()
    expect(latest.repairTickets).toEqual([1, 2, 3])
    click('Clear the new line')
    build('if', 'height', '>=', '130', ':'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()
  })

  it('has the customer show the second bug in the snack machine after the first is fixed', () => {
    render(<Harness initial={seen([1, 2, 3, 4, 5, 6, 7])} />)
    expect(screen.getByText('BUG 1 OF 2')).toBeInTheDocument()
    click(/NEXT/); click(/RUN IT/)
    expect(screen.getByText(/SyntaxError: expected ':'/)).toBeInTheDocument()
    click(/FIND THE BROKEN LINE/)
    line(4); build('else', ':'); click('INSTALL + RUN')
    expect(screen.getByText('One bug down!')).toBeInTheDocument()
    expect(screen.getByText('BUG 2 OF 2')).toBeInTheDocument()
    watch()
    line(2); build('if', 'money', '>=', '5', ':'); click('INSTALL + RUN')
    expect(screen.getByRole('dialog', { name: 'Machine fixed!' })).toBeInTheDocument()
    expect(latest.repairTickets).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(latest.completed).toContain('make-it-work')
  })
})
