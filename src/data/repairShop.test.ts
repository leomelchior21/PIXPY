import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { flattenProgram } from '../lib/decisionTracer'
import { behavesCorrectly, referenceSegments, repairTickets, runSegments, segmentLines, symptomKind, ticketSegments } from './repairShop'

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

  it('reproduce each bug with a suggested value and show the bug kind as its symptom', () => {
    for (const ticket of repairTickets) {
      ticket.bugs.forEach((bug, bugIndex) => {
        const installed = Object.fromEntries(ticket.bugs.slice(0, bugIndex).map((item, index) => [index, item.answer]))
        const segments = ticketSegments(ticket, installed)
        const failing = ticket.tryValues.filter((input) => !behavesCorrectly(ticket, runSegments(segments, input), input))
        expect(failing.length, `ticket ${ticket.id} bug ${bugIndex}`).toBeGreaterThan(0)
        expect(failing.every((input) => symptomKind(runSegments(segments, input)) === bug.kind)).toBe(true)
        if (ticket.suggested) expect(failing).toContain(ticket.suggested)
      })
    }
  })

  it('reject every wrong part on the reproduce value or the verify tests', () => {
    for (const ticket of repairTickets) {
      ticket.bugs.forEach((bug, bugIndex) => {
        const installed: Record<number, number> = Object.fromEntries(ticket.bugs.map((item, index) => [index, item.answer]))
        bug.parts.forEach((_, part) => {
          if (part === bug.answer) return
          const segments = ticketSegments(ticket, { ...installed, [bugIndex]: part })
          const allPass = ticket.tests.every((input) => behavesCorrectly(ticket, runSegments(segments, input), input))
          expect(allPass, `ticket ${ticket.id} part ${part}`).toBe(false)
        })
      })
    }
  })

  it('locate syntax and runtime bugs on the line Python reports, except the ride gate', () => {
    for (const ticket of repairTickets) {
      const segments = ticketSegments(ticket, {})
      const bug = ticket.bugs[0]
      const crash = ticket.tryValues.map((input) => runSegments(segments, input).error).find(Boolean)
      if (bug.kind === 'logic') continue
      expect(crash).toBeTruthy()
      const bugLines = segmentLines(segments, bug.line)
      expect(bugLines.includes(crash!.line), `ticket ${ticket.id}`).toBe(!bug.crashLine)
    }
  })
})
