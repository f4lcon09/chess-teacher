import { Chess } from 'chess.js'
import type { GameRecord, Outcome } from '../types'

export const MAX_PLY = 30
const MAX_IDS = 50

export interface Stats {
  n: number
  w: number
  d: number
  l: number
}

export interface MoveStat extends Stats {
  san: string
  nextKey: string
}

export interface TreeNode extends Stats {
  key: string
  ply: number
  moves: Map<string, MoveStat>
  gameIds: string[]
}

export type OpeningTree = Map<string, TreeNode>

/** Position identity ignoring move counters, so transpositions merge. */
export function posKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

function add(s: Stats, o: Outcome) {
  s.n++
  if (o === 'win') s.w++
  else if (o === 'draw') s.d++
  else s.l++
}

export function score(s: Stats): number {
  return s.n ? (s.w + s.d / 2) / s.n : 0
}

/** Builds the move tree of the given games (all played by the same side). */
export function buildTree(games: GameRecord[]): OpeningTree {
  const tree: OpeningTree = new Map()
  const node = (fen: string, ply: number): TreeNode => {
    const key = posKey(fen)
    let n = tree.get(key)
    if (!n) {
      n = { key, ply, n: 0, w: 0, d: 0, l: 0, moves: new Map(), gameIds: [] }
      tree.set(key, n)
    }
    return n
  }
  for (const g of games) {
    const parsed = new Chess()
    try {
      parsed.loadPgn(g.pgn)
    } catch {
      continue
    }
    const history = parsed.history({ verbose: true }).slice(0, MAX_PLY)
    for (let i = 0; i <= history.length; i++) {
      const fen = i === 0 ? (history[0]?.before ?? new Chess().fen()) : history[i - 1].after
      const cur = node(fen, i)
      add(cur, g.outcome)
      if (cur.gameIds.length < MAX_IDS) cur.gameIds.push(g.id)
      if (i < history.length) {
        const m = history[i]
        let ms = cur.moves.get(m.san)
        if (!ms) {
          ms = { san: m.san, nextKey: posKey(m.after), n: 0, w: 0, d: 0, l: 0 }
          cur.moves.set(m.san, ms)
        }
        add(ms, g.outcome)
      }
    }
  }
  return tree
}

export interface Problem {
  path: string[] // SAN moves from the start position
  node: TreeNode
}

/**
 * Positions reached at least `minGames` times where the score is under `maxScore`.
 * A position is skipped when an already listed ancestor covers exactly the same games.
 */
export function findProblems(
  tree: OpeningTree,
  rootKey: string,
  minGames = 4,
  maxScore = 0.4,
  maxDepth = 14,
): Problem[] {
  const out: Problem[] = []
  const seen = new Set<string>()
  const walk = (key: string, path: string[], coveredBy: number) => {
    const n = tree.get(key)
    if (!n || seen.has(key) || path.length > maxDepth) return
    seen.add(key)
    let covered = coveredBy
    if (path.length > 0 && n.n >= minGames && score(n) < maxScore && n.n !== coveredBy) {
      out.push({ path, node: n })
      covered = n.n
    }
    for (const m of n.moves.values()) walk(m.nextKey, [...path, m.san], covered)
  }
  walk(rootKey, [], -1)
  return out.sort((a, b) => b.node.n - a.node.n).slice(0, 15)
}
