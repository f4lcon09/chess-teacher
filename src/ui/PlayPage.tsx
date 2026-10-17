import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { db } from '../db/db'
import { LEVELS, botName, type Level } from '../bots'
import { getEngine } from '../engine/engine'
import { loadBook, lookupPath } from '../openings/book'
import { playSound, setSoundEnabled, soundEnabled } from '../sound'
import { analyzeGame } from '../analysis/analyzeGame'
import {
  ALL_TIME_CONTROLS,
  TIME_CONTROL_GROUPS,
  formatClock,
  timeControlString,
  type TimeControl,
} from '../timeControl'
import type { GameRecord, Outcome, Side } from '../types'
import { useBoardStyles } from './boardTheme'
import { ClassChips } from './moveClass'
import { countClasses, type ClassCounts } from './moveClassInfo'

type ColorChoice = Side | 'random'
type Opponent = 'bot' | 'local'

const BOT_DELAY_MS = 450

/** Settings of the running game. `side` is the player the saved result is relative to. */
interface Cfg {
  local: boolean
  level: Level
  side: Side
  tc: TimeControl | null
}

interface EndRow {
  label: string
  counts: ClassCounts
  accuracy: number
}

interface EndInfo {
  kind: 'win' | 'loss' | 'draw'
  title: string
  text: string
  gameId: string | null
  analyzing: boolean
  rows: EndRow[]
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
const other = (s: Side): Side => (s === 'white' ? 'black' : 'white')

/** Finished game -> record stored next to the chess.com games, so it can be analyzed. */
async function saveGame(
  chess: Chess,
  cfg: Cfg,
  outcome: Outcome,
  resultDetail: string,
): Promise<GameRecord | null> {
  const history = chess.history()
  if (history.length === 0) return null
  const book = await loadBook()
  const info = lookupPath(book, history)
  const now = Date.now()
  const record: GameRecord = {
    id: `local:${now}`,
    pgn: chess.pgn(),
    endTime: Math.floor(now / 1000),
    timeClass: cfg.local ? 'local' : 'bot',
    timeControl: timeControlString(cfg.tc),
    rated: false,
    color: cfg.side,
    outcome,
    resultDetail,
    userRating: 0,
    opponent: cfg.local ? 'Local player' : botName(cfg.level),
    opponentRating: cfg.local ? 0 : cfg.level.elo,
    openingName: info?.name ?? 'Unknown opening',
    eco: info?.eco ?? '',
  }
  await db.games.add(record)
  return record
}

function PlayerBar({
  label,
  ms,
  active,
  clock,
}: {
  label: string
  ms: number
  active: boolean
  clock: boolean
}) {
  return (
    <div className={`pbar ${active ? 'active' : ''} ${clock && ms < 10_000 ? 'low' : ''}`}>
      <span>{label}</span>
      {clock && <span className="clock">{formatClock(ms)}</span>}
    </div>
  )
}

interface Props {
  onSaved: () => void
  onOpenGame: (id: string) => void
}

export function PlayPage({ onSaved, onOpenGame }: Props) {
  const boardStyles = useBoardStyles()
  const chess = useRef(new Chess())
  const epoch = useRef(0) // bumped whenever pending bot moves must be discarded
  const flashTimer = useRef<number | undefined>(undefined)

  // Setup choices
  const [opponent, setOpponent] = useState<Opponent>('bot')
  const [choice, setChoice] = useState<ColorChoice>('random')
  const [levelId, setLevelId] = useState('easy')
  const [tcId, setTcId] = useState('none')
  const [custom, setCustom] = useState({ min: '5', sec: '0', inc: '0' })
  const [flip, setFlip] = useState(false)

  // Running game
  const [game, setGame] = useState<Cfg | null>(null)
  const cfgRef = useRef<Cfg | null>(null)
  const [fen, setFen] = useState(() => new Chess().fen())
  const [sans, setSans] = useState<string[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [end, setEnd] = useState<EndInfo | null>(null)
  const [popup, setPopup] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [sound, setSound] = useState(soundEnabled)

  // Clocks: the ref is the source of truth, the state only feeds rendering.
  const clk = useRef({ white: 0, black: 0, running: null as Side | null, last: 0 })
  const [clockView, setClockView] = useState({ white: 0, black: 0 })
  const [running, setRunning] = useState<Side | null>(null)

  const publishClocks = useCallback(() => {
    setClockView({ white: clk.current.white, black: clk.current.black })
    setRunning(clk.current.running)
  }, [])

  const stopClocks = useCallback(() => {
    clk.current.running = null
    setRunning(null)
  }, [])

  /** Mirrors the chess.js game (kept in a ref) into render state. */
  const sync = useCallback(() => {
    setFen(chess.current.fen())
    setSans(chess.current.history())
  }, [])

  const showFlash = useCallback((text: string) => {
    window.clearTimeout(flashTimer.current)
    setFlash(text)
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400)
  }, [])

  const finish = useCallback(
    (cfg: Cfg, outcome: Outcome, detail: string, title: string, text: string) => {
      stopClocks()
      setResult(`${title} ${text}`)
      setEnd({ kind: outcome, title, text, gameId: null, analyzing: false, rows: [] })
      setPopup(true)
      playSound(outcome)
      void saveGame(chess.current, cfg, outcome, detail).then(async (rec) => {
        if (!rec) return
        // Updates only apply while the popup still belongs to this game.
        const patch = (p: Partial<EndInfo>) =>
          setEnd((e) => (e && (e.gameId === null || e.gameId === rec.id) ? { ...e, ...p } : e))
        patch({ gameId: rec.id, analyzing: true })
        onSaved()
        try {
          const a = await analyzeGame(rec)
          const row = (label: string, side: Side): EndRow => ({
            label,
            counts: countClasses(a.moves, side),
            accuracy: a.accuracy[side],
          })
          patch({
            gameId: rec.id,
            analyzing: false,
            rows: cfg.local ? [row('White', 'white'), row('Black', 'black')] : [row('You', cfg.side)],
          })
          onSaved()
        } catch {
          patch({ analyzing: false })
        }
      })
    },
    [onSaved, stopClocks],
  )

  /** Ends the game because `loser` lost (resignation, timeout, checkmate). */
  const endWithLoser = useCallback(
    (cfg: Cfg, loser: Side, detail: string, title: string) => {
      epoch.current++
      const lost = loser === cfg.side
      const text = cfg.local ? `${cap(other(loser))} wins.` : lost ? 'You lost.' : 'You won!'
      finish(cfg, lost ? 'loss' : 'win', detail, title, text)
    },
    [finish],
  )

  /** Ends the game if it is over on the board; returns true when it was. */
  const checkEnd = useCallback(
    (cfg: Cfg): boolean => {
      const c = chess.current
      if (!c.isGameOver()) return false
      if (c.isCheckmate()) {
        const loser: Side = c.turn() === 'w' ? 'white' : 'black'
        endWithLoser(cfg, loser, loser === cfg.side ? 'checkmated' : 'checkmate', 'Checkmate!')
      } else {
        const detail = c.isStalemate()
          ? 'stalemate'
          : c.isThreefoldRepetition()
            ? 'repetition'
            : c.isInsufficientMaterial()
              ? 'insufficient'
              : '50move'
        finish(cfg, 'draw', detail, 'Draw', `by ${detail}.`)
      }
      return true
    },
    [finish, endWithLoser],
  )

  /** Passes the clock to the opponent of `mover` after a move. */
  const switchClock = useCallback(
    (mover: Side) => {
      const cfg = cfgRef.current
      const c = clk.current
      if (!cfg?.tc) return
      const now = performance.now()
      if (c.running) c[c.running] -= now - c.last
      // White's first move starts the clocks; increments apply once they are running.
      if (chess.current.history().length > 1) c[mover] += cfg.tc.inc * 1000
      c.running = other(mover)
      c.last = now
      publishClocks()
    },
    [publishClocks],
  )

  /** After undo: the side to move gets the clock back (if the clocks had started). */
  const resumeClock = useCallback(() => {
    const cfg = cfgRef.current
    const c = clk.current
    if (!cfg?.tc) return
    const now = performance.now()
    if (c.running) c[c.running] -= now - c.last
    c.running = chess.current.history().length > 0 ? (chess.current.turn() === 'w' ? 'white' : 'black') : null
    c.last = now
    publishClocks()
  }, [publishClocks])

  // Clock ticking
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      const c = clk.current
      const side = c.running
      const cfg = cfgRef.current
      if (!side || !cfg) return
      const now = performance.now()
      c[side] -= now - c.last
      c.last = now
      if (c[side] <= 0) {
        c[side] = 0
        publishClocks()
        endWithLoser(cfg, side, 'timeout', 'Time out')
      } else {
        setClockView({ white: c.white, black: c.black })
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [running, publishClocks, endWithLoser])

  /** After any move: refresh the view, then end the game or pass the clock and play a sound. */
  const afterMove = useCallback(
    (m: Move, cfg: Cfg): boolean => {
      sync()
      if (checkEnd(cfg)) return true
      switchClock(m.color === 'w' ? 'white' : 'black')
      if (m.san.includes('+')) {
        playSound('check')
        showFlash('Check!')
      } else {
        playSound(m.captured ? 'capture' : 'move')
      }
      return false
    },
    [sync, checkEnd, switchClock, showFlash],
  )

  const scheduleBot = useCallback(
    async (cfg: Cfg) => {
      const mine = epoch.current
      const c = chess.current
      const pause = new Promise((r) => window.setTimeout(r, BOT_DELAY_MS))
      let uci: string | null = null
      if (Math.random() >= cfg.level.randomChance) {
        try {
          uci = await getEngine().pickMove(c.fen(), cfg.level.skill, cfg.level.depth)
        } catch {
          uci = null
        }
      }
      await pause
      if (epoch.current !== mine) return // new game, undo, resign or timeout happened meanwhile
      let m: Move | null = null
      if (uci) {
        try {
          m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
        } catch {
          m = null
        }
      }
      if (!m) {
        const legal = c.moves({ verbose: true })
        if (!legal.length) return
        m = c.move(legal[Math.floor(Math.random() * legal.length)].san)
      }
      afterMove(m, cfg)
    },
    [afterMove],
  )

  useEffect(
    () => () => {
      epoch.current++
      window.clearTimeout(flashTimer.current)
    },
    [],
  )

  const pickTimeControl = (): TimeControl | null => {
    if (tcId === 'none') return null
    if (tcId === 'custom') {
      const base = Math.round(Number(custom.min) * 60 + Number(custom.sec))
      const inc = Math.max(0, Math.round(Number(custom.inc)))
      if (!(base > 0)) return null
      return { id: `${base}+${inc}`, label: 'Custom', base, inc }
    }
    return ALL_TIME_CONTROLS.find((t) => t.id === tcId) ?? null
  }

  const start = () => {
    epoch.current++
    const local = opponent === 'local'
    const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]
    const side: Side = local
      ? 'white'
      : choice === 'random'
        ? Math.random() < 0.5
          ? 'white'
          : 'black'
        : choice
    const cfg: Cfg = { local, level, side, tc: pickTimeControl() }
    cfgRef.current = cfg
    chess.current = new Chess()
    clk.current = {
      white: (cfg.tc?.base ?? 0) * 1000,
      black: (cfg.tc?.base ?? 0) * 1000,
      running: null,
      last: 0,
    }
    publishClocks()
    setGame(cfg)
    sync()
    setResult(null)
    setEnd(null)
    setPopup(false)
    setFlash(null)
    setSelected(null)
    if (!local && side === 'black') void scheduleBot(cfg)
  }

  const turn: Side = fen.split(' ')[1] === 'w' ? 'white' : 'black'
  const turnLetter = fen.split(' ')[1]
  const active = game !== null && result === null
  const canMove = active && (game.local || turn === game.side)
  const orientation: Side = !game ? 'white' : game.local ? (flip ? turn : 'white') : game.side

  const tryMove = (from: string, to: string): boolean => {
    if (!game || !canMove) return false
    let m: Move
    try {
      m = chess.current.move({ from, to, promotion: 'q' })
    } catch {
      return false
    }
    setSelected(null)
    if (!afterMove(m, game) && !game.local) void scheduleBot(game)
    return true
  }

  const onDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string
    targetSquare: string | null
  }): boolean => (targetSquare ? tryMove(sourceSquare, targetSquare) : false)

  /** Click-to-move: first click selects one of your pieces, second click moves it. */
  const onSquareClick = ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    if (!canMove) return
    const mine = piece?.pieceType[0] === turnLetter
    if (selected && selected !== square && tryMove(selected, square)) return
    setSelected(mine && selected !== square ? square : null)
  }

  const targets: Record<string, React.CSSProperties> = {}
  if (selected && canMove) {
    targets[selected] = { background: 'rgba(224,160,48,0.55)' }
    for (const m of new Chess(fen).moves({ square: selected as Square, verbose: true }))
      targets[m.to] = { background: 'radial-gradient(circle, rgba(58,166,85,0.6) 22%, transparent 25%)' }
  }

  const resign = () => {
    if (!game || result) return
    // Against the bot you resign; in local games the side to move does.
    endWithLoser(game, game.local ? turn : game.side, 'resigned', 'Resigned')
  }

  const undo = () => {
    const c = chess.current
    if (!game || result) return
    if (game.local) {
      if (c.history().length < 1) return
      epoch.current++
      c.undo()
    } else {
      if (turn !== game.side || c.history().length < 2) return
      epoch.current++
      c.undo()
      c.undo()
    }
    setSelected(null)
    sync()
    resumeClock()
    if (!game.local && c.turn() !== (game.side === 'white' ? 'w' : 'b')) void scheduleBot(game)
  }

  const toggleSound = (on: boolean) => {
    setSound(on)
    setSoundEnabled(on)
  }

  const nameOf = (side: Side): string =>
    !game ? cap(side) : game.local ? cap(side) : side === game.side ? 'You' : botName(game.level)

  const status = !game
    ? 'Pick an opponent and a time control, then start a game.'
    : (result ??
      (game.local
        ? `${cap(turn)} to move${new Chess(fen).inCheck() ? ' — check!' : ''}`
        : canMove
          ? `Your move (${game.side})${new Chess(fen).inCheck() ? ' — check!' : ''}`
          : 'Bot is thinking…'))

  const selectedLevel = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]
  const top = other(orientation)
  const hasClock = !!game?.tc

  return (
    <div>
      <div className="bar">
        <select value={opponent} onChange={(e) => setOpponent(e.target.value as Opponent)} aria-label="Opponent">
          <option value="bot">Opponent: Bot</option>
          <option value="local">Opponent: Local player</option>
        </select>
        {opponent === 'bot' && (
          <>
            <select value={choice} onChange={(e) => setChoice(e.target.value as ColorChoice)}>
              <option value="random">Random color</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
            <select value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Bot level">
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  Level: {l.name} (~{l.elo})
                </option>
              ))}
            </select>
          </>
        )}
        <select value={tcId} onChange={(e) => setTcId(e.target.value)} aria-label="Time control">
          <option value="none">No clock</option>
          {TIME_CONTROL_GROUPS.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {tcId === 'custom' && (
          <span className="custom">
            {(['min', 'sec', 'inc'] as const).map((k) => (
              <input
                key={k}
                type="number"
                min={0}
                value={custom[k]}
                onChange={(e) => setCustom({ ...custom, [k]: e.target.value })}
                aria-label={k === 'inc' ? 'Increment seconds' : k === 'min' ? 'Minutes' : 'Seconds'}
                placeholder={k === 'inc' ? 'incr.' : k}
              />
            ))}
          </span>
        )}
      </div>
      <div className="bar">
        <button onClick={start}>
          New game vs {opponent === 'local' ? 'local player' : botName(selectedLevel)}
        </button>
        <button onClick={undo} disabled={!active}>
          Undo
        </button>
        <button onClick={resign} disabled={!active}>
          Resign
        </button>
        {opponent === 'local' && (
          <label className="muted">
            <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Flip board each move
          </label>
        )}
        <label className="muted">
          <input type="checkbox" checked={sound} onChange={(e) => toggleSound(e.target.checked)} /> Sound
        </label>
      </div>
      <div className="review withbars">
        <div className="boardCol">
          <PlayerBar label={nameOf(top)} ms={clockView[top]} active={running === top} clock={hasClock} />
          <div className="boardWrap">
            <Chessboard
              options={{
                position: fen,
                boardOrientation: orientation,
                allowDragging: canMove,
                canDragPiece: ({ piece }) => piece.pieceType[0] === turnLetter,
                onPieceDrop: onDrop,
                onSquareClick,
                squareStyles: targets,
                ...boardStyles,
              }}
            />
            {flash && <div className="flash">{flash}</div>}
          </div>
          <PlayerBar
            label={nameOf(orientation)}
            ms={clockView[orientation]}
            active={running === orientation}
            clock={hasClock}
          />
        </div>
        <div className="sideCol">
          <h3>{status}</h3>
          {game && (
            <p className="muted">
              {game.local ? 'Local game' : `You play ${game.side} against ${botName(game.level)}`}
              {game.tc ? ` · ${game.tc.label}` : ''}. Finished games are saved in your Games list under "
              {game.local ? 'Local games' : 'Bot games'}".
            </p>
          )}
          <div className="movelist">
            {sans.length === 0 && <span className="muted empty">No moves yet.</span>}
            {Array.from({ length: Math.ceil(sans.length / 2) }, (_, i) => (
              <Fragment key={i}>
                <span className="no">{i + 1}.</span>
                <span>{sans[2 * i]}</span>
                <span>{sans[2 * i + 1] ?? ''}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      {end && popup && (
        <div className="modalBack" onClick={() => setPopup(false)}>
          <div className={`modal ${end.kind}`} onClick={(e) => e.stopPropagation()}>
            <h2>{end.title}</h2>
            <p>{end.text}</p>
            {end.analyzing && <p className="muted">Analyzing the moves…</p>}
            {end.rows.map((r) => (
              <div key={r.label}>
                <p className="muted">
                  {r.label} accuracy: {r.accuracy.toFixed(1)}%
                </p>
                <ClassChips counts={r.counts} />
              </div>
            ))}
            <div className="bar center">
              <button onClick={start}>New game</button>
              {end.gameId && <button onClick={() => onOpenGame(end.gameId!)}>Analyze game</button>}
              <button onClick={() => setPopup(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
