import { useState } from 'react'
import { importGames } from '../chesscom/api'
import { db } from '../db/db'
import { analyzeGame } from '../analysis/analyzeGame'

const SYNC_KEY = 'chess-teacher:lastSync'
const AUTO_KEY = 'chess-teacher:autoAnalyze'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

function formatSync(ts: string | null): string {
  if (!ts) return 'Never synced'
  return `Last sync: ${new Date(Number(ts)).toLocaleString()}`
}

interface Props {
  user: string
  setUser: (u: string) => void
  onSynced: () => void
}

export function SyncBar({ user, setUser, onSynced }: Props) {
  const [name, setName] = useState(user)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [lastSync, setLastSync] = useState(read(SYNC_KEY))
  const [auto, setAuto] = useState(read(AUTO_KEY) === '1')

  const run = async (full: boolean) => {
    const u = name.trim()
    if (!u || busy) return
    setUser(u)
    setBusy(true)
    try {
      const added = await importGames(u, (d, t) => setStatus(`Downloading month ${d}/${t}…`), full)
      const now = String(Date.now())
      write(SYNC_KEY, now)
      setLastSync(now)
      onSynced()
      setStatus(`${added.length} new game${added.length === 1 ? '' : 's'}`)
      if (auto && added.length) {
        const games = (await db.games.bulkGet(added))
          .filter((g) => g !== undefined)
          .sort((a, b) => b.endTime - a.endTime)
        for (let i = 0; i < games.length; i++) {
          setStatus(`${added.length} new games. Analyzing ${i + 1}/${games.length}…`)
          await analyzeGame(games[i])
          onSynced()
        }
        setStatus(`${added.length} new games, all analyzed`)
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bar">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="chess.com username"
        onKeyDown={(e) => e.key === 'Enter' && void run(false)}
      />
      <button onClick={() => void run(false)} disabled={busy}>
        {busy ? 'Syncing…' : 'Sync chess.com'}
      </button>
      <button onClick={() => void run(true)} disabled={busy} title="Download the whole history again">
        Re-sync everything
      </button>
      <label className="muted">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked)
            write(AUTO_KEY, e.target.checked ? '1' : '0')
          }}
        />{' '}
        Analyze new games
      </label>
      <span className="muted">{status || formatSync(lastSync)}</span>
    </div>
  )
}
