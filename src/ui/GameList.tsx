import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import { importGames } from '../chesscom/api'
import type { GameRecord } from '../types'

interface Props {
  user: string
  setUser: (u: string) => void
  onOpen: (id: string) => void
}

const OUTCOME_LABEL = { win: 'Win', loss: 'Loss', draw: 'Draw' } as const

export function GameList({ user, setUser, onOpen }: Props) {
  const [games, setGames] = useState<GameRecord[]>([])
  const [analyzed, setAnalyzed] = useState<Set<string>>(new Set())
  const [name, setName] = useState(user)
  const [progress, setProgress] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [timeClass, setTimeClass] = useState('all')
  const [color, setColor] = useState('all')

  const reload = useCallback(async () => {
    setGames(await db.games.orderBy('endTime').reverse().toArray())
    setAnalyzed(new Set((await db.analyses.toCollection().primaryKeys()) as string[]))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const runImport = async () => {
    const u = name.trim()
    if (!u) return
    setUser(u)
    setBusy(true)
    try {
      const added = await importGames(u, (d, t) => setProgress(`Month ${d}/${t}`))
      setProgress(`Done: ${added} new games`)
      await reload()
    } catch (e) {
      setProgress(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const shown = useMemo(
    () =>
      games.filter(
        (g) =>
          (timeClass === 'all' || g.timeClass === timeClass) &&
          (color === 'all' || g.color === color),
      ),
    [games, timeClass, color],
  )

  return (
    <div>
      <div className="bar">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="chess.com username"
          onKeyDown={(e) => e.key === 'Enter' && void runImport()}
        />
        <button onClick={() => void runImport()} disabled={busy}>
          {busy ? 'Importing…' : 'Import games'}
        </button>
        <span className="muted">{progress}</span>
      </div>
      <div className="bar">
        <select value={timeClass} onChange={(e) => setTimeClass(e.target.value)}>
          <option value="all">All time classes</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="daily">Daily</option>
        </select>
        <select value={color} onChange={(e) => setColor(e.target.value)}>
          <option value="all">Both colors</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <span className="muted">{shown.length} games</span>
      </div>
      <table className="games">
        <thead>
          <tr>
            <th>Date</th>
            <th>Color</th>
            <th>Result</th>
            <th>Opponent</th>
            <th>Type</th>
            <th>Opening</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.slice(0, 300).map((g) => (
            <tr key={g.id} onClick={() => onOpen(g.id)}>
              <td>{new Date(g.endTime * 1000).toLocaleDateString()}</td>
              <td>{g.color}</td>
              <td className={g.outcome}>
                {OUTCOME_LABEL[g.outcome]} <span className="muted">({g.resultDetail})</span>
              </td>
              <td>
                {g.opponent} <span className="muted">{g.opponentRating}</span>
              </td>
              <td>{g.timeClass}</td>
              <td>{g.openingName}</td>
              <td>{analyzed.has(g.id) ? '✓' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
