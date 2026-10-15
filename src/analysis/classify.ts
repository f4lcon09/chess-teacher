import type { MoveClass } from '../types'

/** Lichess' centipawn -> win probability curve (0..100, White's view). */
export function winPct(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp))
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1)
}

export function classify(winLoss: number, isEngineBest: boolean): MoveClass {
  if (isEngineBest || winLoss < 0.5) return 'best'
  if (winLoss < 2) return 'excellent'
  if (winLoss < 5) return 'good'
  if (winLoss < 10) return 'inaccuracy'
  if (winLoss < 20) return 'mistake'
  return 'blunder'
}

/** Lichess' per-move accuracy formula from win-probability loss. */
export function moveAccuracy(winLoss: number): number {
  const a = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669
  return Math.max(0, Math.min(100, a + 1))
}
