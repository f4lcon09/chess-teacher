import { Chess, type Move, type Square } from 'chess.js'
import type { MoveClass, PositionEval } from '../types'

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const NAME: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}

function uciToMove(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    })
  } catch {
    return null
  }
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
  const board = new Chess(i.fenBefore)
  const mover = board.turn()
  const sign = mover === 'w' ? 1 : -1
  const hint = i.bestSan ? ` Better was ${i.bestSan}.` : ''

  // Mate related
  if (i.before.mate !== null && Math.sign(i.before.mate) === sign) {
    if (i.after.mate === null || Math.sign(i.after.mate) !== sign)
      return `You missed a forced mate in ${Math.abs(i.before.mate)}.${hint}`
  }
  if (i.after.mate !== null && Math.sign(i.after.mate) === -sign)
    return `This allows a forced mate in ${Math.abs(i.after.mate)}.${hint}`

  // Hanging piece: the opponent's best reply wins material for free
  const played = uciToMove(board, i.playedUci)
  if (played && i.after.best) {
    const reply = uciToMove(board, i.after.best)
    if (reply?.captured && VALUE[reply.captured] >= 3) {
      const sq = reply.to as Square
      // 'board' now has the reply played; look at the position before it.
      const probe = new Chess(played.after)
      const defended = probe.isAttacked(sq, mover)
      const gain = VALUE[reply.captured] - (defended ? VALUE[reply.piece] : 0)
      if (!defended)
        return `Your ${NAME[reply.captured]} on ${sq} was left undefended and can be taken by ${reply.san}.${hint}`
      if (gain > 0)
        return `${reply.san} wins a ${NAME[reply.captured]} for a ${NAME[reply.piece]}, a bad trade for you.${hint}`
    }
  }

  // Missed free material
  const best = i.before.best
  if (best) {
    const probe = new Chess(i.fenBefore)
    const bm = uciToMove(probe, best)
    if (bm?.captured && VALUE[bm.captured] >= 3) {
      const safe = !new Chess(bm.before).isAttacked(bm.to as Square, mover === 'w' ? 'b' : 'w')
      if (safe || VALUE[bm.captured] > VALUE[bm.piece])
        return `You missed a chance to win a ${NAME[bm.captured]} with ${bm.san}.`
    }
  }

  return `The evaluation dropped noticeably.${hint}`
}
