import { useEffect, useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { db } from '../db/db'
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

function pct(s: Stats): string {
  return `${Math.round(score(s) * 100)}%`
}

function ResultBar({ s }: { s: Stats }) {
  const w = (x: number) => `${(x / Math.max(1, s.n)) * 100}%`
  return (
    <span className="rbar" title={`${s.w}W ${s.d}D ${s.l}L`}>
      <i style={{ width: w(s.w), background: 'var(--best)' }} />
      <i style={{ width: w(s.d), background: 'var(--muted)' }} />
      <i style={{ width: w(s.l), background: 'var(--blunder)' }} />
    </span>
  )
}

function formatPath(path: string[]): string {
  return path.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ')
}

interface Props {
  version: number
  onOpenGame: (id: string) => void
}

export function OpeningsPage({ version, onOpenGame }: Props) {
  const [all, setAll] = useState<GameRecord[]>([])
  const [color, setColor] = useState<Side>('white')
  const [filter, setFilter] = useState<Filter>('fast')
  const [path, setPath] = useState<string[]>([])

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
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 15)
  }, [games])

  const chess = useMemo(() => {
    const c = new Chess()
    for (const san of path) c.move(san)
    return c
  }, [path])
  const node = tree.get(posKey(chess.fen()))
  const moves = node ? [...node.moves.values()].sort((a, b) => b.n - a.n) : []
  const myTurn = (path.length % 2 === 0) === (color === 'white')

  const pick = (c: Side) => {
    setColor(c)
    setPath([])
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
            setPath([])
          }}
        >
          <option value="fast">Blitz + Rapid</option>
          <option value="all">All types</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
        </select>
        <span className="muted">{games.length} games</span>
      </div>

      <div className="review">
        <div className="boardCol">
          <div className="boardWrap">
            <Chessboard
              options={{ position: chess.fen(), boardOrientation: color, allowDragging: false }}
            />
          </div>
          <div className="bar center">
            <button onClick={() => setPath([])}>⏮</button>
            <button onClick={() => setPath(path.slice(0, -1))} disabled={!path.length}>
              ◀ Back
            </button>
          </div>
          <p className="muted center">{path.length ? formatPath(path) : 'Start position'}</p>
        </div>

        <div className="sideCol">
          <h3>{myTurn ? 'Your moves here' : 'Opponent replies here'}</h3>
          {moves.length === 0 && <p className="muted">No games continue from this position.</p>}
          <table className="games">
            <tbody>
              {moves.map((m) => (
                <tr key={m.san} onClick={() => setPath([...path, m.san])}>
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

          {node && node.gameIds.length > 0 && (
            <>
              <h3>Games on this line</h3>
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

      <h3>Problem positions</h3>
      <p className="muted">Reached at least 4 times with under 40% score.</p>
      {problems.length === 0 && <p className="muted">None found.</p>}
      <table className="games">
        <tbody>
          {problems.map((p) => (
            <tr key={p.node.key} onClick={() => setPath(p.path)}>
              <td>{formatPath(p.path)}</td>
              <td>{p.node.n} games</td>
              <td>
                <ResultBar s={p.node} />
              </td>
              <td className="loss">{pct(p.node)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Openings</h3>
      <table className="games">
        <thead>
          <tr>
            <th>Opening</th>
            <th>Games</th>
            <th />
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {openings.map((o) => (
            <tr key={o.name}>
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
  )
}
