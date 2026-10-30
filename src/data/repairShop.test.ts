import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { flattenProgram } from '../lib/decisionTracer'
import { behavesCorrectly, bugFixed, joinTokens, referenceSegments, repairTickets, runSegments, segmentLines, ticketSegments } from './repairShop'

describe('repair shop tickets', () => {
  it('have a repaired machine that passes every test without errors', () => {
    for (const ticket of repairTickets) {
      const reference = referenceSegments(ticket)
      for (const input of ticket.tests) {
        const run = runSegments(reference, input)
        expect(run.error, `ticket ${ticket.id} input ${input}`).toBeNull()
        expect(run.outputs).toHaveLength(1)
        // The classroom's offline Python agrees with the tracer.
        expect(runGuidedPython(flattenProgram(reference).join('\n'), [input]).stdout).toBe(run.outputs.join('\n'))
      }
    }
  })

  it('let the customer show each bug with the demo value', () => {
    for (const ticket of repairTickets) {
      ticket.bugs.forEach((bug, bugIndex) => {
        const installed = Object.fromEntries(ticket.bugs.slice(0, bugIndex).map((item, index) => [index, item.answer]))
        const segments = ticketSegments(ticket, installed)
        expect(behavesCorrectly(ticket, runSegments(segments, bug.demo), bug.demo), `ticket ${ticket.id} bug ${bugIndex}`).toBe(false)
      })
    }
  })

  it('can rebuild every answer from its tray, and the broken line is not the answer', () => {
    for (const ticket of repairTickets) {
      ticket.bugs.forEach((bug, bugIndex) => {
        expect(bug.answer.every((token) => bug.tokens.includes(token)), `ticket ${ticket.id} bug ${bugIndex}`).toBe(true)
        expect(joinTokens(bug.answer)).not.toBe(ticket.lines[bug.line].trim())
        expect(bugFixed(ticket, Object.fromEntries(ticket.bugs.map((item, index) => [index, item.answer])), bugIndex)).toBe(true)
      })
    }
  })

  it('glue tray pieces into real Python', () => {
    expect(joinTokens(['if', 'coins', '>=', '3', ':'])).toBe('if coins >= 3:')
    expect(joinTokens(['print(', '"Retry"', ')'])).toBe('print("Retry")')
    expect(joinTokens(['else', ':'])).toBe('else:')
  })

  it('reject a rebuild that only fixes the customer’s value', () => {
    const arcade = repairTickets[0]
    const only3 = { 0: ['if', 'coins', '==', '3', ':'] }
    expect(behavesCorrectly(arcade, runSegments(ticketSegments(arcade, only3), '3'), '3')).toBe(true)
    expect(bugFixed(arcade, only3, 0)).toBe(false)
  })

  it('crash on the broken line itself for every bug that stops Python', () => {
    for (const ticket of repairTickets) {
      const segments = ticketSegments(ticket, {})
      const bug = ticket.bugs[0]
      if (bug.kind === 'logic') continue
      const crash = runSegments(segments, bug.demo).error
      expect(crash, `ticket ${ticket.id}`).toBeTruthy()
      expect(segmentLines(segments, bug.line)).toContain(crash!.line)
    }
  })
})
