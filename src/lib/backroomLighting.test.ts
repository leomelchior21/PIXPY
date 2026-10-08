import { advanceBackroomLighting, createBackroomLighting } from './backroomLighting'

describe('Backroom lighting', () => {
  it('starts with full lighting and varies the first event time', () => {
    expect(createBackroomLighting(() => 0).strength).toBe(1)
    expect(createBackroomLighting(() => 0).wait).toBeLessThan(createBackroomLighting(() => 0.9).wait)
  })

  it('strongly dims the room during a flicker and restores it afterward', () => {
    const light = createBackroomLighting(() => 0)
    light.wait = 0
    advanceBackroomLighting(light, 0.05, true, false, () => 0)
    expect(light.mode).toBe('flicker')
    expect(light.strength).toBeLessThan(0.2)
    for (let frame = 0; frame < 20; frame += 1) advanceBackroomLighting(light, 0.05, true, false, () => 0)
    expect(light.mode).toBe('steady')
    expect(light.strength).toBe(1)
    expect(light.wait).toBeGreaterThan(0)
  })

  it('alternates back to bright pulses within a flickering event', () => {
    const light = createBackroomLighting(() => 0)
    light.wait = 0
    advanceBackroomLighting(light, 0.05, true, false, () => 0)
    advanceBackroomLighting(light, 0.2, true, false, () => 0.9)
    expect(light.mode).toBe('flicker')
    expect(light.strength).toBeGreaterThan(0.9)
  })

  it('defers every second event until there is room for a blackout', () => {
    const light = createBackroomLighting(() => 0)
    light.events = 1
    light.wait = 0
    advanceBackroomLighting(light, 0.05, false, false, () => 0)
    expect(light.mode).toBe('steady')
    expect(light.strength).toBe(1)
    expect(light.events).toBe(1)
    advanceBackroomLighting(light, 0.05, true, false, () => 0)
    expect(light.mode).toBe('blackout')
    expect(light.strength).toBe(0)
    expect(light.events).toBe(2)
  })

  it('keeps the lights out for one second, then fades back to full light', () => {
    const light = createBackroomLighting(() => 0)
    light.events = 1
    light.wait = 0
    for (let frame = 0; frame < 19; frame += 1) {
      advanceBackroomLighting(light, 0.05, true, false, () => 0)
      expect(light.strength).toBe(0)
    }
    for (let frame = 0; frame < 4; frame += 1) advanceBackroomLighting(light, 0.05, true, false, () => 0)
    expect(light.strength).toBeGreaterThan(0)
    expect(light.strength).toBeLessThan(1)
    for (let frame = 0; frame < 5; frame += 1) advanceBackroomLighting(light, 0.05, true, false, () => 0)
    expect(light.strength).toBe(1)
    expect(light.mode).toBe('steady')
  })

  it('disables flickering and outages for reduced motion', () => {
    const light = createBackroomLighting(() => 0)
    light.wait = 0
    for (let frame = 0; frame < 100; frame += 1) advanceBackroomLighting(light, 0.05, true, true, () => 0)
    expect(light.strength).toBe(1)
    expect(light.mode).toBe('steady')
    expect(light.events).toBe(0)
  })
})
