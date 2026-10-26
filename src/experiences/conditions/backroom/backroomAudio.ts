// Every sound is synthesized: no audio files ship with the game.
// The context is only created from a tap or key press, as iPad Safari requires.

const preferenceKey = 'pixpy.backroom-audio.v1'

export function loadAudioPreference(): boolean {
  try { return localStorage.getItem(preferenceKey) === 'on' } catch { return false }
}

export function saveAudioPreference(on: boolean): void {
  try { localStorage.setItem(preferenceKey, on ? 'on' : 'off') } catch { /* Preference is optional. */ }
}

type AudioContextConstructor = typeof AudioContext

export class BackroomAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private hum: GainNode | null = null
  private humSources: AudioScheduledSourceNode[] = []
  private noise: AudioBuffer | null = null
  private enabled = false

  get on(): boolean {
    return this.enabled
  }

  enable(): void {
    this.enabled = true
    try {
      if (!this.context) {
        const Constructor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext)
        if (!Constructor) return
        this.context = new Constructor()
        this.master = this.context.createGain()
        this.master.gain.value = 0.9
        this.master.connect(this.context.destination)
        this.noise = this.makeNoise(this.context)
      }
      void this.context.resume()
    } catch { this.context = null }
  }

  disable(): void {
    this.enabled = false
    this.stopHum()
    try { void this.context?.suspend() } catch { /* Audio is optional. */ }
  }

  dispose(): void {
    this.stopHum()
    try { void this.context?.close() } catch { /* Audio is optional. */ }
    this.context = null
    this.enabled = false
  }

  private makeNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
    return buffer
  }

  private ready(): AudioContext | null {
    return this.enabled && this.context && this.master && this.context.state !== 'closed' ? this.context : null
  }

  // The fluorescent hum: mains buzz and its harmonic, filtered warm.
  startHum(): void {
    const context = this.ready()
    if (!context || this.hum) return
    const gain = context.createGain()
    gain.gain.value = 0
    gain.gain.linearRampToValueAtTime(0.022, context.currentTime + 1.2)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 520
    filter.connect(gain)
    gain.connect(this.master!)
    for (const [frequency, level] of [[60, 0.7], [120, 0.45], [180.4, 0.18]] as const) {
      const oscillator = context.createOscillator()
      const voice = context.createGain()
      oscillator.type = 'sawtooth'
      oscillator.frequency.value = frequency
      voice.gain.value = level
      oscillator.connect(voice)
      voice.connect(filter)
      oscillator.start()
      this.humSources.push(oscillator)
    }
    this.hum = gain
  }

  stopHum(): void {
    const context = this.context
    if (this.hum && context) {
      try {
        this.hum.gain.cancelScheduledValues(context.currentTime)
        this.hum.gain.setTargetAtTime(0, context.currentTime, 0.08)
      } catch { /* Audio is optional. */ }
    }
    const sources = this.humSources
    window.setTimeout(() => sources.forEach((source) => { try { source.stop() } catch { /* already stopped */ } }), 400)
    this.humSources = []
    this.hum = null
  }

  // Tracks the room lights: the hum drops out with them.
  setHumLevel(light: number): void {
    const context = this.ready()
    if (!context || !this.hum) return
    this.hum.gain.setTargetAtTime(0.022 * Math.max(0, Math.min(1, light)), context.currentTime, 0.03)
  }

  private burst(duration: number, frequency: number, q: number, level: number, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const context = this.ready()
    if (!context || !this.noise) return
    const source = context.createBufferSource()
    source.buffer = this.noise
    const filter = context.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const gain = context.createGain()
    const start = context.currentTime + delay
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    source.start(start, Math.random() * 0.5)
    source.stop(start + duration + 0.05)
  }

  private tone(frequency: number, duration: number, type: OscillatorType, level: number, delay = 0, slideTo?: number): void {
    const context = this.ready()
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const start = context.currentTime + delay
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain)
    gain.connect(this.master!)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.05)
  }

  // Soft steps on damp carpet.
  footstep(): void {
    this.burst(0.11, 180 + Math.random() * 60, 0.9, 0.05, 'lowpass')
  }

  tick(): void {
    this.tone(1400, 0.035, 'square', 0.012)
  }

  toggle(): void {
    this.tone(520, 0.05, 'square', 0.02)
    this.tone(780, 0.05, 'square', 0.016, 0.05)
  }

  doorOpen(): void {
    this.burst(0.5, 900, 1.4, 0.05, 'bandpass')
    this.tone(70, 0.22, 'triangle', 0.08)
  }

  correct(): void {
    this.tone(659, 0.16, 'triangle', 0.05)
    this.tone(988, 0.3, 'triangle', 0.045, 0.09)
  }

  combo(): void {
    this.tone(1318, 0.18, 'triangle', 0.035, 0.2)
  }

  mistake(): void {
    this.tone(110, 0.9, 'sawtooth', 0.06, 0, 55)
    this.tone(116, 0.9, 'sawtooth', 0.04, 0, 58)
    this.burst(0.55, 2200, 0.4, 0.05, 'highpass')
  }

  slam(): void {
    this.burst(0.3, 120, 0.8, 0.18, 'lowpass')
    this.tone(48, 0.35, 'sine', 0.14)
  }

  scrape(): void {
    this.burst(0.22, 2600, 2.5, 0.035, 'bandpass')
  }

  stumble(): void {
    this.burst(0.18, 300, 1.2, 0.12, 'lowpass')
    this.tone(160, 0.12, 'square', 0.03, 0.05)
  }

  jump(): void {
    this.burst(0.28, 700, 0.9, 0.05, 'bandpass')
    this.tone(220, 0.2, 'triangle', 0.025, 0, 440)
  }

  land(): void {
    this.burst(0.16, 160, 0.9, 0.14, 'lowpass')
  }

  blackout(): void {
    this.tone(240, 0.5, 'sawtooth', 0.03, 0, 40)
  }

  nightshot(): void {
    this.tone(1760, 0.06, 'square', 0.018, 0.25)
    this.tone(1760, 0.06, 'square', 0.018, 0.36)
  }

  presence(): void {
    this.tone(38, 2.4, 'sine', 0.12)
    this.tone(41, 2.4, 'sine', 0.08)
  }

  clear(): void {
    ;[523, 659, 784, 1046].forEach((frequency, index) => this.tone(frequency, 0.4, 'triangle', 0.045, index * 0.11))
  }

  // The tape change: spring door, plastic slide, latch, transport motor and the camcorder beep.
  tapeEject(): void {
    this.burst(0.16, 420, 1, 0.1, 'lowpass')
    this.tone(260, 0.22, 'sawtooth', 0.016, 0, 150)
  }

  tapeInsert(): void {
    this.burst(0.38, 1700, 0.7, 0.045, 'bandpass')
  }

  tapeSeat(): void {
    this.burst(0.06, 3200, 2, 0.06, 'bandpass')
    this.tone(1900, 0.03, 'square', 0.02)
  }

  tapeClack(): void {
    this.burst(0.14, 240, 0.9, 0.18, 'lowpass')
    this.tone(92, 0.16, 'square', 0.05)
    this.tone(2300, 0.03, 'square', 0.02, 0.04)
  }

  tapeMotor(): void {
    this.tone(150, 0.55, 'sawtooth', 0.016, 0, 260)
    this.burst(0.55, 650, 3, 0.022, 'bandpass')
  }

  tapePlay(): void {
    this.tone(2093, 0.07, 'square', 0.02)
  }

  tapeStatic(): void {
    this.burst(0.3, 4200, 0.3, 0.06, 'highpass')
  }

  // The door into Level 0: the latch, then a long hinge creak.
  entryDoor(): void {
    this.tone(1600, 0.03, 'square', 0.02)
    this.burst(0.08, 900, 2, 0.05, 'bandpass')
    this.tone(180, 0.9, 'sawtooth', 0.012, 0.1, 120)
    this.burst(0.9, 1400, 6, 0.02, 'bandpass', 0.1)
  }

  // A drill marks its lane: three quick warning beeps.
  drillWarn(): void {
    for (let beep = 0; beep < 3; beep += 1) this.tone(1250, 0.07, 'square', 0.018, beep * 0.14)
  }

  // A giant electric drill spinning up and punching through.
  drill(): void {
    this.tone(110, 0.8, 'sawtooth', 0.05, 0, 320)
    this.tone(2400, 0.5, 'square', 0.008, 0.05, 3600)
    this.burst(0.8, 1800, 1.2, 0.05, 'bandpass')
    this.burst(0.25, 140, 0.8, 0.16, 'lowpass', 0.25)
  }

  // A giant saw spinning up out of the wall.
  saw(): void {
    this.tone(700, 0.9, 'sawtooth', 0.02, 0, 1500)
    this.burst(0.9, 3200, 1.5, 0.04, 'bandpass')
  }

  // Over the edge of a hole: wind rushing past and a falling tone.
  fall(): void {
    this.burst(1.1, 500, 0.5, 0.08, 'lowpass')
    this.tone(420, 1.1, 'sine', 0.05, 0, 60)
  }

  tapeRewind(): void {
    this.tone(320, 0.9, 'sawtooth', 0.016, 0, 980)
    this.burst(0.9, 2600, 1, 0.03, 'bandpass')
  }

  battery(): void {
    this.tone(880, 0.1, 'square', 0.025)
    this.tone(1320, 0.18, 'square', 0.025, 0.1)
  }
}
