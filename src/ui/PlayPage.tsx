import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { db } from '../db/db'
import { loadBook, lookupPath } from '../openings/book'
import type { GameRecord, Outcome, Side } from '../types'

type ColorChoice = Side | 'random'

const BOT_NAME = 'Random bot'
const BOT_DELAY_MS = 450

/** Finished game -> record stored next to the chess.com games, so it can be analyzed. */
async function saveGame(
  chess: Chess,
  color: Side,
  outcome: Outcome,
  resultDetail: string,
): Promise<void> {
  const history = chess.history()
  if (history.length === 0) return
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
    opponent: BOT_NAME,
    opponentRating: 0,
    openingName: info?.name ?? 'Unknown opening',
    eco: info?.eco ?? '',
  }
  await db.games.add(record)
}

interface Props {
  onSaved: () => void
}

export function PlayPage({ onSaved }: Props) {
  const chess = useRef(new Chess())
  const timer = useRef<number | undefined>(undefined)
  const [choice, setChoice] = useState<ColorChoice>('random')
  const [color, setColor] = useState<Side | null>(null) // null until a game starts
  const [fen, setFen] = useState(() => new Chess().fen())
  const [result, setResult] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [sans, setSans] = useState<string[]>([])

  /** Mirrors the chess.js game (kept in a ref) into render state. */
  const sync = useCallback(() => {
    setFen(chess.current.fen())
    setSans(chess.current.history())
  }, [])

  const finish = useCallback(
    (side: Side, outcome: Outcome, detail: string, text: string) => {
      setResult(text)
      void saveGame(chess.current, side, outcome, detail).then(onSaved)
    },
    [onSaved],
  )

  /** Ends the game if it is over; returns true when it was. */
  const checkEnd = useCallback(
    (side: Side): boolean => {
      const c = chess.current
      if (!c.isGameOver()) return false
      if (c.isCheckmate()) {
        const userLost = c.turn() === (side === 'white' ? 'w' : 'b')
        finish(
          side,
          userLost ? 'loss' : 'win',
          userLost ? 'checkmated' : 'checkmate',
          userLost ? 'Checkmate. You lost.' : 'Checkmate. You won!',
        )
      } else {
        const detail = c.isStalemate()
          ? 'stalemate'
          : c.isThreefoldRepetition()
            ? 'repetition'
            : c.isInsufficientMaterial()
              ? 'insufficient'
              : '50move'
        finish(side, 'draw', detail, `Draw by ${detail}.`)
      }
      return true
    },
    [finish],
  )

  const scheduleBot = useCallback(
    (side: Side) => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        const c = chess.current
        const moves = c.moves()
        if (!moves.length) return
        c.move(moves[Math.floor(Math.random() * moves.length)])
        sync()
        checkEnd(side)
      }, BOT_DELAY_MS)
    },
    [checkEnd, sync],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = () => {
    window.clearTimeout(timer.current)
    const side: Side = choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice
    chess.current = new Chess()
    setColor(side)
    sync()
    setResult(null)
    setSelected(null)
    if (side === 'black') scheduleBot(side)
  }

  const userLetter = color === 'white' ? 'w' : 'b'
  const myTurn = color !== null && result === null && fen.split(' ')[1] === userLetter

  const tryMove = (from: string, to: string): boolean => {
    if (!color || !myTurn) return false
    try {
      chess.current.move({ from, to, promotion: 'q' })
    } catch {
      return false
    }
    setSelected(null)
    sync()
    if (!checkEnd(color)) scheduleBot(color)
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
    window.clearTimeout(timer.current)
    finish(color, 'loss', 'resigned', 'You resigned.')
  }

  const undo = () => {
    const c = chess.current
    if (!color || result || c.turn() !== userLetter || c.history().length < 2) return
    c.undo()
    c.undo()
    sync()
  }

  const status = !color
    ? 'Pick a color and start a game.'
    : (result ??
      (myTurn
        ? `Your move (${color})${new Chess(fen).inCheck() ? ' — check!' : ''}`
        : 'Bot is thinking…'))

  return (
    <div>
      <div className="bar">
        <select value={choice} onChange={(e) => setChoice(e.target.value as ColorChoice)}>
          <option value="random">Random color</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <button onClick={start}>New game vs {BOT_NAME}</button>
        <button onClick={undo} disabled={!color || !!result}>
          Undo
        </button>
        <button onClick={resign} disabled={!color || !!result}>
          Resign
        </button>
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
          </div>
        </div>
        <div className="sideCol">
          <h3>{status}</h3>
          {color && (
            <p className="muted">
              You play {color}. The bot picks random legal moves. Finished games are saved in your
              Games list under "Bot games".
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
    </div>
  )
}
