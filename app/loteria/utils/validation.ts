export type WinPattern = 'linea' | 'diagonal' | 'cuadro' | 'esquinas' | 'centro' | 'llenas';

export const PATTERN_POINTS: Record<WinPattern, number> = {
  linea: 2,
  diagonal: 3,
  cuadro: 3,
  esquinas: 4,
  centro: 5,
  llenas: 10,
};

export const PATTERN_NAMES: Record<WinPattern, string> = {
  linea: 'Línea',
  diagonal: 'Diagonal',
  cuadro: 'Cuadro Chico',
  esquinas: '4 Esquinas',
  centro: 'Centro',
  llenas: '¡LLENAS!',
};

export const PATTERN_ICONS: Record<WinPattern, string> = {
  linea: '━',
  diagonal: '⤡',
  cuadro: '▣',
  esquinas: '┏ ┓\n┗ ┛',
  centro: '🎯',
  llenas: '▦',
};

export const checkPattern = (
  pattern: WinPattern,
  boardCards: number[], // Array of 16 card IDs
  drawnCards: number[]  // Array of drawn card IDs
): boolean => {
  const indicesGroups = getPatternIndices(pattern);
  
  // Check if ANY of the valid index groups for this pattern are fully drawn
  for (const indices of indicesGroups) {
    const cardIds = indices.map(idx => boardCards[idx]);
    // Honesty Check: All cards in the pattern must have been drawn by the host
    const isValid = cardIds.every(id => drawnCards.includes(id));
    if (isValid) return true;
  }
  return false;
};

function getPatternIndices(pattern: WinPattern): number[][] {
  const rows = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]
  ];
  const cols = [
    [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15]
  ];
  const diagonals = [
    [0, 5, 10, 15], [3, 6, 9, 12]
  ];
  const esquinas = [
    [0, 3, 12, 15]
  ];
  const centro = [
    [5, 6, 9, 10]
  ];
  const llenas = [
    Array.from({ length: 16 }, (_, i) => i)
  ];
  
  // Cuadro Chico (Any 2x2)
  const cuadros: number[][] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const tl = r * 4 + c;
      cuadros.push([tl, tl + 1, tl + 4, tl + 5]);
    }
  }

  switch (pattern) {
    case 'linea': return [...rows, ...cols];
    case 'diagonal': return diagonals;
    case 'cuadro': return cuadros;
    case 'esquinas': return esquinas;
    case 'centro': return centro;
    case 'llenas': return llenas;
    default: return [];
  }
}
