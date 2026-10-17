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

export function formatSync(ts: string | null): string {
  if (!ts) return 'Never synced'
  const d = new Date(Number(ts))
  return `Synced ${d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`
}

/** chess.com sync state shared by the header button and the settings panel. */
export function useSync(user: string, onSynced: () => void) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [lastSync, setLastSync] = useState(read(SYNC_KEY))
  const [auto, setAutoState] = useState(read(AUTO_KEY) === '1')

  const setAuto = (on: boolean) => {
    setAutoState(on)
    write(AUTO_KEY, on ? '1' : '0')
  }

  /** `full` downloads the whole history again instead of only the recent months. */
  const run = async (full: boolean) => {
    const u = user.trim()
    if (!u || busy) return
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

  return { busy, status, lastSync, auto, setAuto, run }
}
