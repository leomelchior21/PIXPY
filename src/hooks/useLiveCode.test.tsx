import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveCode } from './useLiveCode'

const api = vi.hoisted(() => ({
  publish: vi.fn(async () => true),
  session: vi.fn(),
}))

vi.mock('../lib/liveCode', () => ({ publishLiveCode: api.publish }))
vi.mock('../session/progressSession', () => ({ loadSession: api.session }))

function Probe({ code, detail = 'STOP · String Sheet' }: { code: string; detail?: string }) {
  useLiveCode('stop', code, detail)
  return null
}

describe('useLiveCode publisher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    api.publish.mockClear()
    api.session.mockReturnValue({ username: 'adaa', isTeacher: false })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('publishes 600 ms after the student pauses and skips unchanged content', () => {
    const view = render(<Probe code='print("a")' />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(api.publish).toHaveBeenCalledTimes(1)
    expect(api.publish).toHaveBeenLastCalledWith('adaa', 'stop', 'STOP · String Sheet', 'print("a")')

    view.rerender(<Probe code='print("a")' />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(api.publish).toHaveBeenCalledTimes(1)

    view.rerender(<Probe code='print("b")' />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(api.publish).toHaveBeenCalledTimes(2)
    expect(api.publish).toHaveBeenLastCalledWith('adaa', 'stop', 'STOP · String Sheet', 'print("b")')
  })

  it('publishes the final state when the editor unmounts', () => {
    const view = render(<Probe code='print("first")' />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(api.publish).toHaveBeenCalledTimes(1)

    act(() => { view.unmount() })
    expect(api.publish).toHaveBeenCalledTimes(1)

    api.publish.mockClear()
    const second = render(<Probe code='print("one")' />)
    act(() => { vi.advanceTimersByTime(600) })
    second.rerender(<Probe code='print("two")' />)
    act(() => { second.unmount() })
    expect(api.publish).toHaveBeenCalledTimes(2)
    expect(api.publish).toHaveBeenLastCalledWith('adaa', 'stop', 'STOP · String Sheet', 'print("two")')
  })

  it('never publishes for teachers or signed-out visitors', () => {
    api.session.mockReturnValue({ username: 'leleomaker', isTeacher: true })
    const teacher = render(<Probe code='print("secret")' />)
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => { teacher.unmount() })
    expect(api.publish).not.toHaveBeenCalled()

    api.session.mockReturnValue(null)
    const visitor = render(<Probe code='print("hello")' />)
    act(() => { vi.advanceTimersByTime(5000) })
    act(() => { visitor.unmount() })
    expect(api.publish).not.toHaveBeenCalled()
  })
})
