export type Side = 'white' | 'black'
export type Outcome = 'win' | 'loss' | 'draw'

export interface GameRecord {
  id: string // chess.com game url
  pgn: string
  endTime: number // unix seconds
  timeClass: string // bullet | blitz | rapid | daily
  timeControl: string
  rated: boolean
  color: Side // side the tracked user played
  outcome: Outcome
  resultDetail: string // e.g. checkmated, resigned, timeout
  userRating: number
  opponent: string
  opponentRating: number
  openingName: string
  eco: string
}

export type MoveClass =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'

/** Engine evaluation of one position, always from White's point of view. */
export interface PositionEval {
  cp: number // centipawns, mates folded into +-10000
  mate: number | null // moves to mate, signed (positive = White mates)
  best: string | null // best move in UCI, null if game over
}

export interface MoveAnalysis {
  ply: number // 1-based
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  color: Side
  cls: MoveClass
  winLoss: number // win-probability points lost by the mover (>= 0)
  bestUci: string | null
  bestSan: string | null
  explanation: string
}

export interface GameAnalysis {
  gameId: string
  depth: number
  evals: PositionEval[] // index i = position after i plies
  moves: MoveAnalysis[]
  accuracy: { white: number; black: number }
}
