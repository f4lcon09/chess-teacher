import { db } from '../db/db'
import type { GameRecord, Outcome, Side } from '../types'

const BASE = 'https://api.chess.com/pub/player'

interface RawPlayer {
  username: string
  rating: number
  result: string
}
interface RawGame {
  url: string
  pgn?: string
  end_time: number
  time_class: string
  time_control: string
  rated: boolean
  rules: string
  white: RawPlayer
  black: RawPlayer
}

const DRAWS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
])

function outcomeOf(result: string): Outcome {
  if (result === 'win') return 'win'
  return DRAWS.has(result) ? 'draw' : 'loss'
}

function header(pgn: string, tag: string): string {
  const m = pgn.match(new RegExp(String.raw`\[${tag} "([^"]*)"\]`))
  return m ? m[1] : ''
}

/** Chess.com opening URLs look like .../openings/Sicilian-Defense-Open-2.Nf3-d6 */
function openingFromUrl(url: string): string {
  const slug = url.split('/openings/')[1]
  if (!slug) return 'Unknown opening'
  const words: string[] = []
  for (const w of slug.split('-')) {
    if (/^\d+\.|^\d+\.\.\./.test(w)) break
    words.push(w)
  }
  return words.join(' ') || 'Unknown opening'
}

export function toRecord(raw: RawGame, user: string): GameRecord | null {
  if (raw.rules !== 'chess' || !raw.pgn) return null
  const isWhite = raw.white.username.toLowerCase() === user.toLowerCase()
  const me = isWhite ? raw.white : raw.black
  const opp = isWhite ? raw.black : raw.white
  const color: Side = isWhite ? 'white' : 'black'
  return {
    id: raw.url,
    pgn: raw.pgn,
    endTime: raw.end_time,
    timeClass: raw.time_class,
    timeControl: raw.time_control,
    rated: raw.rated,
    color,
    outcome: outcomeOf(me.result),
    resultDetail: me.result === 'win' ? opp.result : me.result,
    userRating: me.rating,
    opponent: opp.username,
    opponentRating: opp.rating,
    openingName: openingFromUrl(header(raw.pgn, 'ECOUrl')),
    eco: header(raw.pgn, 'ECO'),
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 404) throw new Error('User not found on chess.com')
  if (!res.ok) throw new Error(`chess.com responded ${res.status}`)
  return res.json() as Promise<T>
}

/** Archive urls end with /YYYY/MM; returns "YYYY/MM" for lexical comparison. */
function monthOf(archiveUrl: string): string {
  return archiveUrl.split('/').slice(-2).join('/')
}

/**
 * Downloads monthly archives, newest first, and stores new games.
 * Incremental by default: only months from the newest stored game onwards.
 * Returns the ids of the games that were added.
 */
export async function importGames(
  user: string,
  onProgress: (done: number, total: number) => void,
  full = false,
): Promise<string[]> {
  const { archives } = await getJson<{ archives: string[] }>(
    `${BASE}/${user.toLowerCase()}/games/archives`,
  )
  let urls = [...archives].reverse()
  if (!full) {
    // Only chess.com games count: locally played games must not move the cutoff.
    const latest = await db.games
      .orderBy('endTime')
      .reverse()
      .filter((g) => g.id.startsWith('https://'))
      .first()
    if (latest) {
      const d = new Date(latest.endTime * 1000)
      const since = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      urls = urls.filter((u) => monthOf(u) >= since)
    }
  }
  const added: string[] = []
  for (let i = 0; i < urls.length; i++) {
    onProgress(i, urls.length)
    const { games } = await getJson<{ games: RawGame[] }>(urls[i])
    const records = games
      .map((g) => toRecord(g, user))
      .filter((r): r is GameRecord => r !== null)
    const existing = await db.games.bulkGet(records.map((r) => r.id))
    const fresh = records.filter((_, idx) => !existing[idx])
    if (fresh.length) await db.games.bulkAdd(fresh)
    added.push(...fresh.map((r) => r.id))
  }
  onProgress(urls.length, urls.length)
  return added
}
