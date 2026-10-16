import { useEffect, useState } from 'react'
import {
  BOARD_THEMES,
  BoardThemeContext,
  loadBoardTheme,
  saveBoardTheme,
  type BoardThemeId,
} from './ui/boardTheme'
import { GameList } from './ui/GameList'
import { OpeningsPage } from './ui/OpeningsPage'
import { PlayPage } from './ui/PlayPage'
import { ReviewPage } from './ui/ReviewPage'
import { SyncBar } from './ui/SyncBar'

const KEY = 'chess-teacher:user'

function loadUser() {
  try {
    return localStorage.getItem(KEY) ?? 'vinicios2005'
  } catch {
    return 'vinicios2005'
  }
}

type Tab = 'games' | 'openings' | 'play'
type Theme = 'system' | 'light' | 'dark'

const THEME_KEY = 'chess-teacher:theme'

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

export default function App() {
  const [theme, setThemeState] = useState<Theme>(loadTheme)

  // 'system' leaves data-theme unset so the prefers-color-scheme media query decides.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.dataset.theme = theme
  }, [theme])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(THEME_KEY, t)
    } catch {
      /* storage unavailable */
    }
  }

  const [user, setUserState] = useState(loadUser)
  const [tab, setTab] = useState<Tab>('games')
  const [openId, setOpenId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const setUser = (u: string) => {
    setUserState(u)
    try {
      localStorage.setItem(KEY, u)
    } catch {
      /* storage unavailable */
    }
  }

  const [boardTheme, setBoardThemeState] = useState<BoardThemeId>(loadBoardTheme)
  const setBoardTheme = (id: BoardThemeId) => {
    setBoardThemeState(id)
    saveBoardTheme(id)
  }

  return (
    <BoardThemeContext.Provider value={boardTheme}>
    <main>
      <div className="head">
        <h1>Chess Teacher</h1>
        <div className="bar">
          <select
            value={boardTheme}
            onChange={(e) => setBoardTheme(e.target.value as BoardThemeId)}
            aria-label="Board colors"
          >
            {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => (
              <option key={id} value={id}>
                Board: {BOARD_THEMES[id].name}
              </option>
            ))}
          </select>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} aria-label="Theme">
            <option value="system">Theme: System</option>
            <option value="light">Theme: Light</option>
            <option value="dark">Theme: Dark</option>
          </select>
        </div>
      </div>
      <SyncBar user={user} setUser={setUser} onSynced={() => setVersion((v) => v + 1)} />
      {openId ? (
        <ReviewPage id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <>
          <div className="tabs">
            <button className={tab === 'games' ? 'on' : ''} onClick={() => setTab('games')}>
              Games
            </button>
            <button className={tab === 'openings' ? 'on' : ''} onClick={() => setTab('openings')}>
              Openings
            </button>
            <button className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>
              Play
            </button>
          </div>
          {tab === 'games' && <GameList version={version} onOpen={setOpenId} />}
          {tab === 'openings' && <OpeningsPage version={version} onOpenGame={setOpenId} />}
          {tab === 'play' && <PlayPage onSaved={() => setVersion((v) => v + 1)} onOpenGame={setOpenId} />}
        </>
      )}
    </main>
    </BoardThemeContext.Provider>
  )
}
