CREATE OR REPLACE FUNCTION public.pass_gofish_turn(p_room_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room_id UUID; v_turn_player_id UUID; v_deck JSONB; v_pot INT;
    v_my_hand JSONB; v_fished_card JSONB;
    v_next_player_id UUID; v_player_ids UUID[]; v_idx INT;
    v_message TEXT;
    
    -- Variables para verificar fin de juego
    v_active_players_count INT;
    v_winner_id UUID;
BEGIN
    -- 1. Validaciones
    SELECT id, turn_player_id, deck, pot INTO v_room_id, v_turn_player_id, v_deck, v_pot
    FROM public.gofish_rooms WHERE room_code = p_room_code;

    IF v_turn_player_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'No es tu turno');
    END IF;

    SELECT hand INTO v_my_hand FROM public.gofish_players 
    WHERE room_code = p_room_code AND user_id = auth.uid();

    IF jsonb_array_length(v_my_hand) > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Todavía tienes cartas, ¡juega!');
    END IF;

    -- 2. LÓGICA DE JUEGO
    IF jsonb_array_length(v_deck) > 0 THEN
        -- OPCIÓN A: HAY MAZO -> Robo y sigo
        v_fished_card := v_deck->0;
        v_deck := v_deck - 0;
        v_my_hand := v_my_hand || jsonb_build_array(v_fished_card);
        
        UPDATE public.gofish_players SET hand = v_my_hand WHERE room_code = p_room_code AND user_id = auth.uid();
        UPDATE public.gofish_rooms SET deck = v_deck WHERE room_code = p_room_code;
        
        v_message := 'Mano vacía: Robaste una carta extra. ¡Sigue tu turno!';
    ELSE
        -- OPCIÓN B: NO HAY MAZO -> Verificar si se acabó el juego
        
        -- Contamos cuántos jugadores TIENEN cartas (excluyéndome a mí que ya sé que tengo 0)
        SELECT COUNT(*) INTO v_active_players_count
        FROM public.gofish_players
        WHERE room_code = p_room_code 
          AND jsonb_array_length(hand) > 0;

        IF v_active_players_count = 0 THEN
            -- 🛑 GAME OVER: Nadie tiene cartas y no hay mazo
            
            -- Buscar Ganador
            SELECT user_id INTO v_winner_id
            FROM public.gofish_players 
            WHERE room_code = p_room_code 
            ORDER BY score DESC, books->>-1 DESC -- Mayor score gana
            LIMIT 1;

            -- Pagar
            UPDATE public.profiles SET global_balance = global_balance + v_pot WHERE id = v_winner_id;

            -- Cerrar Sala
            UPDATE public.gofish_rooms 
            SET game_phase = 'finished', 
                last_game_event = jsonb_build_object('type', 'game_over', 'winner_id', v_winner_id, 'reason', 'no_cards')
            WHERE room_code = p_room_code;

            v_message := '¡JUEGO TERMINADO! Se acabaron las cartas.';
        ELSE
            -- ⏭️ PASAR TURNO (Aún queda alguien con cartas)
            SELECT array_agg(user_id ORDER BY id ASC) INTO v_player_ids FROM public.gofish_players WHERE room_code = p_room_code;
            v_idx := array_position(v_player_ids, auth.uid());
            
            IF v_idx = array_length(v_player_ids, 1) THEN v_next_player_id := v_player_ids[1];
            ELSE v_next_player_id := v_player_ids[v_idx + 1]; END IF;

            UPDATE public.gofish_rooms 
            SET turn_player_id = v_next_player_id, last_update = now() 
            WHERE room_code = p_room_code;
            
            v_message := 'Sin cartas y sin mazo: Pasaste el turno.';
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', v_message);
END;
$$;