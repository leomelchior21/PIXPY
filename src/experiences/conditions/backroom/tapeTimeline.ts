// The tape change, shared by the 3D deck and its flat fallback.
export type TapeCue = 'pull' | 'eject' | 'insert' | 'seat' | 'clack' | 'motor' | 'zoom' | 'play' | 'static' | 'rewind'
export type TapeKind = 'insert' | 'rewind'

export interface TapeLabel {
  number: string
  title: string
  focus: string
  stars: number
  deep: boolean
  // Still on the shelf behind a blank label.
  locked?: boolean
  // One line to remember while the tape loads, e.g. "50 >= 50 → TRUE".
  tip?: string
}

// Seconds from the start of the sequence.
export const tapeTimeline: Record<TapeKind, { cues: Array<[number, TapeCue]>; end: number }> = {
  insert: {
    // The tape comes off the shelf first, then into the camcorder.
    cues: [[0.45, 'pull'], [1.15, 'eject'], [1.55, 'insert'], [2.25, 'seat'], [2.6, 'clack'], [2.85, 'motor'], [3.4, 'zoom'], [4.25, 'play'], [4.85, 'static']],
    end: 5.15,
  },
  rewind: {
    cues: [[0, 'rewind'], [0.95, 'play']],
    end: 1.35,
  },
}

// After the PLAY screen the tape loads: the level is built step by step before the briefing.
export const tapeLoading = {
  steps: [[0, 'READING THE TAPE'], [0.6, 'BUILDING THE CORRIDOR'], [1.25, 'CHARGING THE BATTERIES'], [1.9, 'OPENING LEVEL 0']] as Array<[number, string]>,
  end: 2.6,
}

export function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}
