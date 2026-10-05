import { act, fireEvent, render, screen } from '@testing-library/react'
import { BackroomRun } from './BackroomRun'
import type { BackroomView } from './backroomRenderer'
import { speedForGate } from '../../lib/backroomEngine'
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

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

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
    for (let count = 0; count < 31; count += 1) fireEvent.click(screen.getByRole('button', { name: 'Increase energy' }))
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
    for (let count = 0; count < 31; count += 1) fireEvent.click(screen.getByRole('button', { name: 'Increase energy' }))
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
})
