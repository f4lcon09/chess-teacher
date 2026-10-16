import type { MoveClass } from '../types'
import { CLS_BADGE, CLS_LABEL, type ClassCounts } from './moveClassInfo'

export function ClassChips({ counts }: { counts: ClassCounts }) {
  return (
    <div className="chips">
      {(Object.keys(CLS_LABEL) as MoveClass[]).map((c) => (
        <span key={c} className="chip">
          <i className={`dot ${c}`}>{CLS_BADGE[c]}</i>
          <strong>{counts[c]}</strong> {CLS_LABEL[c]}
        </span>
      ))}
    </div>
  )
}
