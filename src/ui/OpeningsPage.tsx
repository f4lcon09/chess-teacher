import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { db } from '../db/db'
import { useBoardStyles } from './boardTheme'
import { loadBook, lookupPath, type Book } from '../openings/book'
import { buildTree, findProblems, posKey, score, type Stats } from '../openings/tree'
import type { GameRecord, Side } from '../types'

type Filter = 'fast' | 'all' | 'bullet' | 'blitz' | 'rapid'

const FILTERS: Record<Filter, (g: GameRecord) => boolean> = {
  fast: (g) => g.timeClass === 'blitz' || g.timeClass === 'rapid',
  all: () => true,
  bullet: (g) => g.timeClass === 'bullet',
  blitz: (g) => g.timeClass === 'blitz',
  rapid: (g) => g.timeClass === 'rapid',
}

const ROOT = posKey(new Chess().fen())
const DEMO_PLIES = 8 // 4 moves per side
const DEMO_STEP_MS = 800

function pct(s: Stats): string {
  return `${Math.round(score(s) * 100)}%`
}

function ResultBar({ s }: { s: Stats }) {
  const w = (x: number) => `${(x / Math.max(1, s.n)) * 100}%`
  return (
    <span className="rbar" title={`${s.w} wins, ${s.d} draws, ${s.l} losses`}>
      <i style={{ width: w(s.w), background: 'var(--best)' }} />
      <i style={{ width: w(s.d), background: 'var(--muted)' }} />
      <i style={{ width: w(s.l), background: 'var(--blunder)' }} />
    </span>
  )
}

function formatPath(path: string[]): string {
  return path.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ')
}

/** The moves you most often played in this opening: the most common move at each ply. */
function openingLine(games: GameRecord[], name: string): string[] {
  let pool: string[][] = []
  for (const g of games) {
    if (g.openingName !== name) continue
    const c = new Chess()
    try {
      c.loadPgn(g.pgn)
    } catch {
      continue
    }
    pool.push(c.history().slice(0, DEMO_PLIES))
  }
  const line: string[] = []
  for (let i = 0; i < DEMO_PLIES; i++) {
    const counts = new Map<string, number>()
    for (const l of pool) if (l[i]) counts.set(l[i], (counts.get(l[i]) ?? 0) + 1)
    if (counts.size === 0) break
    const [move] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    line.push(move)
    pool = pool.filter((l) => l[i] === move)
  }
  return line
}

interface Props {
  version: number
  onOpenGame: (id: string) => void
}

export function OpeningsPage({ version, onOpenGame }: Props) {
  const boardStyles = useBoardStyles()
  const [all, setAll] = useState<GameRecord[]>([])
  const [color, setColor] = useState<Side>('white')
  const [filter, setFilter] = useState<Filter>('fast')
  const [path, setPath] = useState<string[]>([])
  const [demo, setDemo] = useState<{ name: string; line: string[] } | null>(null)

  useEffect(() => {
    void db.games.toArray().then(setAll)
  }, [version])

  const games = useMemo(
    () => all.filter((g) => g.color === color && FILTERS[filter](g)),
    [all, color, filter],
  )
  const tree = useMemo(() => buildTree(games), [games])
  const problems = useMemo(() => findProblems(tree, ROOT), [tree])

  const openings = useMemo(() => {
    const m = new Map<string, Stats & { name: string }>()
    for (const g of games) {
      const s = m.get(g.openingName) ?? { name: g.openingName, n: 0, w: 0, d: 0, l: 0 }
      s.n++
      if (g.outcome === 'win') s.w++
      else if (g.outcome === 'draw') s.d++
      else s.l++
      m.set(g.openingName, s)
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 20)
  }, [games])

  const chess = useMemo(() => {
    const c = new Chess()
    for (const san of path) c.move(san)
    return c
  }, [path])
  const [book, setBook] = useState<Book | null>(null)
  useEffect(() => {
    void loadBook().then(setBook)
  }, [])
  const info = book ? lookupPath(book, path) : null
  const node = tree.get(posKey(chess.fen()))
  const moves = node ? [...node.moves.values()].sort((a, b) => b.n - a.n) : []
  const myTurn = (path.length % 2 === 0) === (color === 'white')

  // Plays the demo line one move at a time; any manual navigation cancels it (see `go`).
  useEffect(() => {
    if (!demo) return
    let i = 0
    const id = window.setInterval(() => {
      i++
      setPath(demo.line.slice(0, i))
      if (i >= demo.line.length) window.clearInterval(id)
    }, DEMO_STEP_MS)
    return () => window.clearInterval(id)
  }, [demo])

  /** User navigation: stops the demo and jumps to `p`. */
  const go = (p: string[]) => {
    setDemo(null)
    setPath(p)
  }

  const startDemo = (name: string) => {
    const line = openingLine(games, name)
    if (!line.length) return
    setPath([])
    setDemo({ name, line })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const pick = (c: Side) => {
    setColor(c)
    go([])
  }

  return (
    <div>
      <div className="bar">
        <select value={color} onChange={(e) => pick(e.target.value as Side)}>
          <option value="white">Playing White</option>
          <option value="black">Playing Black</option>
        </select>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as Filter)
            go([])
          }}
        >
          <option value="fast">Blitz + Rapid</option>
          <option value="all">All types</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
        </select>
        <span className="muted">{games.length} games analyzed for this view</span>
      </div>

      <div className="review">
        <div className="boardCol">
          <div className="boardWrap">
            <Chessboard
              options={{
                position: chess.fen(),
                boardOrientation: color,
                allowDragging: false,
                ...boardStyles,
              }}
            />
          </div>
          <div className="bar center">
            <button onClick={() => go([])}>⏮ Start</button>
            <button onClick={() => go(path.slice(0, -1))} disabled={!path.length}>
              ◀ Back
            </button>
            {demo && (
              <button
                onClick={() => {
                  setPath([])
                  setDemo({ ...demo })
                }}
              >
                ↻ Replay
              </button>
            )}
          </div>
          {demo && (
            <p className="center">
              <strong>{demo.name}</strong>
              <br />
              <span className="muted">The way you usually play it: {formatPath(demo.line)}</span>
            </p>
          )}
          <p className="muted center">{path.length ? formatPath(path) : 'Start position'}</p>
          {info && (
            <p className="center">
              <strong>{info.eco}</strong> {info.name}
              {info.leftAtMove !== null && (
                <span className="muted"> · out of book at move {info.leftAtMove}</span>
              )}
            </p>
          )}
        </div>

        <div className="sideCol">
          <h3>Your openings</h3>
          <p className="muted">Click one to watch how it starts on the board.</p>
          <div className="scrollbox">
            <table className="games">
              <thead>
                <tr>
                  <th>Opening</th>
                  <th>Games</th>
                  <th>W / D / L</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {openings.map((o) => (
                  <tr
                    key={o.name}
                    className={demo?.name === o.name ? 'sel' : ''}
                    onClick={() => startDemo(o.name)}
                  >
                    <td>{o.name}</td>
                    <td>{o.n}</td>
                    <td>
                      <ResultBar s={o} />
                    </td>
                    <td className={score(o) >= 0.5 ? 'win' : 'loss'}>{pct(o)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{myTurn ? 'What you played here' : 'What your opponents played here'}</h3>
          <p className="muted">
            From the position on the board. Click a move to follow it. “Score” is your win rate
            (a draw counts as half).
          </p>
          {moves.length === 0 && <p className="muted">No games continue from this position.</p>}
          {moves.length > 0 && (
            <table className="games">
              <thead>
                <tr>
                  <th>Move</th>
                  <th>Times</th>
                  <th>W / D / L</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.san} onClick={() => go([...path, m.san])}>
                    <td>
                      <strong>{m.san}</strong>
                    </td>
                    <td>{m.n}×</td>
                    <td>
                      <ResultBar s={m} />
                    </td>
                    <td className={score(m) >= 0.5 ? 'win' : 'loss'}>{pct(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {node && node.gameIds.length > 0 && (
            <>
              <h3>Your games through this position</h3>
              <div className="moves">
                {node.gameIds.slice(0, 12).map((id) => {
                  const g = all.find((x) => x.id === id)
                  return (
                    g && (
                      <button key={id} className="mv" onClick={() => onOpenGame(id)}>
                        <span className={g.outcome}>{g.outcome[0].toUpperCase()}</span> vs {g.opponent}
                      </button>
                    )
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <h3>Where you lose most</h3>
      <p className="muted">
        Lines you reached at least 4 times where you scored under 40%. Good places to study. Click
        one to see it on the board.
      </p>
      {problems.length === 0 && <p className="muted">None found.</p>}
      {problems.length > 0 && (
        <table className="games">
          <thead>
            <tr>
              <th>Line</th>
              <th>Games</th>
              <th>W / D / L</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr
                key={p.node.key}
                onClick={() => {
                  go(p.path)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <td>
                  {formatPath(p.path)}
                  {book && <div className="muted">{lookupPath(book, p.path)?.name ?? ''}</div>}
                </td>
                <td>{p.node.n}</td>
                <td>
                  <ResultBar s={p.node} />
                </td>
                <td className="loss">{pct(p.node)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
