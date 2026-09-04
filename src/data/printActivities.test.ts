import { describe, expect, it } from 'vitest'
import { runGuidedPython } from '../lib/guidedPython'
import { printActivities } from './printActivities'

const playerName = 'Maya'

function validates(id: string, code: string): boolean {
  const activity = printActivities.find((item) => item.id === id)
  if (!activity) throw new Error(`Missing test activity: ${id}`)
  return activity.validate(runGuidedPython(code), code, playerName)
}

describe('Print Playground activities', () => {
  it('keeps all five core activities before the three optional extras', () => {
    expect(printActivities.map(({ id }) => id)).toEqual([
      'morning-chat',
      'introduce-yourself',
      'blank-line',
      'draw-frame',
      'initials-banner',
      'player-id-card',
      'crack-code',
      'launch-countdown',
    ])
    expect(printActivities.map(({ extra }) => extra)).toEqual([false, false, false, false, false, true, true, true])
  })

  it('keeps every starter valid Python and incomplete', () => {
    for (const activity of printActivities) {
      const result = runGuidedPython(activity.starterCode)
      expect(activity.validate(result, activity.starterCode, playerName), activity.title).toBe(false)
    }
  })

  it('starts every activity with an instruction comment and keeps level one at Hello', () => {
    for (const activity of printActivities) expect(activity.starterCode).toMatch(/^#.+\n/)
    expect(printActivities[0].starterCode).toBe('#Change the message to "Bom dia, chat!"\nprint("Hello!")')
  })

  it.each([
    ['morning-chat', 'print("Bom dia, chat!")'],
    ['introduce-yourself', 'print("HELLO!")\nprint("My name is Maya")'],
    ['blank-line', 'print("TOP")\nprint()\nprint("BOTTOM")'],
    ['draw-frame', 'print("#####")\nprint("#   #")\nprint("#####")'],
    ['initials-banner', 'print("M")\nprint("A")\nprint("Y")\nprint("A")\nprint("2026")'],
    ['player-id-card', 'print("########")\nprint("PLAYER: Maya")\nprint("PIXPY")\nprint("########")'],
    ['crack-code', 'access_code = 6 * 7\nprint("ACCESS CODE")\nprint(access_code)'],
    ['launch-countdown', 'print(3)\nprint(2)\nprint(1)\nprint("LIFTOFF!")'],
  ])('accepts the successful %s example', (id, code) => {
    expect(validates(id, code)).toBe(true)
  })

  it.each([
    ['morning-chat', 'print("Bom dia, chat!")\nprint("extra")'],
    ['introduce-yourself', 'print("HELLO!")\nprint("Someone else")'],
    ['blank-line', 'print("TOP")\nprint("not blank")\nprint("BOTTOM")'],
    ['draw-frame', 'print("#####")\nprint("#   #")\nprint("####")'],
    ['initials-banner', 'print("A")\nprint("B")\nprint("")\nprint("D")\nprint("E")'],
    ['player-id-card', 'print("########")\nprint("PLAYER: Leo")\nprint("PIXPY")\nprint("########")'],
    ['crack-code', 'access_code = 42\nprint("ACCESS CODE")\nprint(access_code)'],
    ['launch-countdown', 'print(3)\nprint(2)\nprint(1)\nprint("GO!")'],
  ])('rejects the unsuccessful %s example', (id, code) => {
    expect(validates(id, code)).toBe(false)
  })

  it('matches the current player name on the ID card', () => {
    const activity = printActivities[5]
    const code = 'print("========")\nprint("PLAYER: Maya")\nprint("PIXPY")\nprint("========")'
    const result = runGuidedPython(code)
    expect(activity.validate(result, code, 'Maya')).toBe(true)
    expect(activity.validate(result, code, 'Leo')).toBe(false)
    const almost = 'print("========")\nprint("PLAYER: Maya2")\nprint("PIXPY")\nprint("========")'
    expect(activity.validate(runGuidedPython(almost), almost, 'Maya')).toBe(false)
  })

  it('ignores line-ending differences and print text inside comments', () => {
    const morning = printActivities[0]
    expect(morning.validate({ stdout: 'Bom dia, chat!', variables: {} }, 'print("Bom dia, chat!")\n# print("extra")', playerName)).toBe(true)
    const countdown = printActivities[7]
    expect(countdown.validate({ stdout: '3\r\n2\r\n1\r\nLIFTOFF!', variables: {} }, 'print(3)\nprint(2)\nprint(1)\nprint("LIFTOFF!")\n# print("extra")', playerName)).toBe(true)
  })
})
