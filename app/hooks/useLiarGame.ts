import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Player, GameState, VoteData, NotificationData } from '@/app/types/game';

export const useLiarGame = (
    code: string, 
    onNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void,
    onRoundResult?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', onClose?: () => void) => void
) => {
    const normalizedCode = (code || '').toUpperCase();
    const [players, setPlayers] = useState<Player[]>([]);
    const [roomId, setRoomId] = useState<string | null>(null); // dice_rooms.id (UUID)
    
    // Inicialización Lazy síncrona para evitar race conditions
    const [myId, setMyId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('playerId') || '';
        }
        return '';
    });

    const [loading, setLoading] = useState(true); // Estado de carga para evitar renders prematuros
    const [gameState, setGameState] = useState<GameState>({
        status: 'waiting',
        pot: 0,
        entryFee: 100,
        currentTurnId: null,
        lastBetUserId: null,
        currentBet: { quantity: 0, face: 0 },
        voteData: null,
        notificationData: null,
        gameOverData: null,
        allowCheats: false,
        randomTurns: false,
        turnSequence: null
    });

    // Variables de autenticación (usadas para sincronización de identidad)
    const [authUserId, setAuthUserId] = useState<string | null>(null);
    const [roomHostId, setRoomHostId] = useState<string | null>(null);
    
    // 1. Detección por lista de jugadores (La normal)
    const myPlayer = players.find(p => p.id === myId);

    // 2. Detección por Autenticación (La infalible)
    // Si el dueño de la sala (roomHostId) soy yo (authUserId), entonces soy Host.
    // (roomHostId viene de la RPC fetchSafeGameState -> data.room.host_id)
    const isHostAuth = !!authUserId && !!roomHostId && authUserId === roomHostId;

    // 3. LA VERDAD DEFINITIVA:
    // Soy host si la ficha dice que soy host O si mis credenciales coinciden con las del dueño.
    const isHost = (myPlayer?.is_host === true) || isHostAuth;

    // Ref para evitar múltiples ejecuciones del auto-start
    const hasCheckedAllReady = useRef(false);
    // Ref para evitar múltiples timeouts de notificación
    const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Función para obtener emoji de dado (0 = incógnita '?', 1-6 = dados normales)
    const getDiceEmoji = (num: number) => {
        // Si el valor es 0, mostrar incógnita (dado oculto de rival)
        if (num === 0) return '?';
        // Validar rango 1-6
        if (num >= 1 && num <= 6) return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][num - 1];
        return '?';
    };
    const notifyDbError = (prefix: string, error: any) => {
        if (!error) return;
        // PostgrestError a veces se imprime como {} en consola, pero trae propiedades útiles.
        const msgParts = [
            error?.message,
            error?.details,
            error?.hint,
            error?.code ? `code=${error.code}` : null,
            error?.status ? `status=${error.status}` : null
        ].filter(Boolean);
        const msg =
            msgParts.length > 0
                ? msgParts.join(' | ')
                : (() => {
                    try { return JSON.stringify(error); } catch { return String(error); }
                })();

        console.error(prefix, { msg, raw: error });
        onNotification?.(`${prefix}: ${msg}`, 'error');
    };

    // Función segura para obtener el estado del juego (FOG OF WAR)
    const fetchSafeGameState = async (roomCode: string) => {
        try {
            const { data, error } = await supabase.rpc('get_safe_dice_gamestate', {
                p_room_code: roomCode
            });

            if (error) {
                console.error('[Dice] Error al obtener estado seguro:', error);
                return;
            }

            if (data) {
                // La RPC devuelve { room: ..., players: [...] }
                if (data.room) {
                    const r = data.room;
                    setRoomId(r.id || null);
                    setRoomHostId(r.host_id || null);
                    setGameState(prev => ({
                        ...prev,
                        status: (() => {
                            const raw = (r.game_phase ?? r.status ?? 'waiting');
                            const s = String(raw).toLowerCase().trim();
                            if (s === 'lobby') return 'waiting';
                            if (s === 'waiting' || s === 'boarding' || s === 'playing' || s === 'finished' || s === 'not_found') return s as any;
                            return 'waiting';
                        })(),
                        pot: r.pot || 0,
                        entryFee: r.entry_fee || 100,
                        currentTurnId: r.current_turn_player_id,
                        lastBetUserId: r.last_bet_player_id ?? null,
                        currentBet: { 
                            quantity: r.current_bet_quantity || 0, 
                            face: r.current_bet_face || 0 
                        },
                        notificationData: r.notification_data || null,
                        gameOverData: r.game_over_data || null,
                        allowCheats: r.allow_cheats || false,
                        randomTurns: r.settings_random_turns || false,
                        turnSequence: r.turn_sequence || null
                    }));
                }

                if (data.players && Array.isArray(data.players)) {
                    // --- BLOQUE DE AUTOCORRECCIÓN DE ID ---
                    // Buscar si mi usuario de Supabase está en la lista de jugadores
                    if (authUserId) {
                        // data.players viene de la RPC, así que tiene user_id
                        const meInList = data.players.find((p: any) => p.user_id === authUserId);
                        
                        // Si me encuentro en la lista, pero mi ID local (myId) es diferente...
                        if (meInList && meInList.id !== myId) {
                            console.log("🤠 Identidad sincronizada: Soy", meInList.id);
                            setMyId(meInList.id);
                            localStorage.setItem('playerId', meInList.id);
                            // Importante: forzar la actualización del estado isHost
                        }
                    }
                    // --------------------------------------

                    // Los jugadores ya vienen con dados ocultos (valor 0) para rivales
                    // Ordenar por seat_index si existe
                    const sorted = [...data.players].sort((a, b) => {
                        if (a.seat_index !== null && b.seat_index !== null) return a.seat_index - b.seat_index;
                        if (a.seat_index !== null) return -1;
                        if (b.seat_index !== null) return 1;
                        const at = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
                        const bt = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
                        if (at !== bt) return at - bt;
                        return String(a.id).localeCompare(String(b.id));
                    });
                    setPlayers(sorted);
                }
            }
        } catch (err: any) {
            console.error('[Dice] Excepción al obtener estado seguro:', err);
        }
    };

    // --- CARGA DE DATOS ROBUSTA ---
    useEffect(() => {
        if (!code) return;
        setLoading(true);

        const initGame = async () => {
            // 1. Obtener usuario actual (Sheriff)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                console.log("🤠 Usuario autenticado:", user.id);
                setAuthUserId(user.id);
            }

            // 2. Obtener estado del juego
            await fetchSafeGameState(normalizedCode);
            setLoading(false);
        };

        initGame();
    }, [code, normalizedCode]);

    // --- SUSCRIPCIONES REALTIME (por UUID de sala) ---
    useEffect(() => {
        if (!roomId || !normalizedCode) return;

        // Escuchamos CUALQUIER cambio en la sala
        const channel = supabase.channel(`room_watcher_${roomId}`)
            .on('postgres_changes', {
                event: 'UPDATE', // El Trigger del Paso 1 causará un UPDATE aquí
                schema: 'public',
                table: 'dice_rooms',
                filter: `id=eq.${roomId}`
            }, (payload) => {
                console.log("🔔 Cambio detectado en sala via Realtime:", payload);
                // Esto recargará jugadores y estado del host
                fetchSafeGameState(normalizedCode);
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(channel); 
        };
    }, [roomId, normalizedCode]);

    // --- DETECCIÓN DE EXPULSIÓN (Mejorada) ---
    useEffect(() => {
        // Esperar a que termine la carga inicial
        if (loading || !code) return;
        
        // Si la lista de jugadores está vacía, probablemente es que aún no cargó bien. 
        // No nos suicidamos todavía.
        if (players.length === 0) return;

        // Verificar si existo en la lista (por ID local O por Auth ID)
        const amIAlive = players.some(p => 
            p.id === myId || (authUserId && p.user_id === authUserId)
        );
        
        // Solo redirigir si NO estoy vivo y la lista tiene gente
        if (!amIAlive) {
            console.error("🚨 DETECTADA EXPULSIÓN REAL.", { myId, authUserId, playersIds: players.map(p => p.id) });
            onNotification?.('Has sido expulsado del Saloon.', 'error');
            
            // Dar un momento para ver el mensaje antes de sacar
            const timer = setTimeout(() => {
                 // window.location.href = '/'; // Descomenta cuando estés seguro
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [players, myId, authUserId, code, loading]);


    // --- INICIO DEL JUEGO (FASE 3) ---
    const startRound = async () => {
        if (!roomId || !isHost) return;
        onNotification?.('Iniciando partida...', 'info');

        const { error } = await supabase.rpc('start_liar_game', { 
            p_room_id: roomId 
        });

        if (error) {
            notifyDbError('Error al iniciar', error);
        } else {
            // No necesitas hacer setGameState manual, el useEffect del realtime 
            // detectará el cambio a 'playing' y recargará todo.
            onNotification?.('¡Partida iniciada!', 'success');
        }
    };

    // --- AUTO-INICIO DEL JUEGO (Cuando todos están listos) ---
    useEffect(() => {
        if (gameState.status !== 'boarding' || players.length === 0) {
            hasCheckedAllReady.current = false;
            return;
        }

        const allReady = players.every(p => p.is_ready);
        
        // Solo el host puede iniciar el juego
        if (allReady && isHost && !hasCheckedAllReady.current) {
            hasCheckedAllReady.current = true;
            startRound();
        } else if (!allReady) {
            hasCheckedAllReady.current = false;
        }
    }, [players, gameState.status, myId, code, isHost]);

    // --- ACCIONES FASE 1: LOBBY ---

    const updateEntryFee = async (amount: number) => {
        if (amount < 0) return;
        if (!roomId) return;
        const { error } = await supabase
            .from('dice_rooms')
            .update({ entry_fee: amount })
            .eq('id', roomId);
        if (error) {
            notifyDbError('No se pudo actualizar la apuesta', error);
            return;
        }

        // UI optimista (evita “no pasa nada” si Realtime tarda)
        setGameState(prev => ({ ...prev, entryFee: amount }));
        onNotification?.('Apuesta actualizada.', 'success');
    };

    // --- FUNCIÓN: Toggle de Trucos (Solo Host) ---
    const toggleCheats = async () => {
        if (!isHost) return;
        if (!roomId) return;

        const newValue = !gameState.allowCheats;
        const { error } = await supabase
            .from('dice_rooms')
            .update({ allow_cheats: newValue })
            .eq('id', roomId);
        if (error) {
            if (error.code === 'PGRST204' && `${error.message || ''}`.includes('allow_cheats')) {
                onNotification?.('Tu tabla dice_rooms no tiene la columna allow_cheats. Desactivando este botón.', 'warning');
                return;
            }
            notifyDbError('No se pudo cambiar trucos', error);
            return;
        }

        setGameState(prev => ({ ...prev, allowCheats: newValue }));
        onNotification?.(newValue ? 'Trucos activados.' : 'Trucos desactivados.', 'success');
    };

    // --- FUNCIÓN: Toggle de Turnos Aleatorios (Solo Host) ---
    const toggleRandomTurns = async () => {
        if (!isHost) return;
        if (!roomId) return;

        const newValue = !gameState.randomTurns;
        const { error } = await supabase
            .from('dice_rooms')
            .update({ settings_random_turns: newValue })
            .eq('id', roomId);
        if (error) {
            if (error.code === 'PGRST204' && `${error.message || ''}`.includes('settings_random_turns')) {
                onNotification?.('Tu tabla dice_rooms no tiene la columna settings_random_turns. Desactivando este botón.', 'warning');
                return;
            }
            notifyDbError('No se pudo cambiar turnos aleatorios', error);
            return;
        }

        setGameState(prev => ({ ...prev, randomTurns: newValue }));
        onNotification?.(newValue ? 'Turnos aleatorios activados.' : 'Turnos aleatorios desactivados.', 'success');
    };

    // --- FUNCIÓN: Usar Truco de Espionaje (RPC Segura) ---
    const useCheat = async (): Promise<number | null> => {
        if (!gameState.allowCheats) {
            onNotification?.('Los trucos no están permitidos en esta sala.', 'error');
            return null;
        }

        if (!gameState.currentBet.face || gameState.currentBet.face === 0) {
            onNotification?.('No hay apuesta activa para espiar.', 'error');
            return null;
        }

        if (!roomId) return null;

        // Llamada segura al backend
        const { data, error } = await supabase.rpc('use_spy_cheat', {
            p_room_id: roomId,
            p_face: gameState.currentBet.face
        });

        if (error) {
            notifyDbError('Error al espiar', error);
            return null;
        }

        // Actualizar UI localmente
        setPlayers(prev => prev.map(p => p.id === myId ? ({ ...p, has_used_cheat: true } as any) : p));
        
        return data as number; // Retorna la cantidad encontrada
    };

    const openTable = async () => {
        if (!roomId) return;
        if (!isHost) {
            onNotification?.('Solo el Sheriff puede abrir la mesa.', 'error');
            return;
        }
        // Reiniciar estado de listos de todos
        await Promise.all(
            players.map(p => 
                supabase
                    .from('dice_players')
                    .update({ is_ready: false })
                    .eq('id', p.id)
            )
        );
        const { error } = await supabase
            .from('dice_rooms')
            .update({ game_phase: 'boarding' })
            .eq('id', roomId);
        if (error) {
            notifyDbError('No se pudo abrir la mesa', error);
            return;
        }

        // UI optimista
        setGameState(prev => ({ ...prev, status: 'boarding' }));
        onNotification?.('Mesa abierta. ¡A pagar la entrada!', 'success');
    };

    // --- FUNCIÓN: Abandonar Partida ---
    const abandonGame = async () => {
        if (!myId) return;
        
        // Eliminar jugador de la base de datos
        await supabase
            .from('dice_players')
            .delete()
            .eq('id', myId);
        
        // Redirigir a la pantalla de inicio
        window.location.href = '/';
    };

    // --- FUNCIÓN: Reiniciar Sala (Solo Host) ---
    const resetRoom = async () => {
        if (!isHost) return;
        if (!roomId) return;
        
        // Obtener todos los jugadores de la sala
        const { data: allPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId);
        
        if (!allPlayers) return;
        
        // Limpiar estado de todos los jugadores (incluyendo espectadores)
        await Promise.all(
            allPlayers.map(p =>
                supabase
                    .from('dice_players')
                    .update({
                        is_ready: false,
                        dice_values: null,
                        seat_index: null, // Resetear asientos para el próximo shuffle
                        // has_used_cheat ya no existe
                    } as any)
                    .eq('id', p.id)
            )
        );
        
        // Reiniciar sala
        await supabase
            .from('dice_rooms')
            .update({
                game_phase: 'waiting',
                pot: 0,
                current_bet_quantity: 0,
                current_bet_face: 0,
                current_turn_player_id: null,
                notification_data: null,
                game_over_data: null,
                kick_vote_data: null
            })
            .eq('id', roomId);
    };

    // --- ACCIONES FASE 2: BOARDING ---

    const payEntry = async (): Promise<boolean> => {
        const me = players.find(p => p.id === myId);
        if (!me?.user_id) return false;
        if (!roomId) return false;

        // Cobro global (RPC universal)
        let payError = (await supabase.rpc('pay_game_entry', {
            user_id_param: me.user_id,
            room_table_name: 'dice_rooms',
            room_id_param: roomId,
            amount: gameState.entryFee
        })).error;
        // fallback por compatibilidad si el RPC usa `code`
        if (payError) {
            payError = (await supabase.rpc('pay_game_entry', {
                user_id_param: me.user_id,
                room_table_name: 'dice_rooms',
                room_id_param: code,
                amount: gameState.entryFee
            } as any)).error;
        }

        if (payError) {
            console.error("Error pay_game_entry (dados):", payError);
            onNotification?.('No se pudo pagar la entrada.', 'error');
            return false;
        }

        // Marcar "listo" localmente para poder entrar al juego y contabilizar el pozo
        const { error: readyError } = await supabase
            .from('dice_players')
            .update({ is_ready: true } as any)
            .eq('id', me.id);

        if (readyError) {
            notifyDbError('No se pudo marcar como pagado', readyError);
            return false;
        }

        // UI optimista
        setPlayers(prev => prev.map(p => p.id === me.id ? ({ ...p, is_ready: true } as any) : p));
        onNotification?.('Entrada pagada.', 'success');
        return true;
    };

    // --- SISTEMA DE EXPULSIÓN (LEY MARCIAL DEL HOST) ---
    // Solo el Host puede expulsar, acción inmediata sin votación

    // --- SISTEMA DE EXPULSIÓN (RPC SEGURA) ---
    const kickPlayer = async (targetId: string) => {
        if (!isHost || !roomId) return;

        const { error, data } = await supabase.rpc('kick_dice_player', {
            p_room_id: roomId,
            p_target_id: targetId
        });

        if (error) {
            notifyDbError('Error al expulsar', error);
        } else if (data && !data.success) {
            onNotification?.(data.message, 'error');
        }
    };

    // --- FUNCIÓN AUXILIAR: Obtener siguiente jugador activo ---
    const getNextActivePlayer = (currentPlayerId: string, playerList: Player[]): Player | null => {
        // Si hay turn_sequence y randomTurns está activo, usar esa secuencia
        if (gameState.randomTurns && gameState.turnSequence && gameState.turnSequence.length > 0) {
            const currentIndex = gameState.turnSequence.findIndex(id => id === currentPlayerId);
            if (currentIndex === -1) {
                // Si el jugador actual no está en la secuencia, buscar el siguiente activo normalmente
                return getNextActivePlayerFallback(currentPlayerId, playerList);
            }

            // Buscar siguiente jugador activo en la secuencia (cíclico)
            for (let i = 1; i < gameState.turnSequence.length; i++) {
                const nextIndex = (currentIndex + i) % gameState.turnSequence.length;
                const nextPlayerId = gameState.turnSequence[nextIndex];
                const nextPlayer = playerList.find(p => p.id === nextPlayerId);
                if (nextPlayer && (nextPlayer.dice_values?.length || 0) > 0) {
                    return nextPlayer;
                }
            }
            return null;
        }

        // ORDEN FIJO: Usar lógica original
        return getNextActivePlayerFallback(currentPlayerId, playerList);
    };

    // --- FUNCIÓN AUXILIAR: Obtener siguiente jugador activo (orden fijo) ---
    const getNextActivePlayerFallback = (currentPlayerId: string, playerList: Player[]): Player | null => {
        const currentIndex = playerList.findIndex(p => p.id === currentPlayerId);
        if (currentIndex === -1) return null;

        // Buscar siguiente jugador con dados
        for (let i = 1; i < playerList.length; i++) {
            const nextIndex = (currentIndex + i) % playerList.length;
            const nextPlayer = playerList[nextIndex];
            if (nextPlayer && (nextPlayer.dice_values?.length || 0) > 0) {
                return nextPlayer;
            }
        }
        return null;
    };

    // --- FUNCIÓN: Manejar siguiente ronda (solo Host) ---
    const handleNextRound = async (loserId: string) => {
        if (!roomId || !isHost) return;

        // Llamada RPC al Backend
        const { error } = await supabase.rpc('next_liar_round', {
            p_room_id: roomId,
            p_loser_id: loserId
        });

        if (error) {
            notifyDbError('Error al preparar siguiente ronda', error);
        }
        // El estado se actualizará solo vía Realtime
    };

    // --- CONTROL DE TIEMPO: El Host ejecuta handleNextRound después de 5 segundos ---
    useEffect(() => {
        // Limpiar timeout anterior si existe
        if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
            notificationTimeoutRef.current = null;
        }

        // Si hay notificación y soy el host, iniciar el timer
        if (gameState.notificationData && isHost && gameState.status === 'playing') {
            const notificationData = gameState.notificationData;
            const loserId = notificationData.loserId;

            if (loserId) {
                notificationTimeoutRef.current = setTimeout(async () => {
                    await handleNextRound(loserId);
                    notificationTimeoutRef.current = null;
                }, 5000);
            }
        }

        return () => {
            if (notificationTimeoutRef.current) {
                clearTimeout(notificationTimeoutRef.current);
            }
        };
    }, [gameState.notificationData, players, myId, gameState.status, code, isHost]);

    // --- LÓGICA DE JUEGO: APUESTAS Y RESOLUCIÓN ---

    const placeBet = async (qty: number, face: number) => {
        if (!roomId) return;

        // Validación local rápida (opcional, para UI feedback instantáneo)
        const currentBet = gameState.currentBet;
        if (qty < currentBet.quantity || (qty === currentBet.quantity && face <= currentBet.face)) {
             if (currentBet.quantity > 0) {
                 onNotification?.('Debes subir la apuesta (Más dados o misma cantidad con cara más alta).', 'error');
                 return;
             }
        }

        const { error, data } = await supabase.rpc('make_liar_bet', {
            p_room_id: roomId,
            p_quantity: qty,
            p_face: face
        });

        if (error) {
            notifyDbError('Error al apostar', error);
        } else if (data && !data.success) {
            onNotification?.(data.message, 'error');
        }
        
        // El cambio de turno llegará por Realtime
    };

    const resolveRound = async (action: 'LIAR' | 'EXACT') => {
        if (!gameState.currentBet.quantity || !roomId) return;
        
        // Llamar al Backend para que cuente los dados
        const { error } = await supabase.rpc('resolve_liar_round', {
            p_room_id: roomId,
            p_action: action
        });

        if (error) {
            notifyDbError('Error al resolver', error);
        }
        // El resultado vendrá por el canal realtime en 'notification_data'
    };

    return {
        players,
        myId,
        loading, // Exponer estado de carga
        gameState,
        roomId, // Exponer roomId para funciones como reset_liar_game
        getDiceEmoji,
        actions: {
            updateEntryFee,
            openTable,
            payEntry,
            placeBet,
            resolveRound,
            kickPlayer,
            abandonGame,
            resetRoom,
            toggleCheats,
            toggleRandomTurns,
            useCheat
        }
    };
};
