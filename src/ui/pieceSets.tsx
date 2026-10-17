import type { PieceRenderObject } from 'react-chessboard'

const TYPES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

/** Builds the Chessboard `pieces` option from SVG files in public/pieces/<set>/. */
function pieceSet(set: string): PieceRenderObject {
  const out: PieceRenderObject = {}
  for (const type of TYPES) {
    out[type] = () => (
      <img
        src={`${import.meta.env.BASE_URL}pieces/${set}/${type}.svg`}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    )
  }
  return out
}

// Merida by Armando Hernandez Marroquin (GPL 2+), taken from the Lichess collection.
export const MERIDA = pieceSet('merida')
