import { useState } from 'react'
import { BOARD_CHOICES, THEMES, THEME_IDS, type BoardChoice, type ThemeId } from './themes'

interface Props {
  user: string
  setUser: (u: string) => void
  sync: { busy: boolean; auto: boolean; setAuto: (on: boolean) => void; run: (full: boolean) => Promise<void> }
  theme: ThemeId
  setTheme: (t: ThemeId) => void
  board: BoardChoice
  setBoard: (b: BoardChoice) => void
  onClose: () => void
}

export function SettingsPanel({ user, setUser, sync, theme, setTheme, board, setBoard, onClose }: Props) {
  const [name, setName] = useState(user)

  return (
    <div className="popBack" onClick={onClose}>
      <div className="settings card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="settingsHead">
          <h3>Settings</h3>
          <button className="ghost" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Chess.com username</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && setUser(name.trim())}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && setUser(name.trim())}
            placeholder="your username"
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={sync.auto} onChange={(e) => sync.setAuto(e.target.checked)} />
          Analyze new games right after syncing
        </label>
        <button onClick={() => void sync.run(true)} disabled={sync.busy}>
          Download the whole history again
        </button>

        <h4>Theme</h4>
        <div className="swatches">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              className={`swatch ${id === theme ? 'on' : ''}`}
              onClick={() => setTheme(id)}
              aria-pressed={id === theme}
            >
              <span className="chipbar">
                {THEMES[id].swatch.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <strong>{THEMES[id].name}</strong>
              <span className="muted">{THEMES[id].blurb}</span>
            </button>
          ))}
        </div>

        <h4>Board colors</h4>
        <select value={board} onChange={(e) => setBoard(e.target.value as BoardChoice)} aria-label="Board colors">
          {(Object.keys(BOARD_CHOICES) as BoardChoice[]).map((id) => (
            <option key={id} value={id}>
              {BOARD_CHOICES[id].name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
