import { Chess } from 'chess.js'
import { getEngine } from '../engine/engine'
import { db } from '../db/db'
import type { GameAnalysis, GameRecord, MoveAnalysis, PositionEval } from '../types'
import { classify, moveAccuracy, winPct } from './classify'
import { explain } from './motifs'

export const DEFAULT_DEPTH = 12

function terminalEval(chess: Chess): PositionEval | null {
  if (chess.isCheckmate())
    return chess.turn() === 'w'
      ? { cp: -10000, mate: 0, best: null }
      : { cp: 10000, mate: 0, best: null }
  if (chess.isGameOver()) return { cp: 0, mate: null, best: null }
  return null
}

function sanOf(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    return new Chess(fen).move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    }).san
  } catch {
    return null
  }
}

export async function analyzeGame(
  game: GameRecord,
  depth = DEFAULT_DEPTH,
  onProgress?: (done: number, total: number) => void,
): Promise<GameAnalysis> {
  const parsed = new Chess()
  parsed.loadPgn(game.pgn)
  const history = parsed.history({ verbose: true })

  const engine = getEngine()
  const evals: PositionEval[] = []
  const total = history.length + 1
  const fens = [history[0]?.before ?? new Chess().fen(), ...history.map((m) => m.after)]
  for (let i = 0; i < fens.length; i++) {
    const terminal = terminalEval(new Chess(fens[i]))
    evals.push(terminal ?? (await engine.evaluate(fens[i], depth)))
    onProgress?.(i + 1, total)
  }

  const moves: MoveAnalysis[] = history.map((m, idx) => {
    const before = evals[idx]
    const after = evals[idx + 1]
    const wBefore = winPct(before.cp)
    const wAfter = winPct(after.cp)
    const winLoss = Math.max(0, m.color === 'w' ? wBefore - wAfter : wAfter - wBefore)
    const uci = m.from + m.to + (m.promotion ?? '')
    const cls = classify(winLoss, uci === before.best)
    const bestSan = sanOf(m.before, before.best)
    return {
      ply: idx + 1,
      san: m.san,
      uci,
      fenBefore: m.before,
      fenAfter: m.after,
      color: m.color === 'w' ? 'white' : 'black',
      cls,
      winLoss,
      bestUci: before.best,
      bestSan,
      explanation: explain({ fenBefore: m.before, playedUci: uci, cls, before, after, bestSan }),
    }
  })

  const avg = (color: 'white' | 'black') => {
    const mine = moves.filter((m) => m.color === color)
    if (!mine.length) return 0
    return mine.reduce((s, m) => s + moveAccuracy(m.winLoss), 0) / mine.length
  }

  const analysis: GameAnalysis = {
    gameId: game.id,
    depth,
    evals,
    moves,
    accuracy: { white: avg('white'), black: avg('black') },
  }
  await db.analyses.put(analysis)
  return analysis
}
