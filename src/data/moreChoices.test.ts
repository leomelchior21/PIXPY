import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { chainMap, chainProgram, firstMismatch, moreChoiceLevels, outputsAt, runChain, unreachableMessages, type DecisionChain } from './moreChoices'

const level = (id: number) => moreChoiceLevels.find((item) => item.id === id)!

describe('more than one choice levels', () => {
  it('writes nested and separate programs that the offline Python also runs', () => {
    const water = level(3)
    expect(chainProgram(water.chain, 'temp').lines).toEqual([
      'temp = int(input())', 'if temp <= 0:', '    print("Ice")', 'else:', '    if temp < 100:', '        print("Water")', '    else:', '        print("Steam")',
    ])
    for (const item of moreChoiceLevels) {
      const chain = item.target ?? item.chain
      for (const value of [item.min, item.start, item.max]) {
        const traced = runChain(chain, item.variable, value).outputs.join('\n')
        expect(runGuidedPython(chainProgram(chain, item.variable).lines.join('\n'), [String(value)]).stdout).toBe(traced)
      }
    }
  })

  it('hides an overlap in level 1 and a gap in level 2', () => {
    expect(chainMap(level(1).chain, level(1)).some((segment) => segment.outputs.length === 2)).toBe(true)
    expect(outputsAt(chainMap(level(2).chain, level(2)), 20)).toEqual([])
    expect(outputsAt(chainMap(level(7).before!, level(7)), 5)).toEqual(['Coat', 'Sweater'])
  })

  it('gives every value exactly one message once the chain is nested', () => {
    for (const item of moreChoiceLevels) {
      const chain = item.target ?? item.chain
      if (chain.shape !== 'nested') continue
      expect(chainMap(chain, item).every((segment) => segment.outputs.length === 1), item.title).toBe(true)
    }
  })

  it('makes gold unreachable until the questions are swapped', () => {
    const medal = level(5)
    expect(unreachableMessages(medal.chain, chainMap(medal.chain, medal))).toEqual(['Gold'])
    const swapped: DecisionChain = { ...medal.chain, rules: [...medal.chain.rules].reverse() }
    expect(firstMismatch(chainMap(swapped, medal), chainMap(medal.target!, medal), medal)).toBeNull()
  })

  it('lets each builder reach the mission with its tiles, and catches a boundary slip', () => {
    for (const item of moreChoiceLevels.filter((entry) => entry.tiles)) {
      const target = item.target!
      expect(item.tiles).toEqual(expect.arrayContaining(target.rules.map((rule) => rule.condition)))
    }
    const tickets = level(6)
    const slip: DecisionChain = { shape: 'nested', rules: [{ condition: 'age < 12', message: 'Child ticket' }, { condition: 'age > 12', message: 'Adult ticket' }], elseMessage: 'Senior ticket' }
    expect(firstMismatch(chainMap(slip, tickets), chainMap(tickets.target!, tickets), tickets)).toEqual({ from: 12, to: 12, actual: ['Senior ticket'], expected: ['Adult ticket'] })
    const reversed: DecisionChain = { shape: 'nested', rules: [{ condition: 'age >= 65', message: 'Senior ticket' }, { condition: 'age >= 12', message: 'Adult ticket' }], elseMessage: 'Child ticket' }
    expect(firstMismatch(chainMap(reversed, tickets), chainMap(tickets.target!, tickets), tickets)).toBeNull()
  })

  it('uses predict rounds whose values all land in the same bin per round', () => {
    const medal = level(4)
    for (const round of medal.rounds!) {
      const bins = new Set(round.map((value) => runChain(medal.chain, medal.variable, value).outputs[0]))
      expect(bins.size).toBe(1)
    }
  })
})
