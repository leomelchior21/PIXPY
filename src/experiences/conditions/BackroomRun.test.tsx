import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BackroomRun } from './BackroomRun'
import type { BackroomView } from './backroomRenderer'
import { speedForGate } from '../../lib/backroomEngine'
import * as engine from '../../lib/backroomEngine'
import { createSession } from '../../session/progressSession'

const renderer = vi.hoisted(() => ({ view: null as BackroomView | null }))
vi.mock('./backroomRenderer', () => ({ drawBackroom: (_context: unknown, _width: number, _height: number, view: BackroomView) => { renderer.view = view } }))
vi.mock('../../lib/classroomCloud', () => ({ loadBackroomScores: async () => [] }))

describe('Backroom running pace', () => {
  let frame: FrameRequestCallback
  let time: number

  beforeEach(() => {
    renderer.view = null
    time = 0
    vi.spyOn(performance, 'now').mockReturnValue(0)
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

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  function tick() {
    time += 50
    act(() => frame(time))
    return renderer.view!
  }

  function start() {
    render(<BackroomRun progress={createSession('Review', 'review', true)} onProgress={() => undefined} onBack={() => undefined} />)
    const play = screen.queryByRole('button', { name: 'PLAY GAME' })
    if (play) fireEvent.click(play)
    return tick()
  }

  function approach(distance: number) {
    let view = renderer.view!
    for (let count = 0; view.gateZ - view.depth > distance && count < 500; count += 1) view = tick()
    return view
  }

  function raiseEnergy() {
    const increase = screen.getByRole('button', { name: 'Increase energy' })
    act(() => { for (let count = 0; count < 31; count += 1) fireEvent.click(increase) })
  }

  it('keeps the corridor pace all the way to a closed gate', () => {
    start()
    const before = approach(3.4)
    const after = tick()
    expect(after.conditionTrue).toBe(false)
    expect(after.depth - before.depth).toBeCloseTo(speedForGate(1) * 1.6 * .05, 8)
    approach(0)
    expect(screen.getByRole('heading', { name: 'THE GATE STAYED CLOSED' })).toBeInTheDocument()
    expect(renderer.view!.depth).toBeGreaterThanOrEqual(renderer.view!.gateZ)
  })

  it('continues moving while the door opens and crashes if the player solves too late', () => {
    start()
    const before = approach(.4)
    raiseEnergy()
    const after = tick()
    expect(after.conditionTrue).toBe(true)
    expect(after.openAmount).toBeLessThan(.95)
    expect(after.depth - before.depth).toBeCloseTo(speedForGate(1) * 1.6 * .05, 8)
    approach(0)
    expect(screen.getByText(/before it finished opening/)).toBeInTheDocument()
    expect(renderer.view!.depth).toBeGreaterThanOrEqual(renderer.view!.gateZ)
  })

  it('maintains pace at an open gate and still awards progress when the gate is cleared', () => {
    start()
    raiseEnergy()
    const before = approach(.4)
    const after = tick()
    expect(after.conditionTrue).toBe(true)
    expect(after.openAmount).toBe(1)
    expect(after.depth - before.depth).toBeCloseTo(speedForGate(1) * 1.6 * .05, 8)
    approach(0)
    expect(screen.queryByRole('heading', { name: 'THE GATE STAYED CLOSED' })).not.toBeInTheDocument()
    expect(screen.getByText(/PACE UP/)).toBeInTheDocument()
    const passed = renderer.view!
    const next = tick()
    expect(next.depth - passed.depth).toBeCloseTo(speedForGate(2) * 1.6 * .05, 8)
  })

  it('restores game focus after the energy control is disabled and accepts arrows through the corridor transition', () => {
    start()
    const increase = screen.getByRole('button', { name: 'Increase energy' })
    increase.focus()
    raiseEnergy()
    approach(0)
    expect(increase).toBeDisabled()
    expect(document.activeElement).toBe(document.querySelector('.br-screen'))

    const before = renderer.view!.playerX
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    tick()
    expect(renderer.view!.playerX).toBeGreaterThan(before)
    fireEvent.keyUp(document.body, { key: 'ArrowRight' })
    approach(-1.8)
    expect(renderer.view!.phase).toBe('turn')
    expect(document.activeElement).toBe(document.querySelector('.br-screen'))
    const turnPosition = renderer.view!.playerX
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    tick()
    expect(renderer.view!.playerX).toBeLessThan(turnPosition)
    fireEvent.keyUp(document.activeElement!, { key: 'ArrowLeft' })
  })

  it('returns focus when resuming and leaves typing controls alone', () => {
    start()
    fireEvent.click(screen.getByRole('button', { name: 'Pause run' }))
    const resume = screen.getByRole('button', { name: 'KEEP RUNNING' })
    resume.focus()
    fireEvent.click(resume)
    expect(document.activeElement).toBe(document.querySelector('.br-screen'))
    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    const before = renderer.view!.playerX
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    tick()
    expect(renderer.view!.playerX).toBe(before)
    input.remove()
  })

  it('awards champion only after 670 gates in one run, keeps running, and saves the title for a return visit', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    // Fast, straight travel isolates the real gate-pass and award flow from steering.
    vi.spyOn(engine, 'speedForGate').mockReturnValue(100)
    vi.spyOn(engine, 'planCorridor').mockImplementation((gateZ, gateCenter) => ({
      bends: [], obstacles: [], nextGateZ: gateZ + 60,
      nextGateCenter: gateCenter, activationZ: gateZ + 30,
    }))
    let saved = { ...createSession('Review', 'review', true), backroomRunBest: 669, backroomRunGates: 10000 }
    const onProgress = vi.fn((next: typeof saved) => { saved = next })
    const first = render(<BackroomRun progress={saved} onProgress={onProgress} onBack={() => undefined} />)
    const play = screen.queryByRole('button', { name: 'PLAY GAME' })
    if (play) fireEvent.click(play)
    tick()
    expect(screen.queryByText('BACKROOM CHAMPION')).not.toBeInTheDocument()
    const increase = screen.getByRole('button', { name: 'Increase energy' })
    const decrease = screen.getByRole('button', { name: 'Decrease energy' })

    for (let gate = 1; gate <= engine.championGates; gate += 1) {
      for (let attempt = 0; attempt < 10 && renderer.view!.gateNumber < gate; attempt += 1) tick()
      expect(renderer.view!.gateNumber).toBe(gate)
      const operator = document.querySelector('.br-operator')!.textContent!
      const threshold = Number(document.querySelector('.br-condition strong')!.textContent)
      const current = Number(document.querySelector('.br-variable strong')!.textContent)
      const target = operator === '>' || operator === '!=' ? threshold + 1 : operator === '<' ? threshold - 1 : threshold
      const button = target > current ? increase : decrease
      act(() => { for (let step = 0; step < Math.abs(target - current); step += 1) fireEvent.click(button) })
      for (let attempt = 0; attempt < 10 && onProgress.mock.calls.length < gate; attempt += 1) tick()
      expect(onProgress).toHaveBeenCalledTimes(gate)
      if (gate < engine.championGates) expect(document.querySelector('.br-badge--champion')).toBeNull()
      // The original five-gate teaching checkpoint may need to be dismissed.
      if (document.querySelector('.br-overlay--milestone')) fireEvent.click(screen.getByRole('button', { name: 'KEEP RUNNING' }))
    }
    expect(saved.backroomRunBest).toBe(670)
    expect(saved.backroomRunGates).toBe(10670)
    expect(document.querySelector('.br-champion-award--celebrate')).toHaveTextContent('BACKROOM CHAMPION')
    expect(document.querySelector('.br-screen')).toHaveClass('br-screen--running')
    const depth = renderer.view!.depth
    tick()
    expect(renderer.view!.depth).toBeGreaterThan(depth)
    act(() => { vi.advanceTimersByTime(10001) })
    expect(document.querySelector('.br-champion-award--celebrate')).toBeNull()
    expect(document.querySelector('.br-badge--champion')).toHaveTextContent('BACKROOM CHAMPION')

    first.unmount()
    render(<BackroomRun progress={saved} onProgress={() => undefined} onBack={() => undefined} />)
    expect(document.querySelector('.br-badge--champion')).toHaveTextContent('BACKROOM CHAMPION')
    expect(document.querySelector('.br-champion-award--celebrate')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'CONDITIONS' }))
    expect(document.querySelector('.br-overlay--summary .br-champion-award')).toHaveTextContent('670 gates cleared in one run.')
  }, 40_000)
})
