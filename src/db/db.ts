import Dexie, { type EntityTable } from 'dexie'
import { botEloByName } from '../bots'
import type { GameAnalysis, GameRecord } from '../types'

export const db = new Dexie('chess-teacher') as Dexie & {
  games: EntityTable<GameRecord, 'id'>
  analyses: EntityTable<GameAnalysis, 'gameId'>
}

const SCHEMA = {
  games: 'id, endTime, timeClass, color, outcome, eco',
  analyses: 'gameId',
}

db.version(1).stores(SCHEMA)

// v2: bot games used to be saved with rating 0; fill in the bots' estimated ratings.
db.version(2)
  .stores(SCHEMA)
  .upgrade((tx) =>
    tx
      .table<GameRecord>('games')
      .toCollection()
      .modify((g) => {
        const elo = botEloByName(g.opponent)
        if (elo && !g.opponentRating) g.opponentRating = elo
      }),
  )
