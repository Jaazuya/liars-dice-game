-- =================================================================
-- FIX REALTIME: HABILITAR PUBLICACIÓN PARA TABLAS DE LOTERÍA
-- =================================================================
-- Ejecuta este script en el Editor SQL de Supabase para asegurar
-- que los cambios en estas tablas se envíen a los clientes.

-- 1. Añadir tablas a la publicación 'supabase_realtime'
--    (Esta publicación existe por defecto en proyectos nuevos)

ALTER PUBLICATION supabase_realtime ADD TABLE loteria_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE loteria_players;

-- 2. Verificar que la réplica de identidad sea FULL (opcional pero recomendado para updates complejos)
ALTER TABLE loteria_rooms REPLICA IDENTITY FULL;
ALTER TABLE loteria_players REPLICA IDENTITY FULL;

