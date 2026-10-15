import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { db } from '../db/db'
import { getEngine } from '../engine/engine'
import { loadBook, lookupPath } from '../openings/book'
import { playSound, setSoundEnabled, soundEnabled } from '../sound'
import type { GameRecord, Outcome, Side } from '../types'

type ColorChoice = Side | 'random'

interface Level {
  id: string
  name: string
  skill: number // Stockfish "Skill Level", 0..20
  depth: number // search depth
  randomChance: number // chance of playing a random legal move instead of the engine's
}

// First guesses, to be tuned by playing against them.
const LEVELS: Level[] = [
  { id: 'random', name: 'Random', skill: 0, depth: 1, randomChance: 1 },
  { id: 'beginner', name: 'Beginner', skill: 0, depth: 1, randomChance: 0.45 },
  { id: 'easy', name: 'Easy', skill: 0, depth: 2, randomChance: 0.25 },
  { id: 'medium', name: 'Medium', skill: 3, depth: 4, randomChance: 0.12 },
  { id: 'hard', name: 'Hard', skill: 8, depth: 6, randomChance: 0.04 },
  { id: 'expert', name: 'Expert', skill: 14, depth: 10, randomChance: 0 },
]

const BOT_DELAY_MS = 450

interface EndInfo {
  kind: 'win' | 'loss' | 'draw'
  title: string
  text: string
  gameId: string | null
}

function botName(level: Level): string {
  return level.id === 'random' ? 'Random bot' : `Stockfish (${level.name})`
}

/** Finished game -> record stored next to the chess.com games, so it can be analyzed. */
async function saveGame(
  chess: Chess,
  color: Side,
  outcome: Outcome,
  resultDetail: string,
  opponent: string,
): Promise<string | null> {
  const history = chess.history()
  if (history.length === 0) return null
  const book = await loadBook()
  const info = lookupPath(book, history)
  const now = Date.now()
  const record: GameRecord = {
    id: `local:${now}`,
    pgn: chess.pgn(),
    endTime: Math.floor(now / 1000),
    timeClass: 'bot',
    timeControl: '-',
    rated: false,
    color,
    outcome,
    resultDetail,
    userRating: 0,
    opponent,
    opponentRating: 0,
    openingName: info?.name ?? 'Unknown opening',
    eco: info?.eco ?? '',
  }
  await db.games.add(record)
  return record.id
}

interface Props {
  onSaved: () => void
  onOpenGame: (id: string) => void
}

export function PlayPage({ onSaved, onOpenGame }: Props) {
  const chess = useRef(new Chess())
  const epoch = useRef(0) // bumped whenever pending bot moves must be discarded
  const flashTimer = useRef<number | undefined>(undefined)
  const [choice, setChoice] = useState<ColorChoice>('random')
  const [levelId, setLevelId] = useState('easy')
  const [gameLevel, setGameLevel] = useState<Level>(LEVELS[2])
  const [color, setColor] = useState<Side | null>(null) // null until a game starts
  const [fen, setFen] = useState(() => new Chess().fen())
  const [result, setResult] = useState<string | null>(null)
  const [end, setEnd] = useState<EndInfo | null>(null)
  const [popup, setPopup] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [sans, setSans] = useState<string[]>([])
  const [sound, setSound] = useState(soundEnabled)

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
    (side: Side, outcome: Outcome, detail: string, title: string, text: string, level: Level) => {
      const kind = outcome
      setResult(`${title} ${text}`)
      setEnd({ kind, title, text, gameId: null })
      setPopup(true)
      playSound(kind)
      void saveGame(chess.current, side, outcome, detail, botName(level)).then((id) => {
        setEnd((e) => (e ? { ...e, gameId: id } : e))
        onSaved()
      })
    },
    [onSaved],
  )

  /** Ends the game if it is over; returns true when it was. */
  const checkEnd = useCallback(
    (side: Side, level: Level): boolean => {
      const c = chess.current
      if (!c.isGameOver()) return false
      if (c.isCheckmate()) {
        const userLost = c.turn() === (side === 'white' ? 'w' : 'b')
        finish(
          side,
          userLost ? 'loss' : 'win',
          userLost ? 'checkmated' : 'checkmate',
          'Checkmate!',
          userLost ? 'You lost.' : 'You won!',
          level,
        )
      } else {
        const detail = c.isStalemate()
          ? 'stalemate'
          : c.isThreefoldRepetition()
            ? 'repetition'
            : c.isInsufficientMaterial()
              ? 'insufficient'
              : '50move'
        finish(side, 'draw', detail, 'Draw', `by ${detail}.`, level)
      }
      return true
    },
    [finish],
  )

  /** After any move: refresh the view, then end the game or play the matching sound. */
  const afterMove = useCallback(
    (m: Move, side: Side, level: Level): boolean => {
      sync()
      if (checkEnd(side, level)) return true
      if (m.san.includes('+')) {
        playSound('check')
        showFlash('Check!')
      } else {
        playSound(m.captured ? 'capture' : 'move')
      }
      return false
    },
    [sync, checkEnd, showFlash],
  )

  const scheduleBot = useCallback(
    async (side: Side, level: Level) => {
      const mine = epoch.current
      const c = chess.current
      const pause = new Promise((r) => window.setTimeout(r, BOT_DELAY_MS))
      let uci: string | null = null
      if (Math.random() >= level.randomChance) {
        try {
          uci = await getEngine().pickMove(c.fen(), level.skill, level.depth)
        } catch {
          uci = null
        }
      }
      await pause
      if (epoch.current !== mine) return // new game, undo or resign happened meanwhile
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
      afterMove(m, side, level)
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

  const start = () => {
    epoch.current++
    const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]
    const side: Side = choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice
    chess.current = new Chess()
    setGameLevel(level)
    setColor(side)
    sync()
    setResult(null)
    setEnd(null)
    setPopup(false)
    setFlash(null)
    setSelected(null)
    if (side === 'black') void scheduleBot(side, level)
  }

  const userLetter = color === 'white' ? 'w' : 'b'
  const myTurn = color !== null && result === null && fen.split(' ')[1] === userLetter

  const tryMove = (from: string, to: string): boolean => {
    if (!color || !myTurn) return false
    let m: Move
    try {
      m = chess.current.move({ from, to, promotion: 'q' })
    } catch {
      return false
    }
    setSelected(null)
    if (!afterMove(m, color, gameLevel)) void scheduleBot(color, gameLevel)
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
    if (!myTurn) return
    const mine = piece?.pieceType[0] === userLetter
    if (selected && selected !== square && tryMove(selected, square)) return
    setSelected(mine && selected !== square ? square : null)
  }

  const targets: Record<string, React.CSSProperties> = {}
  if (selected && myTurn) {
    targets[selected] = { background: 'rgba(224,160,48,0.55)' }
    for (const m of new Chess(fen).moves({ square: selected as Square, verbose: true }))
      targets[m.to] = { background: 'radial-gradient(circle, rgba(58,166,85,0.6) 22%, transparent 25%)' }
  }

  const resign = () => {
    if (!color || result) return
    epoch.current++
    finish(color, 'loss', 'resigned', 'Resigned', 'You lost.', gameLevel)
  }

  const undo = () => {
    const c = chess.current
    if (!color || result || c.turn() !== userLetter || c.history().length < 2) return
    epoch.current++
    c.undo()
    c.undo()
    sync()
    if (c.turn() !== userLetter) void scheduleBot(color, gameLevel)
  }

  const toggleSound = (on: boolean) => {
    setSound(on)
    setSoundEnabled(on)
  }

  const status = !color
    ? 'Pick a color and a level, then start a game.'
    : (result ??
      (myTurn
        ? `Your move (${color})${new Chess(fen).inCheck() ? ' — check!' : ''}`
        : 'Bot is thinking…'))

  const selectedLevel = LEVELS.find((l) => l.id === levelId) ?? LEVELS[2]

  return (
    <div>
      <div className="bar">
        <select value={choice} onChange={(e) => setChoice(e.target.value as ColorChoice)}>
          <option value="random">Random color</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <select value={levelId} onChange={(e) => setLevelId(e.target.value)} aria-label="Bot level">
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              Level: {l.name}
            </option>
          ))}
        </select>
        <button onClick={start}>New game vs {botName(selectedLevel)}</button>
        <button onClick={undo} disabled={!color || !!result}>
          Undo
        </button>
        <button onClick={resign} disabled={!color || !!result}>
          Resign
        </button>
        <label className="muted">
          <input type="checkbox" checked={sound} onChange={(e) => toggleSound(e.target.checked)} /> Sound
        </label>
      </div>
      <div className="review">
        <div className="boardCol">
          <div className="boardWrap">
            <Chessboard
              options={{
                position: fen,
                boardOrientation: color ?? 'white',
                allowDragging: myTurn,
                canDragPiece: ({ piece }) => piece.pieceType[0] === userLetter,
                onPieceDrop: onDrop,
                onSquareClick,
                squareStyles: targets,
              }}
            />
            {flash && <div className="flash">{flash}</div>}
          </div>
        </div>
        <div className="sideCol">
          <h3>{status}</h3>
          {color && (
            <p className="muted">
              You play {color} against {botName(gameLevel)}. Finished games are saved in your Games
              list under "Bot games".
            </p>
          )}
          <div className="movelist">
            {sans.length === 0 && <span className="muted">No moves yet.</span>}
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
