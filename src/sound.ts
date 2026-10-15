// Tiny synthesized sound effects (WebAudio), so the app needs no audio files.

export type SoundKind = 'move' | 'capture' | 'check' | 'win' | 'loss' | 'draw'

const KEY = 'chess-teacher:sound'

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

let ctx: AudioContext | null = null

interface Tone {
  freq: number
  at: number // seconds from now
  dur: number
  type?: OscillatorType
  vol?: number
}

const SOUNDS: Record<SoundKind, Tone[]> = {
  move: [{ freq: 330, at: 0, dur: 0.07, type: 'triangle', vol: 0.18 }],
  capture: [
    { freq: 180, at: 0, dur: 0.12, type: 'square', vol: 0.14 },
    { freq: 120, at: 0.05, dur: 0.12, type: 'square', vol: 0.14 },
  ],
  check: [
    { freq: 880, at: 0, dur: 0.12, type: 'sine', vol: 0.25 },
    { freq: 1175, at: 0.14, dur: 0.18, type: 'sine', vol: 0.25 },
  ],
  win: [523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.14, dur: 0.25, type: 'triangle', vol: 0.25 })),
  loss: [392, 349, 311, 262].map((freq, i) => ({ freq, at: i * 0.2, dur: 0.3, type: 'sawtooth', vol: 0.15 })),
  draw: [
    { freq: 440, at: 0, dur: 0.2, type: 'sine', vol: 0.22 },
    { freq: 440, at: 0.25, dur: 0.3, type: 'sine', vol: 0.22 },
  ],
}

export function playSound(kind: SoundKind) {
  if (!soundEnabled()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime
    for (const t of SOUNDS[kind]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = t.type ?? 'sine'
      osc.frequency.value = t.freq
      const start = t0 + t.at
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(t.vol ?? 0.2, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + t.dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + t.dur + 0.02)
    }
  } catch {
    /* audio unavailable */
  }
}
