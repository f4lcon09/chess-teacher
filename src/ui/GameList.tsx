import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { GameRecord } from '../types'

interface Props {
  version: number
  onOpen: (id: string) => void
}

const OUTCOME_LABEL = { win: 'Win', loss: 'Loss', draw: 'Draw' } as const

export function GameList({ version, onOpen }: Props) {
  const [games, setGames] = useState<GameRecord[]>([])
  const [analyzed, setAnalyzed] = useState<Set<string>>(new Set())
  const [timeClass, setTimeClass] = useState('all')
  const [color, setColor] = useState('all')

  useEffect(() => {
    void (async () => {
      setGames(await db.games.orderBy('endTime').reverse().toArray())
      setAnalyzed(new Set((await db.analyses.toCollection().primaryKeys()) as string[]))
    })()
  }, [version])

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
        <select value={timeClass} onChange={(e) => setTimeClass(e.target.value)}>
          <option value="all">All time classes</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="daily">Daily</option>
          <option value="bot">Bot games</option>
          <option value="local">Local games</option>
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
