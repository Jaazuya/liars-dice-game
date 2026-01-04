-- ============================================
-- MIGRACIÓN: INFRAESTRUCTURA DE LOTERÍA
-- ============================================

-- 1. Modificar tabla rooms: Agregar columna game_type
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'DICE';

-- 2. Crear tabla loteria_rooms
CREATE TABLE IF NOT EXISTS loteria_rooms (
    room_code TEXT PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
    current_card INTEGER,
    drawn_cards INTEGER[] DEFAULT '{}',
    winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_playing BOOLEAN DEFAULT false,
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_loteria_rooms_room_code ON loteria_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_loteria_rooms_winner_id ON loteria_rooms(winner_id);
CREATE INDEX IF NOT EXISTS idx_loteria_rooms_is_playing ON loteria_rooms(is_playing);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE loteria_rooms ENABLE ROW LEVEL SECURITY;

-- 5. Política de lectura: Pública (todos pueden leer)
CREATE POLICY "loteria_rooms_select_policy" ON loteria_rooms
    FOR SELECT
    USING (true);

-- 6. Política de escritura: Solo usuarios autenticados
CREATE POLICY "loteria_rooms_insert_policy" ON loteria_rooms
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "loteria_rooms_update_policy" ON loteria_rooms
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "loteria_rooms_delete_policy" ON loteria_rooms
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- 7. Crear tabla loteria_players
CREATE TABLE IF NOT EXISTS loteria_players (
    room_code TEXT REFERENCES loteria_rooms(room_code) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    board_cards INTEGER[] DEFAULT '{}',
    marked_cards INTEGER[] DEFAULT '{}',
    PRIMARY KEY (room_code, user_id)
);

-- 8. Crear índices para loteria_players
CREATE INDEX IF NOT EXISTS idx_loteria_players_room_code ON loteria_players(room_code);
CREATE INDEX IF NOT EXISTS idx_loteria_players_user_id ON loteria_players(user_id);

-- 9. Habilitar RLS para loteria_players
ALTER TABLE loteria_players ENABLE ROW LEVEL SECURITY;

-- 10. Políticas RLS para loteria_players (lectura/escritura para authenticated)
CREATE POLICY "loteria_players_select_policy" ON loteria_players
    FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "loteria_players_insert_policy" ON loteria_players
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "loteria_players_update_policy" ON loteria_players
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "loteria_players_delete_policy" ON loteria_players
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- 11. Comentarios para documentación
COMMENT ON TABLE loteria_rooms IS 'Tabla para gestionar salas de Lotería Mexicana';
COMMENT ON COLUMN loteria_rooms.room_code IS 'Código de la sala (FK a rooms.code)';
COMMENT ON COLUMN loteria_rooms.current_card IS 'ID de la carta actualmente visible (1-54)';
COMMENT ON COLUMN loteria_rooms.drawn_cards IS 'Array de IDs de cartas que ya fueron sacadas';
COMMENT ON COLUMN loteria_rooms.winner_id IS 'ID del perfil ganador (null si no hay ganador aún)';
COMMENT ON COLUMN loteria_rooms.is_playing IS 'Indica si la partida está en curso';
COMMENT ON COLUMN loteria_rooms.last_update IS 'Timestamp del último cambio para controlar el ritmo del Gritón';

COMMENT ON TABLE loteria_players IS 'Tablas de lotería de cada jugador';
COMMENT ON COLUMN loteria_players.room_code IS 'Código de la sala';
COMMENT ON COLUMN loteria_players.user_id IS 'ID del perfil del jugador';
COMMENT ON COLUMN loteria_players.board_cards IS 'Array de 16 IDs de cartas en el tablero del jugador';
COMMENT ON COLUMN loteria_players.marked_cards IS 'Array de IDs de cartas que el jugador ya marcó';

