import { useEffect, useMemo, useState } from 'react'
import { BoardThemeContext } from './ui/boardTheme'
import { GameList } from './ui/GameList'
import { CrownIcon, SlidersIcon, SyncIcon } from './ui/icons'
import { OpeningsPage } from './ui/OpeningsPage'
import { PlayPage } from './ui/PlayPage'
import { ReviewPage } from './ui/ReviewPage'
import { SettingsPanel } from './ui/SettingsPanel'
import {
  boardColors,
  loadBoardChoice,
  loadTheme,
  saveBoardChoice,
  saveTheme,
  type BoardChoice,
  type ThemeId,
} from './ui/themes'
import { formatSync, useSync } from './ui/useSync'

const USER_KEY = 'chess-teacher:user'

function loadUser() {
  try {
    return localStorage.getItem(USER_KEY) ?? 'vinicios2005'
  } catch {
    return 'vinicios2005'
  }
}

type Tab = 'play' | 'games' | 'openings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'games', label: 'Games' },
  { id: 'openings', label: 'Openings' },
]

export default function App() {
  const [theme, setThemeState] = useState<ThemeId>(loadTheme)
  const [board, setBoardState] = useState<BoardChoice>(loadBoardChoice)
  const [user, setUserState] = useState(loadUser)
  const [tab, setTab] = useState<Tab>('play')
  const [openId, setOpenId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = (t: ThemeId) => {
    setThemeState(t)
    saveTheme(t)
  }
  const setBoard = (b: BoardChoice) => {
    setBoardState(b)
    saveBoardChoice(b)
  }
  const setUser = (u: string) => {
    setUserState(u)
    try {
      localStorage.setItem(USER_KEY, u)
    } catch {
      /* storage unavailable */
    }
  }

  const sync = useSync(user, () => setVersion((v) => v + 1))
  const colors = useMemo(() => boardColors(board, theme), [board, theme])

  const goTab = (t: Tab) => {
    setOpenId(null)
    setTab(t)
  }

  return (
    <BoardThemeContext.Provider value={colors}>
      <header className="top">
        <div className="brand">
          <CrownIcon size={26} />
          <span>Chess Teacher</span>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={!openId && tab === t.id ? 'on' : ''}
              onClick={() => goTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topRight">
          <span className="muted syncText">{sync.status || formatSync(sync.lastSync)}</span>
          <button className="accentOutline" onClick={() => void sync.run(false)} disabled={sync.busy}>
            <SyncIcon />
            {sync.busy ? 'Syncing…' : 'Sync'}
          </button>
          <button className="iconBtn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <SlidersIcon />
          </button>
        </div>
      </header>
      <div className="scarf" />
      <main>
        {openId ? (
          <ReviewPage id={openId} onBack={() => setOpenId(null)} />
        ) : (
          <>
            {tab === 'play' && <PlayPage onSaved={() => setVersion((v) => v + 1)} onOpenGame={setOpenId} />}
            {tab === 'games' && <GameList version={version} onOpen={setOpenId} />}
            {tab === 'openings' && <OpeningsPage version={version} onOpenGame={setOpenId} />}
          </>
        )}
      </main>
      {settingsOpen && (
        <SettingsPanel
          user={user}
          setUser={setUser}
          sync={sync}
          theme={theme}
          setTheme={setTheme}
          board={board}
          setBoard={setBoard}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </BoardThemeContext.Provider>
  )
}
