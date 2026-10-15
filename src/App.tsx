import { useState } from 'react'
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

export default function App() {
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

  return (
    <main>
      <h1>Chess Teacher</h1>
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
          {tab === 'play' && <PlayPage onSaved={() => setVersion((v) => v + 1)} />}
        </>
      )}
    </main>
  )
}
