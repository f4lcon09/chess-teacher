import type { PositionEval } from '../types'

const MATE_CP = 10000

/** Thin UCI wrapper around the Stockfish web worker. Requests run one at a time. */
export class Engine {
  private worker: Worker
  private ready: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()

  constructor() {
    this.worker = new Worker(
      `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`,
    )
    this.ready = this.send(['uci'], (l) => l === 'uciok').then(() =>
      this.send(['isready'], (l) => l === 'readyok').then(() => undefined),
    )
  }

  private send(cmds: string[], isDone: (line: string) => boolean) {
    return new Promise<string[]>((resolve) => {
      const lines: string[] = []
      const onMsg = (ev: MessageEvent) => {
        const line = String(ev.data)
        lines.push(line)
        if (isDone(line)) {
          this.worker.removeEventListener('message', onMsg)
          resolve(lines)
        }
      }
      this.worker.addEventListener('message', onMsg)
      for (const c of cmds) this.worker.postMessage(c)
    })
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.ready).then(job)
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Evaluate a position; the result is from White's point of view. */
  evaluate(fen: string, depth: number): Promise<PositionEval> {
    return this.enqueue(async () => {
      const lines = await this.send(
        ['ucinewgame', `position fen ${fen}`, `go depth ${depth}`],
        (l) => l.startsWith('bestmove'),
      )
      const whiteToMove = fen.split(' ')[1] === 'w'
      const sign = whiteToMove ? 1 : -1
      let cp = 0
      let mate: number | null = null
      for (const l of lines) {
        const m = l.match(/ score (cp|mate) (-?\d+)/)
        if (!m || l.includes('lowerbound') || l.includes('upperbound')) continue
        const v = Number(m[2]) * sign
        if (m[1] === 'cp') {
          cp = v
          mate = null
        } else {
          mate = v
          cp = v > 0 ? MATE_CP - v : -MATE_CP - v
        }
      }
      const best = lines.at(-1)?.match(/^bestmove (\S+)/)?.[1] ?? null
      return { cp, mate, best: best === '(none)' ? null : best }
    })
  }

  terminate() {
    this.worker.terminate()
  }
}

let shared: Engine | null = null
export function getEngine(): Engine {
  return (shared ??= new Engine())
}
