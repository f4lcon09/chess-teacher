import { Chess, type Color } from 'chess.js'
import type { MoveClass, PositionEval } from '../types'

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function material(chess: Chess, color: Color): number {
  let total = 0
  for (const row of chess.board())
    for (const sq of row)
      if (sq) total += sq.color === color ? VALUE[sq.type] : -VALUE[sq.type]
  return total
}

interface Line {
  sans: string[]
  delta: number // material change for `color` over the line
  firstIsCheck: boolean
}

/** Plays `ucis` from `fen` and reports the SANs and the material change for `color`. */
function playLine(fen: string, ucis: string[], color: Color): Line {
  const chess = new Chess(fen)
  const start = material(chess, color)
  const sans: string[] = []
  let firstIsCheck = false
  for (const uci of ucis) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      if (sans.length === 0) firstIsCheck = chess.inCheck()
      sans.push(m.san)
    } catch {
      break
    }
  }
  return { sans, delta: material(chess, color) - start, firstIsCheck }
}

/** Keep complete exchanges: an even number of plies once there are at least two. */
function trimEven(pv: string[]): string[] {
  const n = pv.length
  return pv.slice(0, n >= 2 ? n - (n % 2) : n)
}

/** Keep an odd number of plies so the line ends after the opponent's reply. */
function trimOdd(pv: string[]): string[] {
  const n = pv.length
  return pv.slice(0, n % 2 === 1 ? n : Math.max(1, n - 1))
}

function pts(n: number): string {
  return `${n} point${n === 1 ? '' : 's'}`
}

export interface MotifInput {
  fenBefore: string
  playedUci: string
  cls: MoveClass
  before: PositionEval // position before the move
  after: PositionEval // position after the move
  bestSan: string | null
}

/** Short rule-based explanation of why a move was weak. Empty for good moves. */
export function explain(i: MotifInput): string {
  if (i.cls === 'best' || i.cls === 'excellent' || i.cls === 'good') return ''
  const mover = new Chess(i.fenBefore).turn()
  const sign = mover === 'w' ? 1 : -1
  const hint = i.bestSan ? ` Better was ${i.bestSan}.` : ''

  if (i.before.mate !== null && Math.sign(i.before.mate) === sign) {
    if (i.after.mate === null || Math.sign(i.after.mate) !== sign)
      return `You missed a forced mate in ${Math.abs(i.before.mate)}.${hint}`
  }
  if (i.after.mate !== null && Math.sign(i.after.mate) === -sign)
    return `This allows a forced mate in ${Math.abs(i.after.mate)}.${hint}`

  // Material along the engine's lines: the played move plus the opponent's best answer,
  // versus the engine's preferred line.
  const afterFen = new Chess(i.fenBefore)
  try {
    afterFen.move({
      from: i.playedUci.slice(0, 2),
      to: i.playedUci.slice(2, 4),
      promotion: i.playedUci[4],
    })
  } catch {
    return `The evaluation dropped noticeably.${hint}`
  }
  const base = material(new Chess(i.fenBefore), mover)
  const played = playLine(afterFen.fen(), trimEven((i.after.pv ?? []).slice(0, 4)), mover)
  const playedDelta = material(afterFen, mover) - base + played.delta
  const bestLine = i.before.pv?.length
    ? playLine(i.fenBefore, trimOdd(i.before.pv.slice(0, 5)), mover)
    : null
  const bestDelta = bestLine?.delta ?? 0
  const lost = bestDelta - playedDelta

  if (played.sans.length && lost >= 2 && playedDelta < 0)
    return `This loses material: ${played.sans.join(' ')} costs you ${pts(-playedDelta)}.${hint}`
  if (bestLine && bestLine.sans.length && bestDelta >= 2 && lost >= 2)
    return `You missed a way to win material: ${bestLine.sans.join(' ')} (+${pts(bestDelta)}).`
  if (played.sans.length)
    return `${played.sans[0]} is a strong reply${played.firstIsCheck ? ' with check' : ''}; your position got worse without an immediate material loss.${hint}`
  return `The evaluation dropped noticeably.${hint}`
}
