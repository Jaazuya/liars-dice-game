# SQL Migrations para Liar's Dice

## Agregar columna `seat_index` a la tabla `players`

Ejecuta este comando SQL en tu base de datos Supabase:

```sql
-- Agregar columna seat_index para el orden aleatorio de asientos
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS seat_index INTEGER;

-- Crear índice para mejorar el rendimiento de las consultas ordenadas
CREATE INDEX IF NOT EXISTS idx_players_seat_index ON players(seat_index);
```

## Agregar columnas para "Modo con Trucos"

Ejecuta estos comandos SQL en tu base de datos Supabase:

```sql
-- Agregar columna allow_cheats a la tabla rooms
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS allow_cheats BOOLEAN DEFAULT false;

-- Agregar columna has_used_cheat a la tabla players
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS has_used_cheat BOOLEAN DEFAULT false;
```

## Notas

- `seat_index` puede ser `NULL` para jugadores que aún no han recibido un asiento (esperando en lobby) o para espectadores que se unieron tarde.
- El índice ayudará a mejorar el rendimiento cuando se ordenen los jugadores por `seat_index`.
- Los valores típicos serán 0, 1, 2, 3... según el orden aleatorio asignado al inicio de la partida.
- `allow_cheats` controla si la sala permite usar trucos de espionaje.
- `has_used_cheat` rastrea si un jugador ya usó su truco en la partida actual.

