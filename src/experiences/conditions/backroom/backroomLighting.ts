export const lightingStartGate = 6

export interface BackroomLighting {
  strength: number
  mode: 'steady' | 'flicker' | 'blackout'
  wait: number
  elapsed: number
  duration: number
  pulseWait: number
  events: number
}

export function createBackroomLighting(random: () => number = Math.random): BackroomLighting {
  return { strength: 1, mode: 'steady', wait: 3 + random() * 5, elapsed: 0, duration: 0, pulseWait: 0, events: 0 }
}

// Called only while the run advances, so pauses also freeze lighting events.
export function advanceBackroomLighting(light: BackroomLighting, dt: number, canBlackout: boolean, reduced: boolean, random: () => number = Math.random): void {
  if (reduced) {
    light.strength = 1
    light.mode = 'steady'
    return
  }

  if (light.mode === 'steady') {
    light.wait -= dt
    if (light.wait > 0) return
    const blackout = (light.events + 1) % 2 === 0
    // Wait for a clear stretch before taking the room lights out.
    if (blackout && !canBlackout) return
    light.events += 1
    light.mode = blackout ? 'blackout' : 'flicker'
    light.elapsed = 0
    light.duration = blackout ? 1.35 : 0.9 + random() * 0.5
    light.pulseWait = 0
  }

  light.elapsed += dt
  if (light.elapsed >= light.duration) {
    light.mode = 'steady'
    light.strength = 1
    light.wait = 5 + random() * 8
  } else if (light.mode === 'blackout') {
    // A full second without fluorescents, then a short recovery.
    light.strength = light.elapsed <= 1 ? 0 : Math.min(1, (light.elapsed - 1) / 0.35)
  } else {
    light.pulseWait -= dt
    if (light.pulseWait <= 0) {
      light.strength = random() < 0.6 ? 0.06 + random() * 0.16 : 0.75 + random() * 0.25
      light.pulseWait = 0.12 + random() * 0.16
    }
  }
}
