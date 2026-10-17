export interface Level {
  id: string
  name: string
  skill: number // Stockfish "Skill Level", 0..20
  depth: number // search depth
  randomChance: number // chance of playing a random legal move instead of the engine's
  elo: number // rough estimate (chess.com-like scale), to be tuned from real results
}

// First guesses, to be tuned by playing against them.
export const LEVELS: Level[] = [
  { id: 'random', name: 'Random', skill: 0, depth: 1, randomChance: 1, elo: 100 },
  { id: 'beginner', name: 'Beginner', skill: 0, depth: 1, randomChance: 0.45, elo: 250 },
  { id: 'easy', name: 'Easy', skill: 1, depth: 3, randomChance: 0.15, elo: 500 },
  { id: 'medium', name: 'Medium', skill: 5, depth: 5, randomChance: 0.08, elo: 800 },
  { id: 'hard', name: 'Hard', skill: 8, depth: 6, randomChance: 0.04, elo: 1100 },
  { id: 'expert', name: 'Expert', skill: 14, depth: 10, randomChance: 0, elo: 1500 },
]

export function botName(level: Level): string {
  return level.id === 'random' ? 'Random bot' : `Stockfish (${level.name})`
}

/** Estimated rating of a saved bot opponent, by the name stored on the game. */
export function botEloByName(name: string): number | undefined {
  return LEVELS.find((l) => botName(l) === name)?.elo
}
