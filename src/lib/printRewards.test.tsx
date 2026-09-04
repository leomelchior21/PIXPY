import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PrintRewardDisplay } from '../components/printRewards/PrintRewardDisplay'
import { detectPrintReward, type PrintReward } from './printRewards'

describe('Print Playground reward detection', () => {
  afterEach(cleanup)

  it.each<[string, Parameters<typeof detectPrintReward>, PrintReward['type']]>([
    ['morning greeting', ['morning-chat', 'Bom dia, chat!', true], 'morning-greeting'],
    ['personal message', ['introduce-yourself', 'HELLO!\nMy name is Maya', true], 'personal-message'],
    ['empty line', ['blank-line', 'TOP\r\n\r\nBOTTOM', true], 'empty-line'],
    ['text frame', ['draw-frame', '#####\n#   #\n#####', true], 'text-frame'],
  ])('detects the %s animation after a successful run', (_, input, expected) => {
    expect(detectPrintReward(...input)?.type).toBe(expected)
  })

  it.each<Parameters<typeof detectPrintReward>>([
    ['morning-chat', 'Hello!', true],
    ['introduce-yourself', 'HELLO!', true],
    ['blank-line', 'TOP\nBOTTOM', true],
    ['draw-frame', '#####\n#   #\n####', true],
  ])('does not activate for incorrect output from %s', (...input) => {
    expect(detectPrintReward(...input)).toBeNull()
  })

  it('does not activate from matching output unless RUN marked it successful', () => {
    expect(detectPrintReward('morning-chat', 'Bom dia, chat!', false)).toBeNull()
  })

  it.each<[PrintReward, string]>([
    [{ type: 'morning-greeting', message: 'Bom dia, chat!' }, 'Morning greeting display'],
    [{ type: 'personal-message', greeting: 'HELLO!', message: 'My name is Maya' }, 'Personal message delivery'],
    [{ type: 'empty-line', top: 'TOP', bottom: 'BOTTOM' }, 'Clear airspace between output lines'],
    [{ type: 'text-frame', output: '###\n# #\n###', lines: ['###', '# #', '###'] }, 'Assembled text frame'],
  ])('renders each reward as its own accessible component', (reward, label) => {
    render(<PrintRewardDisplay reward={reward} />)
    expect(screen.getByLabelText(label)).toBeInTheDocument()
  })

  it('uses the student output in the personal message instead of hardcoding it', () => {
    render(<PrintRewardDisplay reward={{ type: 'personal-message', greeting: 'GOOD MORNING', message: 'Maya reporting in!' }} />)
    expect(screen.getByText('GOOD MORNING')).toBeInTheDocument()
    expect(screen.getByText('Maya reporting in!')).toBeInTheDocument()
    expect(screen.getByText('MESSAGE ON BOARD')).toBeInTheDocument()
  })
})
