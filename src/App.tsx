import { useState } from 'react'
import { GameList } from './ui/GameList'
import { ReviewPage } from './ui/ReviewPage'

const KEY = 'chess-teacher:user'

function loadUser() {
  try {
    return localStorage.getItem(KEY) ?? 'vinicios2005'
  } catch {
    return 'vinicios2005'
  }
}

export default function App() {
  const [user, setUserState] = useState(loadUser)
  const [openId, setOpenId] = useState<string | null>(null)

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
      {openId ? (
        <ReviewPage id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <GameList user={user} setUser={setUser} onOpen={setOpenId} />
      )}
    </main>
  )
}
