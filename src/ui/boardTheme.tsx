import { createContext, useContext, type CSSProperties } from 'react'

export type BoardThemeId = 'brown' | 'green' | 'blue'

export const BOARD_THEMES: Record<BoardThemeId, { name: string; light: string; dark: string }> = {
  brown: { name: 'Brown', light: '#f0d9b5', dark: '#b58863' },
  green: { name: 'Green', light: '#eeeed2', dark: '#769656' },
  blue: { name: 'Blue', light: '#dee3e6', dark: '#8ca2ad' },
}

const KEY = 'chess-teacher:boardTheme'

export function loadBoardTheme(): BoardThemeId {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'green' || t === 'blue') return t
  } catch {
    /* storage unavailable */
  }
  return 'brown'
}

export function saveBoardTheme(id: BoardThemeId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable */
  }
}

export const BoardThemeContext = createContext<BoardThemeId>('brown')

/** Square colors for the chosen board theme, to spread into the Chessboard options. */
export function useBoardStyles(): { lightSquareStyle: CSSProperties; darkSquareStyle: CSSProperties } {
  const t = BOARD_THEMES[useContext(BoardThemeContext)]
  return {
    lightSquareStyle: { backgroundColor: t.light },
    darkSquareStyle: { backgroundColor: t.dark },
  }
}
