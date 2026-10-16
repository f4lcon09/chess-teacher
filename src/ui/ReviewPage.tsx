import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Chess } from 'chess.js'
import { db } from '../db/db'
import { analyzeGame } from '../analysis/analyzeGame'
import { winPct } from '../analysis/classify'
import type { GameAnalysis, GameRecord, MoveClass } from '../types'

const CLS_LABEL: Record<MoveClass, string> = {
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}
const CLS_BADGE: Record<MoveClass, string> = {
  best: '★',
  excellent: '!',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

export function ReviewPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [game, setGame] = useState<GameRecord | null>(null)
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null)
  const [ply, setPly] = useState(0)
  const [progress, setProgress] = useState<[number, number] | null>(null)

  useEffect(() => {
    void (async () => {
      setGame((await db.games.get(id)) ?? null)
      setAnalysis((await db.analyses.get(id)) ?? null)
      setPly(0)
    })()
  }, [id])

  const { fens, sans } = useMemo(() => {
    if (!game) return { fens: [] as string[], sans: [] as string[] }
    const c = new Chess()
    c.loadPgn(game.pgn)
    const h = c.history({ verbose: true })
    return {
      fens: [h[0]?.before ?? new Chess().fen(), ...h.map((m) => m.after)],
      sans: h.map((m) => m.san),
    }
  }, [game])

  // How many moves of each quality the user played.
  const counts = useMemo(() => {
    const out: Record<MoveClass, number> = {
      best: 0,
      excellent: 0,
      good: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
    }
    if (analysis && game) for (const m of analysis.moves) if (m.color === game.color) out[m.cls]++
    return out
  }, [analysis, game])

  const maxPly = fens.length - 1
  const go = useCallback((p: number) => setPly(Math.max(0, Math.min(maxPly, p))), [maxPly])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(ply - 1)
      if (e.key === 'ArrowRight') go(ply + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ply, go])

  const runAnalysis = async () => {
    if (!game) return
    setProgress([0, fens.length])
    try {
      setAnalysis(await analyzeGame(game, undefined, (d, t) => setProgress([d, t])))
    } finally {
      setProgress(null)
    }
  }

  if (!game) return <p>Loading…</p>

  const move = analysis?.moves[ply - 1]
  const arrows = []
  const squareStyles: Record<string, React.CSSProperties> = {}
  let badge: { left: string; top: string } | null = null
  if (move) {
    // Green arrow shows what the engine preferred when the move was not good enough.
    if (move.bestUci && move.bestUci !== move.uci && move.cls !== 'good' && move.cls !== 'excellent')
      arrows.push({ startSquare: move.bestUci.slice(0, 2), endSquare: move.bestUci.slice(2, 4), color: '#3aa655' })
    const from = move.uci.slice(0, 2)
    const to = move.uci.slice(2, 4)
    squareStyles[from] = { background: 'rgba(155, 199, 0, 0.41)' }
    squareStyles[to] = { background: `color-mix(in srgb, var(--${move.cls}) 55%, transparent)` }
    // Badge on the destination square's top-right corner (a square is 12.5% of the board).
    const file = to.charCodeAt(0) - 97
    const rank = Number(to[1]) - 1
    const col = game.color === 'white' ? file : 7 - file
    const row = game.color === 'white' ? 7 - rank : rank
    badge = { left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%` }
  }

  const chart = analysis?.evals.map((e, i) => ({ ply: i, win: winPct(e.cp) })) ?? []
  const myAcc = analysis?.accuracy[game.color]

  return (
    <div>
      <div className="bar">
        <button onClick={onBack}>← Games</button>
        <strong>
          {game.color === 'white' ? 'You' : game.opponent} vs {game.color === 'white' ? game.opponent : 'You'}
        </strong>
        <span className="muted">
          {game.openingName} · {game.timeClass}
        </span>
        {myAcc !== undefined && <span className="muted">Your accuracy: {myAcc.toFixed(1)}%</span>}
      </div>
      <div className="review">
        <div className="boardCol">
          <div className="boardWrap">
            <Chessboard
              options={{
                position: fens[ply],
                boardOrientation: game.color,
                allowDragging: false,
                arrows,
                squareStyles,
              }}
            />
            {move && badge && (
              <div className={`badge ${move.cls}`} style={badge} title={CLS_LABEL[move.cls]}>
                {CLS_BADGE[move.cls]}
              </div>
            )}
          </div>
          <div className="bar center">
            <button onClick={() => go(0)}>⏮</button>
            <button onClick={() => go(ply - 1)}>◀</button>
            <button onClick={() => go(ply + 1)}>▶</button>
            <button onClick={() => go(maxPly)}>⏭</button>
          </div>
          {analysis && (
            <div className="chart">
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart
                  data={chart}
                  onClick={(s) => {
                    const p = Number(s?.activeLabel)
                    if (!Number.isNaN(p)) go(p)
                  }}
                >
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(0)}% White`} labelFormatter={(l) => `Ply ${l}`} />
                  <ReferenceLine y={50} stroke="#888" />
                  <ReferenceLine x={ply} stroke="#e0a030" />
                  <Area dataKey="win" stroke="#bbb" fill="#ddd" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="sideCol">
          {!analysis && (
            <button onClick={() => void runAnalysis()} disabled={!!progress}>
              {progress ? `Analyzing ${progress[0]}/${progress[1]}…` : 'Analyze game'}
            </button>
          )}
          {move && (
            <div className={`note ${move.cls}`}>
              <strong>
                {Math.ceil(move.ply / 2)}
                {move.color === 'white' ? '.' : '...'} {move.san} — {CLS_LABEL[move.cls]}
              </strong>
              {move.explanation && <p>{move.explanation}</p>}
            </div>
          )}
          <div className="mtable">
            {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
              <Fragment key={i}>
                <span className="no">{i + 1}.</span>
                {[2 * i, 2 * i + 1].map((idx) => {
                  if (idx >= sans.length) return <span key={idx} />
                  const m = analysis?.moves[idx]
                  return (
                    <button
                      key={idx}
                      className={`cell ${m?.cls ?? ''} ${idx + 1 === ply ? 'sel' : ''}`}
                      onClick={() => go(idx + 1)}
                    >
                      {m && <i className={`dot ${m.cls}`}>{CLS_BADGE[m.cls]}</i>}
                      {sans[idx]}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
          {analysis && (
            <div className="chips">
              {(Object.keys(CLS_LABEL) as MoveClass[]).map((c) => (
                <span key={c} className="chip">
                  <i className={`dot ${c}`}>{CLS_BADGE[c]}</i>
                  <strong>{counts[c]}</strong> {CLS_LABEL[c]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
