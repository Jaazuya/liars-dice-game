# Sonidos Faltantes

El sistema está usando `dice-shake.mp3` como sonido provisional para todas las acciones porque faltan los siguientes archivos en la carpeta `public/sounds/`:

- `bet-placed.mp3`
- `liar.mp3`
- `button-click.mp3`
- `win.mp3`
- `lose.mp3`

Para restaurar los efectos de sonido correctos:
1. Sube los archivos de audio .mp3 con esos nombres a `red-dead-dice/public/sounds/`.
2. Edita `app/hooks/useGameSounds.ts` y restaura las rutas originales.

