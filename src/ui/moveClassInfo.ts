import type { MoveAnalysis, MoveClass, Side } from '../types'

export const CLS_LABEL: Record<MoveClass, string> = {
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

export const CLS_BADGE: Record<MoveClass, string> = {
  best: '★',
  excellent: '!',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export type ClassCounts = Record<MoveClass, number>

/** How many moves of each quality `color` played. */
export function countClasses(moves: MoveAnalysis[], color: Side): ClassCounts {
  const out: ClassCounts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  for (const m of moves) if (m.color === color) out[m.cls]++
  return out
}
