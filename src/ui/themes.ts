// App color themes. The palettes live in index.css ([data-theme] blocks);
// this file only holds what TypeScript needs: names, swatches and board colors.

export type ThemeId = 'forest' | 'aura' | 'ivory'

export interface ThemeInfo {
  name: string
  blurb: string
  swatch: [string, string, string] // background, accent, highlight
  board: { light: string; dark: string }
}

export const THEMES: Record<ThemeId, ThemeInfo> = {
  forest: {
    name: 'Forest',
    blurb: 'Deep green, dark',
    swatch: ['#0d1512', '#2f9e7e', '#d9b45a'],
    board: { light: '#e8dfc6', dark: '#2f5d4e' },
  },
  aura: {
    name: 'Aura',
    blurb: 'Turquoise glow, dark',
    swatch: ['#0a1517', '#2dd4bf', '#d9b45a'],
    board: { light: '#dfe9e4', dark: '#2c6b6b' },
  },
  ivory: {
    name: 'Ivory',
    blurb: 'Cream and green, light',
    swatch: ['#f4ecda', '#1f7a5f', '#b8903a'],
    board: { light: '#f1e8d0', dark: '#5f8a6f' },
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

const THEME_KEY = 'chess-teacher:theme'

/** Reads the saved theme; the older light/dark/system values map to ivory/forest. */
export function loadTheme(): ThemeId {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'forest' || t === 'aura' || t === 'ivory') return t
    if (t === 'light') return 'ivory'
  } catch {
    /* storage unavailable */
  }
  return 'forest'
}

export function saveTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

export type BoardChoice = 'auto' | 'brown' | 'green' | 'blue'

export const BOARD_CHOICES: Record<BoardChoice, { name: string; light?: string; dark?: string }> = {
  auto: { name: 'Match theme' },
  brown: { name: 'Classic brown', light: '#f0d9b5', dark: '#b58863' },
  green: { name: 'Tournament green', light: '#eeeed2', dark: '#769656' },
  blue: { name: 'Slate blue', light: '#dee3e6', dark: '#8ca2ad' },
}

const BOARD_KEY = 'chess-teacher:boardTheme'

export function loadBoardChoice(): BoardChoice {
  try {
    const t = localStorage.getItem(BOARD_KEY)
    if (t === 'brown' || t === 'green' || t === 'blue') return t
  } catch {
    /* storage unavailable */
  }
  return 'auto'
}

export function saveBoardChoice(id: BoardChoice) {
  try {
    localStorage.setItem(BOARD_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

export function boardColors(choice: BoardChoice, theme: ThemeId): { light: string; dark: string } {
  const c = BOARD_CHOICES[choice]
  return c.light && c.dark ? { light: c.light, dark: c.dark } : THEMES[theme].board
}
