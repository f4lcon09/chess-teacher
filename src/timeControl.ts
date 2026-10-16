export interface TimeControl {
  id: string
  label: string
  base: number // seconds
  inc: number // seconds added after each move
}

function tc(label: string, base: number, inc: number): TimeControl {
  return { id: `${base}+${inc}`, label, base, inc }
}

// Same presets and order as chess.com (without daily games).
export const TIME_CONTROL_GROUPS: { name: string; items: TimeControl[] }[] = [
  {
    name: 'Bullet',
    items: [tc('1 min', 60, 0), tc('1 + 1', 60, 1), tc('2 + 1', 120, 1), tc('30 sec', 30, 0), tc('20 sec + 1', 20, 1)],
  },
  {
    name: 'Blitz',
    items: [tc('3 min', 180, 0), tc('3 + 2', 180, 2), tc('5 min', 300, 0), tc('5 + 3', 300, 3)],
  },
  {
    name: 'Rapid',
    items: [
      tc('10 min', 600, 0),
      tc('10 + 5', 600, 5),
      tc('15 + 10', 900, 10),
      tc('30 min', 1800, 0),
      tc('20 min', 1200, 0),
      tc('60 min', 3600, 0),
    ],
  },
]

export const ALL_TIME_CONTROLS = TIME_CONTROL_GROUPS.flatMap((g) => g.items)

export function formatClock(ms: number): string {
  if (ms < 10_000) return (Math.max(0, ms) / 1000).toFixed(1)
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Stored on the game record, e.g. "600+5". */
export function timeControlString(t: TimeControl | null): string {
  return t ? `${t.base}+${t.inc}` : '-'
}
