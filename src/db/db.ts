import Dexie, { type EntityTable } from 'dexie'
import type { GameAnalysis, GameRecord } from '../types'

export const db = new Dexie('chess-teacher') as Dexie & {
  games: EntityTable<GameRecord, 'id'>
  analyses: EntityTable<GameAnalysis, 'gameId'>
}

db.version(1).stores({
  games: 'id, endTime, timeClass, color, outcome, eco',
  analyses: 'gameId',
})
