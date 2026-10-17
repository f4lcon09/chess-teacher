import { createContext, useContext, type CSSProperties } from 'react'

export interface BoardColors {
  light: string
  dark: string
}

/** The active square colors; App provides them from the theme and the board choice. */
export const BoardThemeContext = createContext<BoardColors>({ light: '#f0d9b5', dark: '#b58863' })

/** Square colors to spread into the Chessboard options. */
export function useBoardStyles(): { lightSquareStyle: CSSProperties; darkSquareStyle: CSSProperties } {
  const c = useContext(BoardThemeContext)
  return {
    lightSquareStyle: { backgroundColor: c.light },
    darkSquareStyle: { backgroundColor: c.dark },
  }
}
