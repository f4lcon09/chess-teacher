import { useState } from 'react'
import { CrownIcon } from './icons'

// Optional personal logo: drop one of these files into public/local/ (git-ignored,
// so it never reaches the public repository). Without it the crown icon is used.
const CANDIDATES = ['logo.svg', 'logo.png', 'logo.webp']

export function Brand() {
  const [tried, setTried] = useState(0)
  const file = CANDIDATES[tried]

  return (
    <div className="brand">
      {file ? (
        <img
          className="brandLogo"
          src={`${import.meta.env.BASE_URL}local/${file}`}
          alt=""
          onError={() => setTried((n) => n + 1)}
        />
      ) : (
        <CrownIcon size={26} />
      )}
      <span>Chess Teacher</span>
    </div>
  )
}
