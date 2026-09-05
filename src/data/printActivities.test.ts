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
      'launch-countdown',
      'crack-code',
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
    expect(printActivities[4].starterCode).toBe('# Use 5 print lines of # stacked to draw a heart.\nprint("#######")')
    expect(printActivities[5].starterCode).toBe('# Create your ID card with name, age, favourite food, and favourite game or music.\nprint("=============================")\nprint("PLAYER: YOUR NAME")\nprint("=============================")')
    expect(printActivities[7].starterCode).toBe('#Store 6 * 7 in access_code and adjust it to print correctly.\naccess_code = 6 + 7\n\nprint("ACCESS CODE")')
  })

  it.each([
    ['morning-chat', 'print("Bom dia, chat!")'],
    ['introduce-yourself', 'print("HELLO!")\nprint("My name is Maya")'],
    ['blank-line', 'print("TOP")\nprint()\nprint("BOTTOM")'],
    ['draw-frame', 'print("#####")\nprint("#   #")\nprint("#####")'],
    ['initials-banner', 'print("## ##")\nprint("#######")\nprint("#####")\nprint("###")\nprint("#")'],
    ['player-id-card', 'print("=============================")\nprint("PLAYER: Maya")\nprint("AGE: 12")\nprint("FAVOURITE FOOD: PIZZA")\nprint("FAVOURITE GAME: MINECRAFT")\nprint("=============================")'],
    ['launch-countdown', 'print(3)\nprint(2)\nprint(1)\nprint("LIFTOFF!")'],
    ['crack-code', 'access_code = 6 * 7\nprint(access_code)'],
  ])('accepts the successful %s example', (id, code) => {
    expect(validates(id, code)).toBe(true)
  })

  it.each([
    'print("bom dia, chat!")',
    'print("bom dia, chat")',
    'print("Bom dia, chat")',
    'print("bom dia chat")',
    'print("bom dia, chaat!")',
    'print("bon dia, chat!")',
  ])('accepts a close Bom dia, chat variant: %s', (code) => {
    expect(validates('morning-chat', code)).toBe(true)
  })

  it.each([
    ['morning-chat', 'print("Bom dia, chat!")\nprint("extra")'],
    ['introduce-yourself', 'print("HELLO!")\nprint("Someone else")'],
    ['blank-line', 'print("TOP")\nprint("not blank")\nprint("BOTTOM")'],
    ['draw-frame', 'print("#####")\nprint("#   #")\nprint("####")'],
    ['initials-banner', 'print("#####")\nprint("#####")\nprint("#####")\nprint("#####")\nprint("#####")'],
    ['player-id-card', 'print("=============================")\nprint("PLAYER: Leo")\nprint("AGE: 12")\nprint("FAVOURITE FOOD: PIZZA")\nprint("FAVOURITE MUSIC: JAZZ")\nprint("=============================")'],
    ['launch-countdown', 'print(3)\nprint(2)\nprint(1)\nprint("GO!")'],
    ['crack-code', 'access_code = 42\nprint("ACCESS CODE")'],
  ])('rejects the unsuccessful %s example', (id, code) => {
    expect(validates(id, code)).toBe(false)
  })

  it.each([
    'print("hello")',
    'print("boa noite, chat")',
    'print("bom dia")',
    'print("bom dia, chat")\nprint("extra")',
  ])('rejects text outside the morning greeting border: %s', (code) => {
    expect(validates('morning-chat', code)).toBe(false)
  })

  it.each([
    'print(3)\nprint(2)\nprint(1)\nprint("lift off")',
    'print(3)\nprint(2)\nprint(1)\nprint(" LIFT-OFF!!! ")',
    'print(3)\nprint(2)\nprint(1)\nprint("liftof")',
    'print(3)\nprint(2)\nprint(1)\nprint("lifttoff")',
  ])('accepts a flexible liftoff spelling: %s', (code) => {
    expect(validates('launch-countdown', code)).toBe(true)
  })

  it('matches the current player name on the ID card', () => {
    const activity = printActivities[5]
    const code = 'print("========")\nprint("PLAYER: Maya")\nprint("AGE: 12")\nprint("FAVOURITE FOOD: TACOS")\nprint("FAVOURITE MUSIC: JAZZ")\nprint("========")'
    const result = runGuidedPython(code)
    expect(activity.validate(result, code, 'Maya')).toBe(true)
    expect(activity.validate(result, code, 'Leo')).toBe(false)
    const almost = 'print("========")\nprint("PLAYER: Maya2")\nprint("AGE: 12")\nprint("FAVOURITE FOOD: TACOS")\nprint("FAVOURITE GAME: CHESS")\nprint("========")'
    expect(activity.validate(runGuidedPython(almost), almost, 'Maya')).toBe(false)
  })

  it('accepts either a favourite game or favourite music, but requires every ID field', () => {
    expect(validates('player-id-card', 'print("===")\nprint("PLAYER: Maya")\nprint("AGE: 9")\nprint("FAVORITE FOOD: PASTA")\nprint("FAVORITE MUSIC: POP")\nprint("===")')).toBe(true)
    expect(validates('player-id-card', 'print("===")\nprint("PLAYER: Maya")\nprint("AGE: 9")\nprint("FAVOURITE FOOD: PASTA")\nprint("===")')).toBe(false)
  })

  it('ignores line-ending differences and print text inside comments', () => {
    const morning = printActivities[0]
    expect(morning.validate({ stdout: 'Bom dia, chat!', variables: {} }, 'print("Bom dia, chat!")\n# print("extra")', playerName)).toBe(true)
    const countdown = printActivities[6]
    expect(countdown.validate({ stdout: '3\r\n2\r\n1\r\nLIFTOFF!', variables: {} }, 'print(3)\nprint(2)\nprint(1)\nprint("LIFTOFF!")\n# print("extra")', playerName)).toBe(true)
  })
})
