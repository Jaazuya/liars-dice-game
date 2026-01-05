export const LOTERIA_BOARDS: number[][] = [
  [33, 36, 20, 46, 40, 8, 39, 21, 15, 22, 35, 18, 45, 34, 38, 12], // Tabla 1
  [33, 7, 3, 42, 41, 30, 47, 15, 25, 18, 20, 14, 37, 2, 18, 39],  // Tabla 2
  [3, 7, 50, 4, 9, 21, 23, 2, 10, 33, 17, 28, 20, 38, 18, 22],    // Tabla 3
  [52, 31, 12, 40, 23, 2, 36, 46, 32, 51, 10, 18, 11, 22, 3, 7],  // Tabla 4
  [7, 33, 23, 15, 49, 1, 37, 52, 43, 38, 40, 46, 19, 11, 5, 17],  // Tabla 5
  [14, 17, 10, 46, 1, 7, 38, 32, 30, 20, 47, 35, 27, 21, 52, 15], // Tabla 6
  [6, 34, 2, 11, 35, 40, 15, 22, 52, 32, 44, 46, 31, 24, 45, 10], // Tabla 7
  [30, 51, 13, 10, 12, 17, 18, 22, 45, 6, 11, 14, 23, 47, 33, 39], // Tabla 8
  [19, 31, 37, 25, 6, 53, 27, 40, 30, 2, 13, 38, 11, 35, 49, 21], // Tabla 9
  [37, 48, 4, 46, 42, 31, 3, 50, 39, 52, 1, 19, 18, 2, 51, 53]    // Tabla 10
];

// --- Normalización: garantizar 16 IDs únicos (1..54) ---
// Si una tabla trae duplicados, los reemplazamos por cartas faltantes.
// Lo hacemos de forma determinista (seed por índice) para que:
// - No cambie entre refreshes
// - Podamos comparar arrays para detectar qué tabla fue asignada

function seededRng(seed: number) {
  // xorshift32
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // [0,1)
    return ((x >>> 0) / 4294967296);
  };
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeBoard(board: number[], seed: number): number[] {
  const unique: number[] = [];
  const seen = new Set<number>();

  for (const id of board) {
    if (!Number.isInteger(id)) continue;
    if (id < 1 || id > 54) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length === 16) return unique;
  }

  const rand = seededRng(seed);
  const candidates = shuffled(
    Array.from({ length: 54 }, (_, i) => i + 1).filter((id) => !seen.has(id)),
    rand
  );

  for (const id of candidates) {
    unique.push(id);
    if (unique.length === 16) break;
  }

  return unique.slice(0, 16);
}

export const NORMALIZED_LOTERIA_BOARDS: number[][] = LOTERIA_BOARDS.map((b, idx) =>
  normalizeBoard(b, idx + 1)
);


