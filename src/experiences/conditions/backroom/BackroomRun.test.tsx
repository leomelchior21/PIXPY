import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { BackroomRun } from './BackroomRun'
import type { BackroomView } from './backroomRenderer'
import { backroomLevels } from './backroomLevels'
import { corridorCenterAt } from './backroomEngine'
import { createBackroomProgress, type BackroomProgress } from './types'


const renderer = vi.hoisted(() => ({ view: null as BackroomView | null }))
vi.mock('./backroomRenderer', () => ({ createBackroomRenderer: () => ({ render: (view: BackroomView) => { renderer.view = view }, resize: () => undefined, dispose: () => undefined }) }))

describe('Backrooms Run', () => {
  let frame: FrameRequestCallback
  let time: number

  beforeEach(() => {
    renderer.view = null
    localStorage.clear()
    time = 0
    // The page clock follows the simulated frames, so held keys count as holds, not taps.
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((name, options) => {
      const element = create(name, options)
      if (name === 'canvas') Object.defineProperty(element, 'getContext', { value: () => ({}) })
      return element
    })
  })

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); pilot = { on: false, jump: false, dodgeBatteries: false }; held = 0 })

  // Walls end the run, so long simulations steer with the corridor like a careful student:
  // aim a little ahead, optionally jump barriers and holes, optionally walk past batteries.
  let pilot = { on: false, jump: false, dodgeBatteries: false }
  let held: -1 | 0 | 1 = 0
  let heldSince = 0
  const keyFor = (side: -1 | 1) => (side < 0 ? 'ArrowLeft' : 'ArrowRight')
  function steer() {
    const view = renderer.view
    // First-time hazard guides wait for a key; the pilot reads them and goes on.
    const guide = pilot.on ? document.querySelector<HTMLButtonElement>('.br-coach .br-secondary') : null
    if (guide) fireEvent.click(guide)
    if (!pilot.on || !view || !document.querySelector('.br-screen--running')) {
      if (held) { fireEvent.keyUp(document.body, { key: keyFor(held) }); held = 0 }
      return
    }
    let aim = corridorCenterAt(view.gateCenter, view.bends, view.depth + 0.9)
    const battery = view.pickups?.find((item) => item.z - view.depth > -0.3 && item.z - view.depth < 3)
    // Drills fill one lane: move to another lane.
    const drill = view.obstacles.find((item) => item.kind === 'drill' && item.z - view.depth > -0.3 && item.z - view.depth < 6)
    if (drill) {
      const middle = corridorCenterAt(view.gateCenter, view.bends, drill.z)
      // A middle drill is passed on the side away from any chair or bin nearby.
      const prop = view.obstacles.find((item) => (item.kind === 'chair' || item.kind === 'trash') && Math.abs(item.z - drill.z) < 5)
      aim = Math.abs(drill.x - middle) < 0.05 ? middle + (prop ? -prop.side : view.playerX >= middle ? 1 : -1) * 0.42 : middle - Math.sign(drill.x - middle) * 0.2
    }
    // Saws cover the half of the corridor they come out of: move across early.
    const saw = view.obstacles.find((item) => item.kind === 'saw' && item.z - view.depth > -0.3 && item.z - view.depth < 5)
    if (saw && !drill) aim = saw.x - saw.side * 0.38
    // Batteries lie away from the chair, so the pilot passes them on the wall side.
    if (pilot.dodgeBatteries && battery) aim = battery.x + (battery.x >= aim ? 0.36 : -0.36)
    const gap = aim - view.playerX
    const want: -1 | 0 | 1 = Math.abs(gap) < 0.04 ? 0 : gap > 0 ? 1 : -1
    // Keys stay down at least 200 ms: a quicker release is a tap, which nudges sideways.
    if (want !== held && (held === 0 || time - heldSince >= 200)) {
      if (held) fireEvent.keyUp(document.body, { key: keyFor(held) })
      if (want) fireEvent.keyDown(document.body, { key: keyFor(want) })
      held = want
      heldSince = time
    }
    const hazard = view.obstacles.find((item) => (item.kind === 'barrier' || item.kind === 'hole') && item.z - view.depth > 0 && item.z - view.depth < 0.75)
    if (pilot.jump && hazard && view.jump === 0) fireEvent.keyDown(document.body, { key: ' ' })
  }

  function tick() {
    time += 50
    act(() => frame(time))
    return renderer.view!
  }

  // Runs frames in small batches per React update: the simulations need thousands of frames.
  function until(check: () => boolean, limit = 4000) {
    for (let count = 0; count < limit && !check(); count += 2) {
      act(() => { for (let step = 0; step < 2; step += 1) { time += 50; frame(time); steer() } })
    }
    expect(check()).toBe(true)
  }

  // Every run starts behind the door into Level 0.
  const running = () => !!document.querySelector('.br-screen--running')

  function mount(progress: BackroomProgress) {
    const saves: BackroomProgress[] = []
    let current = progress
    const view = render(<BackroomRun progress={current} onProgress={(next) => { saves.push(next); current = next }} onBack={() => undefined} />)
    tick()
    return { saves, rerender: () => view.rerender(<BackroomRun progress={current} onProgress={(next) => { saves.push(next); current = next }} onBack={() => undefined} />) }
  }

  const student = (changes: Partial<BackroomProgress> = {}) => ({ ...createBackroomProgress('Ana', 'ana'), ...changes })

  // Every run starts with the tape change; tests skip it.
  function skipTape() {
    fireEvent.click(within(screen.getByRole('dialog', { name: /Loading tape/ })).getByRole('button', { name: /SKIP/ }))
  }

  // Plays a tape from the shelf (the CONTINUE button above it can carry the same title).
  function playTape(title: string) {
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(title) }).find((button) => button.classList.contains('br-tape'))!)
    skipTape()
    const briefing = screen.getByRole('dialog', { name: 'Briefing' })
    fireEvent.click(within(briefing).getAllByRole('button')[0])
    until(running, 200)
  }

  function setEnergy(target: number) {
    const view = renderer.view!
    const current = Number(document.querySelector('.br-slot')?.textContent)
    const key = target > current ? 'ArrowUp' : 'ArrowDown'
    act(() => { for (let count = 0; count < Math.abs(target - current); count += 1) fireEvent.keyDown(document.body, { key }) })
    return view
  }

  it('opens on the tape library and offers the tutorial to a new student', () => {
    mount(student())
    expect(screen.getByRole('button', { name: /START TUTORIAL/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /THE EDGE/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /THE DEEP/ })).toBeDisabled()
  })

  it('asks a guest for a name before any tape plays', () => {
    mount(createBackroomProgress('Guest', 'guest'))
    expect(screen.queryByRole('button', { name: /START TUTORIAL/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^01/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/WHO IS PLAYING/), { target: { value: 'Maya Lima' } })
    fireEvent.click(screen.getByRole('button', { name: /^PLAY$/ }))
    expect(screen.getByRole('button', { name: /START TUTORIAL/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /MAYA LIMA · CHANGE/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^01/ })).toBeEnabled()
  })

  it('pauses the first gate with a guide and resumes once the condition is TRUE', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    mount(student())
    fireEvent.click(screen.getByRole('button', { name: /START TUTORIAL/ }))
    skipTape()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Briefing' })).getByRole('button', { name: /START TUTORIAL/ }))
    until(() => !!screen.queryByRole('dialog', { name: 'MAKE IT TRUE' }))
    const frozen = tick().depth
    expect(tick().depth).toBe(frozen)
    expect(screen.getByText(/energy is 20, so the condition is FALSE/)).toBeInTheDocument()
    setEnergy(51)
    expect(screen.getByRole('dialog', { name: 'TRUE. THE GATE OPENS.' })).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1200) })
    expect(screen.queryByRole('dialog', { name: /THE GATE OPENS/ })).not.toBeInTheDocument()
    until(() => renderer.view!.phase === 'turn')
    expect(screen.queryByRole('dialog', { name: /SHUT/ })).not.toBeInTheDocument()
  })

  it('skips the tutorial once tape 01 is cleared and explains a closed gate', () => {
    mount(student({ levelStars: [2, 0, 0, 0] }))
    playTape('LIGHTS ON')
    until(() => !!screen.queryByRole('dialog', { name: 'THE GATE STAYED SHUT' }))
    expect(screen.queryByRole('dialog', { name: 'MAKE IT TRUE' })).not.toBeInTheDocument()
    const card = screen.getByRole('dialog', { name: 'THE GATE STAYED SHUT' })
    expect(card).toHaveTextContent('20 > 50')
    expect(card).toHaveTextContent('2 LEFT')
    expect(screen.getByLabelText('2 of 3 batteries', { selector: '.br-osd .br-battery' })).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ }))
    until(() => renderer.view!.phase === 'turn')
  })

  it('costs a battery for the wrong door and shows the evaluation', () => {
    mount(student({ levelStars: [1, 1, 1, 1] }))
    playTape('TWO DOORS')
    until(() => renderer.view!.gateZ - renderer.view!.depth < 9)
    const wrong = renderer.view!.trueSide === -1 ? 'ArrowRight' : 'ArrowLeft'
    fireEvent.keyDown(document.body, { key: wrong })
    for (let count = 0; count < 12; count += 1) tick()
    fireEvent.keyUp(document.body, { key: wrong })
    until(() => !!screen.queryByRole('dialog', { name: 'WRONG DOOR' }))
    const card = screen.getByRole('dialog', { name: 'WRONG DOOR' })
    expect(card).toHaveTextContent('70 > 50')
    expect(card).toHaveTextContent('You took the FALSE door, but the condition is TRUE.')
  })

  it('opens the door into Level 0 before the run starts', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    fireEvent.click(screen.getByRole('button', { name: /LIGHTS ON/ }))
    skipTape()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Briefing' })).getAllByRole('button')[0])
    expect(document.querySelector('.br-screen--entering')).not.toBeNull()
    expect(tick().entry).toBeLessThan(0.5)
    until(running, 200)
    expect(renderer.view!.entry).toBe(1)
  })

  it('ends the run the moment the runner touches a wall', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    setEnergy(60)
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    until(() => !!screen.queryByRole('dialog', { name: 'Signal lost' }), 400)
    const card = screen.getByRole('dialog', { name: 'Signal lost' })
    expect(card).toHaveTextContent('YOU TOUCHED THE WALL')
    expect(screen.getByRole('button', { name: /RETRY TAPE/ })).toBeInTheDocument()
  })

  it('switches the camera off at zero batteries, and a spare battery turns it back on', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    pilot = { on: true, jump: true, dodgeBatteries: true }
    for (let mistake = 0; mistake < 3; mistake += 1) {
      until(() => !!screen.queryByRole('dialog', { name: 'THE GATE STAYED SHUT' }))
      if (mistake < 2) fireEvent.click(screen.getByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ }))
    }
    const card = screen.getByRole('dialog', { name: 'THE GATE STAYED SHUT' })
    expect(card).toHaveTextContent('CAMERA OFF')
    fireEvent.click(within(card).getByRole('button', { name: /CONTINUE IN THE DARK/ }))
    expect(screen.getByText('NO BATTERY')).toBeInTheDocument()
    expect(document.querySelector('.br-screen.is-camera-off')).not.toBeNull()
    // A spare battery always waits in the next corridor; this time the runner picks it up.
    pilot = { on: true, jump: true, dodgeBatteries: false }
    until(() => !document.querySelector('.br-screen.is-camera-off'))
    expect(screen.getByText(/CAMERA ON/)).toBeInTheDocument()
    expect(screen.getByLabelText('1 of 3 batteries', { selector: '.br-osd .br-battery' })).toBeInTheDocument()
  }, 60000)

  it('ends the run when a gate is missed with the camera already off', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    pilot = { on: true, jump: true, dodgeBatteries: true }
    for (let mistake = 0; mistake < 4; mistake += 1) {
      until(() => !!screen.queryByRole('dialog', { name: 'THE GATE STAYED SHUT' }))
      if (mistake < 3) fireEvent.click(screen.getByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ }))
    }
    expect(screen.getByRole('dialog', { name: 'THE GATE STAYED SHUT' })).toHaveTextContent('NO BATTERY LEFT')
    fireEvent.click(screen.getByRole('button', { name: /SEE RESULTS/ }))
    expect(screen.getByRole('dialog', { name: 'Signal lost' })).toHaveTextContent('GATE MISSED IN THE DARK')
  }, 60000)

  it('clears a tape with three stars, saves it and offers the next one', () => {
    const { saves, rerender } = mount(student({ backroomRunBest: 5 }))
    fireEvent.click(screen.getByRole('button', { name: /START TUTORIAL/ }))
    skipTape()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Briefing' })).getAllByRole('button')[0])
    until(running, 200)
    pilot = { on: true, jump: true, dodgeBatteries: false }
    const targets = [60, 20, 80, 10]
    backroomLevels[0].gates.forEach((_, index) => {
      until(() => renderer.view!.phase === 'gate' && renderer.view!.gateNumber === index + 1)
      setEnergy(targets[index])
      until(() => renderer.view!.phase === 'turn' || !!screen.queryByRole('dialog', { name: 'Tape cleared' }))
    })
    until(() => !!screen.queryByRole('dialog', { name: 'Tape cleared' }))
    expect(screen.queryByRole('dialog', { name: 'MAKE IT TRUE' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('3 of 3 stars', { selector: '.br-card .br-stars' })).toBeInTheDocument()
    const saved = saves[saves.length - 1]
    expect(saved.levelStars[0]).toBe(3)
    expect(saved.backroomRunGates).toBe(4)
    expect(saved.skills['>']).toEqual({ right: 2, wrong: 0 })
    // Back on the shelf, the tape this clear opened waits with a NEW sticker; the rest stay locked.
    rerender()
    fireEvent.click(screen.getByRole('button', { name: /BACK TO THE SHELF/ }))
    const edge = screen.getByRole('button', { name: /^NEW ?02/ })
    expect(edge).toBeEnabled()
    expect(edge).toHaveTextContent('NEW')
    expect(screen.getByRole('button', { name: /^03/ })).toBeDisabled()
  }, 60000)

  it('opens The Deep after all four tapes and for teachers', () => {
    mount(student({ levelStars: [1, 2, 3, 1] }))
    expect(screen.getByRole('button', { name: /ENTER THE DEEP/ })).toBeInTheDocument()
    cleanup()
    mount({ ...createBackroomProgress('Teacher', 'teacher', true) })
    expect(screen.getByRole('button', { name: /THE DEEP/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /FINAL CUT/ })).toBeEnabled()
  })

  it('pauses with Escape and resumes without losing the run', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    tick()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument()
    const depth = tick().depth
    expect(tick().depth).toBe(depth)
    fireEvent.click(screen.getByRole('button', { name: /KEEP RUNNING/ }))
    expect(tick().depth).toBeGreaterThan(depth)
  })

  it('speeds up after every gate inside a tape', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    pilot = { on: true, jump: true, dodgeBatteries: false }
    const first = tick().pace
    expect(screen.getByLabelText(/^Pace /)).toHaveTextContent('PACE 1.0×')
    until(() => {
      const next = screen.queryByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ })
      if (next) fireEvent.click(next)
      return renderer.view!.gateNumber === 2 && renderer.view!.phase === 'gate'
    })
    expect(renderer.view!.pace).toBeGreaterThan(first)
    expect(screen.getByLabelText(/^Pace /)).toHaveTextContent('PACE 1.1×')
  }, 60000)

  it('restarts a lost tutorial tape straight away without repeating its guides', { timeout: 60000 }, () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const { saves } = mount(student())
    fireEvent.click(screen.getByRole('button', { name: /START TUTORIAL/ }))
    skipTape()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Briefing' })).getByRole('button', { name: /START TUTORIAL/ }))
    until(() => !!screen.queryByRole('dialog', { name: 'MAKE IT TRUE' }))
    setEnergy(51)
    act(() => { vi.advanceTimersByTime(1200) })
    until(() => !!screen.queryByRole('dialog', { name: 'FOLLOW THE CORRIDOR' }))
    expect(screen.getByRole('dialog', { name: 'FOLLOW THE CORRIDOR' })).toHaveTextContent('Touch a wall and the run is over.')
    fireEvent.click(screen.getByRole('button', { name: 'GOT IT' }))
    // Nobody steers: the first bend ends the tape.
    until(() => !!screen.queryByRole('dialog', { name: 'Signal lost' }))
    expect(saves[saves.length - 1].coachSeen).toEqual(['energy', 'steer'])
    fireEvent.click(screen.getByRole('button', { name: /RETRY TAPE/ }))
    // A retry rewinds the same tape and goes straight back in.
    expect(screen.getByRole('dialog', { name: 'Loading tape 01' })).toHaveTextContent('◀◀ REW')
    skipTape()
    expect(screen.queryByRole('dialog', { name: 'Briefing' })).not.toBeInTheDocument()
    until(() => !!screen.queryByRole('dialog', { name: 'THE GATE STAYED SHUT' }))
    expect(screen.queryByRole('dialog', { name: 'MAKE IT TRUE' })).not.toBeInTheDocument()
  })

  it('jumps a barrier with Space instead of crashing into it', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('TWO DOORS')
    pilot = { on: true, jump: false, dodgeBatteries: false }
    const barrierAhead = () => renderer.view!.obstacles.some((item) => item.kind === 'barrier' && item.z - renderer.view!.depth > 0.3 && item.z - renderer.view!.depth < 1.2)
    until(() => {
      const next = screen.queryByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ })
      if (next) fireEvent.click(next)
      return barrierAhead()
    }, 8000)
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(tick().jump).toBeGreaterThan(0)
    for (let count = 0; count < 20; count += 1) tick()
    expect(screen.queryByRole('dialog', { name: 'Signal lost' })).not.toBeInTheDocument()
    expect(renderer.view!.obstacles.some((item) => item.kind === 'barrier')).toBe(true)
    expect(renderer.view!.jump).toBe(0)
  }, 60000)

  it('falls into a hole that is not jumped, and clears it with a jump', () => {
    // Holes arrive on tape 03, with their own first-time guide. Bends are random; fix them so the run is the same every time.
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
    mount(student({ levelStars: [1, 1, 0, 0] }))
    fireEvent.click(screen.getByRole('button', { name: /^03/ }))
    skipTape()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Briefing' })).getAllByRole('button')[0])
    until(running, 200)
    pilot = { on: true, jump: true, dodgeBatteries: false }
    const holeAhead = () => renderer.view!.obstacles.some((item) => item.kind === 'hole' && item.z - renderer.view!.depth > 2)
    until(() => {
      const next = screen.queryByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ })
      if (next) fireEvent.click(next)
      return holeAhead()
    }, 12000)
    const hole = renderer.view!.obstacles.find((item) => item.kind === 'hole' && item.z - renderer.view!.depth > 2)!
    // The pilot jumps it (gates on the way are simply missed: CONTINUE).
    until(() => {
      const next = screen.queryByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ })
      if (next) fireEvent.click(next)
      return renderer.view!.depth > hole.z + 0.5 || !!screen.queryByRole('dialog', { name: 'Signal lost' })
    })
    expect(screen.queryByRole('dialog', { name: 'Signal lost' })).not.toBeInTheDocument()
    // Without jumping, the next hole or barrier ends the run (replaying the tape if it was the last one).
    pilot = { on: true, jump: false, dodgeBatteries: false }
    until(() => {
      const next = screen.queryByRole('button', { name: /^CONTINUE( IN THE DARK)?$/ })
      if (next) fireEvent.click(next)
      const replay = screen.queryByRole('button', { name: /REPLAY/ })
      if (replay) {
        fireEvent.click(replay)
        skipTape()
      }
      return !!screen.queryByRole('dialog', { name: 'Signal lost' })
    }, 12000)
    expect(screen.getByRole('dialog', { name: 'Signal lost' })).toHaveTextContent(/YOU FELL|YOU HIT THE BARRIER/)
  }, 90000)

  it('lets a lost tape continue from the gate it was heading for, keeping what it earned', () => {
    mount(student({ levelStars: [1, 0, 0, 0] }))
    playTape('LIGHTS ON')
    pilot = { on: true, jump: true, dodgeBatteries: false }
    setEnergy(60)
    until(() => renderer.view!.phase === 'turn')
    // Steering stops: the next bend ends the run between gates 1 and 2.
    pilot = { on: false, jump: false, dodgeBatteries: false }
    until(() => !!screen.queryByRole('dialog', { name: 'Signal lost' }))
    fireEvent.click(screen.getByRole('button', { name: /CONTINUE FROM GATE 02/ }))
    skipTape()
    until(running, 200)
    expect(renderer.view!.gateNumber).toBe(2)
    expect(screen.getByText('10', { selector: '.br-xp' })).toBeInTheDocument()
  }, 60000)

  it('pays an edge bonus for opening a gate right on the edge', () => {
    mount(student({ levelStars: [1, 1, 0, 0] }))
    playTape('THE EDGE')
    // >= 40 starting at 39: one step up is exactly the edge.
    setEnergy(40)
    until(() => !!screen.queryByText(/EDGE BONUS/))
    expect(screen.getByText(/ON THE EDGE/)).toBeInTheDocument()
  })
})
