// Usage: node scripts/build-openings.mjs <dir with a.tsv..e.tsv from lichess-org/chess-openings>
// Writes src/openings/book.json: { "<position key>": ["ECO", "Opening name"] }
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Chess } from 'chess.js'

const dir = process.argv[2]
if (!dir) throw new Error('Pass the directory with the TSV files')

const best = new Map() // key -> { len, eco, name }
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(join(dir, `${f}.tsv`), 'utf8').split('\n').slice(1)
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t')
    if (!pgn) continue
    const chess = new Chess()
    try {
      chess.loadPgn(pgn)
    } catch {
      continue
    }
    const key = chess.fen().split(' ').slice(0, 4).join(' ')
    const len = chess.history().length
    const cur = best.get(key)
    if (!cur || len > cur.len) best.set(key, { len, eco, name })
  }
}

const out = {}
for (const [key, v] of best) out[key] = [v.eco, v.name]
writeFileSync('src/openings/book.json', JSON.stringify(out))
console.log(`wrote ${best.size} positions`)
