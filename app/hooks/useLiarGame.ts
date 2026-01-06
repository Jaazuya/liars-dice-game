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

    // Host derivado estrictamente por auth.user.id vs room.host_id
    const [authUserId, setAuthUserId] = useState<string | null>(null);
    const [roomHostId, setRoomHostId] = useState<string | null>(null);
    const isHost = !!authUserId && !!roomHostId && authUserId === roomHostId;

    // Ref para evitar múltiples ejecuciones del auto-start
    const hasCheckedAllReady = useRef(false);
    // Ref para evitar múltiples timeouts de notificación
    const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const getDiceEmoji = (num: number) => ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][num] || '?';
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

    // --- CARGA DE DATOS ---
    useEffect(() => {
        if (!code) return;
        setLoading(true);

        // Cargar usuario autenticado
        supabase.auth.getUser().then(({ data }) => {
            setAuthUserId(data.user?.id || null);
        });

        const fetchAll = async () => {
            try {
                // 1) Obtener la sala por `code` para recuperar su UUID real
                const { data: r, error: roomErr } = await supabase
                    .from('dice_rooms')
                    .select('*')
                    .eq('code', normalizedCode)
                    .single();

                if (roomErr || !r) {
                    console.error("Error fetching dice_room:", roomErr);
                    setRoomId(null);
                    setPlayers([]);
                    setGameState(prev => ({ ...prev, status: 'not_found' }));
                    return;
                }

                setRoomId(r.id || null);

                // host_id debe venir en dice_rooms
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

                // 2) Cargar jugadores por UUID (dice_players.room_id)
                const { data: p } = await supabase
                    .from('dice_players')
                    .select('*')
                    .eq('room_id', r.id);

                if (p) {
                    const sorted = [...p].sort((a, b) => {
                        if (a.seat_index !== null && b.seat_index !== null) return a.seat_index - b.seat_index;
                        if (a.seat_index !== null) return -1;
                        if (b.seat_index !== null) return 1;
                        // `created_at` no siempre existe en el esquema; fallback estable por id
                        const at = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
                        const bt = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
                        if (at !== bt) return at - bt;
                        return String(a.id).localeCompare(String(b.id));
                    });
                    setPlayers(sorted);
                }
            } catch (error) {
                console.error("Error fetching game data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
    }, [code, normalizedCode]);

    // --- SUSCRIPCIONES REALTIME (por UUID de sala) ---
    useEffect(() => {
        if (!roomId) return;

        const fetchAll = async () => {
            try {
                const { data: r } = await supabase
                    .from('dice_rooms')
                    .select('*')
                    .eq('id', roomId)
                    .single();
                if (r) {
                    setRoomHostId(r.host_id || null);
                    setGameState(prev => ({
                        ...prev,
                        status: (() => {
                            const raw = (r.game_phase ?? r.status ?? prev.status);
                            const s = String(raw).toLowerCase().trim();
                            if (s === 'lobby') return 'waiting';
                            if (s === 'waiting' || s === 'boarding' || s === 'playing' || s === 'finished' || s === 'not_found') return s as any;
                            return prev.status;
                        })(),
                        pot: r.pot ?? prev.pot,
                        entryFee: r.entry_fee ?? prev.entryFee,
                        currentTurnId: r.current_turn_player_id ?? prev.currentTurnId,
                        lastBetUserId: r.last_bet_player_id !== undefined ? r.last_bet_player_id : prev.lastBetUserId,
                        currentBet: r.current_bet_quantity !== undefined
                            ? { quantity: r.current_bet_quantity, face: r.current_bet_face }
                            : prev.currentBet,
                        notificationData: r.notification_data !== undefined ? r.notification_data : prev.notificationData,
                        gameOverData: r.game_over_data !== undefined ? r.game_over_data : prev.gameOverData,
                        allowCheats: r.allow_cheats !== undefined ? r.allow_cheats : prev.allowCheats,
                        randomTurns: r.settings_random_turns !== undefined ? r.settings_random_turns : prev.randomTurns,
                        turnSequence: r.turn_sequence !== undefined ? r.turn_sequence : prev.turnSequence,
                        voteData: null
                    }));
                }

                const { data: p } = await supabase
                    .from('dice_players')
                    .select('*')
                    .eq('room_id', roomId);
                if (p) setPlayers(p);
            } catch (e) {
                console.error("Error refetch realtime:", e);
            }
        };

        fetchAll();

        const channel = supabase.channel(`room_${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dice_players',
                filter: `room_id=eq.${roomId}`
            }, () => fetchAll())
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dice_rooms',
                filter: `id=eq.${roomId}`
            }, () => fetchAll())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    // --- DETECCIÓN DE EXPULSIÓN: Redirigir si el jugador fue expulsado ---
    useEffect(() => {
        // Esperar a que termine la carga inicial y tengamos ID
        if (loading || !myId || !code) return;

        // Verificar si el jugador actual todavía existe en la lista
        const myPlayerExists = players.some(p => p.id === myId);
        
        // Solo redirigir si hay jugadores (significa que la lista cargó) pero yo no estoy
        if (!myPlayerExists && players.length > 0) {
            console.error("🚨 DETECTADA EXPULSIÓN: ID local no encontrado en lista remota.", { myId, playersIds: players.map(p => p.id) });
            // El jugador fue expulsado, redirigir
            onNotification?.('Has sido expulsado del Saloon.', 'error');
            // COMENTADO TEMPORALMENTE PARA DEBUG: Evitar redirección inmediata si es un falso positivo
            /*
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            */
        }
    }, [players, myId, code, loading]);

    // --- FUNCIÓN AUXILIAR: Barajar array (Fisher-Yates) ---
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // --- INICIO DEL JUEGO (FASE 3) ---
    const startRound = async () => {
        if (!roomId) return;
        if (!isHost) return;

        onNotification?.('Iniciando partida...', 'info');

        // Obtener jugadores actualizados (solo los que están listos)
        const { data: currentPlayers, error: playersErr } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId)
            .eq('is_ready', true)
            // `created_at` no existe en todos los esquemas
            ;

        if (playersErr) {
            notifyDbError('No se pudo leer jugadores listos', playersErr);
            return;
        }
        if (!currentPlayers || currentPlayers.length === 0) {
            onNotification?.('Aún no hay jugadores listos.', 'warning');
            return;
        }

        // Obtener configuración de la sala
        const { data: roomData, error: roomCfgErr } = await supabase
            .from('dice_rooms')
            .select('settings_random_turns')
            .eq('id', roomId)
            .single();
        if (roomCfgErr) {
            // Si la columna no existe o RLS bloquea, no detengas el juego: solo usa valor por defecto.
            console.warn('No se pudo leer settings_random_turns, usando false.', roomCfgErr);
        }

        const useRandomTurns = roomData?.settings_random_turns || false;

        // 🔒 SEGURIDAD: Calcular pot ANTES de iniciar
        // current_contribution ya no existe (economía global). Pozo = entry_fee * jugadores listos.
        const totalPot = currentPlayers.reduce((sum, p) => {
            return sum + (p.is_ready ? (gameState.entryFee || 0) : 0);
        }, 0);

        // 🔒 ACTUALIZAR POT PRIMERO y verificar que se guardó correctamente
        const { error: potError, data: potData } = await supabase
            .from('dice_rooms')
            .update({ pot: totalPot })
            .eq('id', roomId)
            .select()
            .single();

        // Si falla el UPDATE del pot, NO continuar
        if (potError || !potData || potData.pot !== totalPot) {
            if (potError) notifyDbError('No se pudo actualizar el pozo', potError);
            else onNotification?.('Error al calcular el pozo. Intenta de nuevo.', 'error');
            return;
        }

        let shuffledPlayers: typeof currentPlayers;
        let turnSequence: string[] | null = null;

        if (useRandomTurns) {
            // TURNOS ALEATORIOS: El creador siempre inicia, resto barajado
            const host = currentPlayers.find(p => (roomHostId && p.user_id === roomHostId)) || currentPlayers.find(p => p.is_host);
            const others = currentPlayers.filter(p => !p.is_host);
            const shuffledOthers = shuffleArray(others);
            
            shuffledPlayers = host ? [host, ...shuffledOthers] : currentPlayers;
            turnSequence = shuffledPlayers.map(p => p.id);
        } else {
            // ORDEN FIJO: Barajar normalmente
            shuffledPlayers = shuffleArray(currentPlayers);
            turnSequence = null;
        }

        // Asignar seat_index a cada jugador (0, 1, 2, ...)
        const seatUpdates = shuffledPlayers.map((p, index) => 
            supabase
                .from('dice_players')
                .update({ seat_index: index })
                .eq('id', p.id)
        );
        const seatResults = await Promise.all(seatUpdates);
        const seatErr = seatResults.find(r => (r as any)?.error)?.error;
        if (seatErr) {
            notifyDbError('No se pudo asignar asientos', seatErr);
            return;
        }

        // Seleccionar jugador inicial (el primero en el orden)
        const starter = shuffledPlayers[0];
        
        // Barajear dados para TODOS (5 dados iniciales)
        const diceUpdates = shuffledPlayers.map(p => {
            const newDice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
            return supabase
                .from('dice_players')
                // Resetear truco por partida si existe la columna
                .update({ dice_values: newDice, has_used_cheat: false } as any)
                .eq('id', p.id);
        });
        const diceResults = await Promise.all(diceUpdates);
        const diceErr = diceResults.find(r => (r as any)?.error)?.error;
        if (diceErr) {
            // Fallback: si la columna no existe, intentar solo dice_values
            if (diceErr.code === 'PGRST204' && `${diceErr.message || ''}`.includes('has_used_cheat')) {
                const fallbackUpdates = shuffledPlayers.map(p => {
                    const newDice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
                    return supabase.from('dice_players').update({ dice_values: newDice } as any).eq('id', p.id);
                });
                const fbResults = await Promise.all(fallbackUpdates);
                const fbErr = fbResults.find(r => (r as any)?.error)?.error;
                if (fbErr) {
                    notifyDbError('No se pudo barajear dados', fbErr);
                    return;
                }
            } else {
                notifyDbError('No se pudo barajear dados', diceErr);
                return;
            }
        }

        // ✅ SOLO AHORA cambiar el estado a 'playing' (el pot ya está guardado)
        const { error: startErr } = await supabase
            .from('dice_rooms')
            .update({ 
                game_phase: 'playing', 
                current_turn_player_id: starter.id, 
                current_bet_quantity: 0, 
                current_bet_face: 0,
                turn_sequence: turnSequence,
                last_bet_player_id: null
            })
            .eq('id', roomId);

        if (startErr) {
            notifyDbError('No se pudo iniciar la partida', startErr);
            return;
        }

        // UI optimista final
        setGameState(prev => ({
            ...prev,
            status: 'playing',
            pot: totalPot,
            currentTurnId: starter.id,
            lastBetUserId: null,
            currentBet: { quantity: 0, face: 0 },
            turnSequence: turnSequence ?? prev.turnSequence
        }));
        onNotification?.('¡Partida iniciada!', 'success');
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

    // --- FUNCIÓN: Usar Truco de Espionaje ---
    const useCheat = async (): Promise<number | null> => {
        // Verificar si los trucos están permitidos
        if (!gameState.allowCheats) {
            onNotification?.('Los trucos no están permitidos en esta sala.', 'error');
            return null;
        }

        const myPlayer = players.find(p => p.id === myId);
        if (!myPlayer) return null;

        // Verificar si ya usó el truco (persistido en DB)
        if (myPlayer.has_used_cheat) {
            onNotification?.('Ya usaste tu truco en esta partida.', 'error');
            return null;
        }

        // Verificar que hay una apuesta activa
        if (!gameState.currentBet.face || gameState.currentBet.face === 0) {
            onNotification?.('No hay apuesta activa para espiar.', 'error');
            return null;
        }

        // Obtener todos los jugadores con dados
        const { data: allPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId);

        if (!allPlayers) return null;

        // Contar dados que coinciden con la cara apostada
        // NOTA: En tu lógica actual, los 1s NO son comodines, así que solo contamos coincidencias exactas
        let totalCount = 0;
        allPlayers.forEach(p => {
            if (p.dice_values && p.dice_values.length > 0) {
                p.dice_values.forEach((die: number) => {
                    if (die === gameState.currentBet.face) {
                        totalCount++;
                    }
                });
            }
        });

        // Marcar como usado (1 vez por partida)
        const { error: cheatErr } = await supabase
            .from('dice_players')
            .update({ has_used_cheat: true } as any)
            .eq('id', myPlayer.id);
        if (cheatErr) {
            if (cheatErr.code === 'PGRST204' && `${cheatErr.message || ''}`.includes('has_used_cheat')) {
                onNotification?.('Falta la columna dice_players.has_used_cheat en la BD.', 'error');
            } else {
                notifyDbError('No se pudo marcar truco', cheatErr);
            }
            // Aun así devolver el conteo (truco “free”) si prefieres, pero por ahora lo bloqueamos
            return null;
        }

        // UI optimista
        setPlayers(prev => prev.map(p => p.id === myPlayer.id ? ({ ...p, has_used_cheat: true } as any) : p));

        return totalCount;
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

    const kickPlayer = async (targetId: string) => {
        // Solo el Host puede expulsar
        if (!isHost) {
            onNotification?.('Solo el Sheriff puede expulsar jugadores.', 'error');
            return;
        }
        if (!roomId) return;

        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId);

        if (!currentPlayers) return;

        // Expulsar directamente (acción inmediata)
        await supabase
            .from('dice_players')
            .delete()
            .eq('id', targetId);

        // Si el expulsado tenía el turno, pasar al siguiente
        if (gameState.currentTurnId === targetId) {
            const nextPlayer = getNextActivePlayer(targetId, currentPlayers);
            if (nextPlayer) {
                await supabase
                    .from('dice_rooms')
                    .update({ current_turn_player_id: nextPlayer.id })
                    .eq('id', roomId);
            }
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
        if (!roomId) return;
        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId)
            ;

        if (!currentPlayers) return;

        // Obtener configuración de la sala
        const { data: roomData } = await supabase
            .from('dice_rooms')
            .select('settings_random_turns')
            .eq('id', roomId)
            .single();

        const useRandomTurns = roomData?.settings_random_turns || false;

        const survivors = currentPlayers.filter(p => (p.dice_values?.length || 0) > 0);
        
        if (survivors.length === 1) {
            // Ya hay ganador, no hacer nada
            return;
        }

        // RE-BARAJEAR DADOS para todos los sobrevivientes
        const reShuffleUpdates = survivors.map(p => {
            const currentDiceCount = p.dice_values?.length || 5;
            const newDice = Array.from({ length: currentDiceCount }, () => 
                Math.floor(Math.random() * 6) + 1
            );
            return supabase
                .from('dice_players')
                .update({ dice_values: newDice })
                .eq('id', p.id);
        });
        await Promise.all(reShuffleUpdates);

        // Pasar turno al perdedor (o siguiente activo si el perdedor fue eliminado)
        let nextTurnPlayer = currentPlayers.find(p => p.id === loserId);
        if (!nextTurnPlayer || (nextTurnPlayer.dice_values?.length || 0) === 0) {
            nextTurnPlayer = getNextActivePlayer(loserId, currentPlayers) || survivors[0];
        }

        let turnSequence: string[] | null = null;

        if (useRandomTurns && nextTurnPlayer) {
            // TURNOS ALEATORIOS: El perdedor inicia, resto barajado
            const starter = nextTurnPlayer;
            const others = survivors.filter(p => p.id !== starter.id);
            const shuffledOthers = shuffleArray(others);
            
            turnSequence = [starter.id, ...shuffledOthers.map(p => p.id)];
        }

        if (nextTurnPlayer) {
            await supabase
            .from('dice_rooms')
                .update({ 
                    current_bet_quantity: 0, 
                    current_bet_face: 0,
                    last_bet_player_id: null,
                    current_turn_player_id: nextTurnPlayer.id,
                    notification_data: null, // Limpiar notificación
                    turn_sequence: turnSequence !== null ? turnSequence : undefined
                })
            .eq('id', roomId);
        }
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
        if (!gameState.currentTurnId) return;
        if (!roomId) return;
        const me = players.find(p => p.id === myId);
        const myUserId = me?.user_id;

        // Validar apuesta: SIEMPRE debes aumentar la cantidad, sin importar la cara
        const currentBet = gameState.currentBet;
        if (currentBet.quantity > 0) {
            // La cantidad siempre debe ser mayor que la apuesta actual
            if (qty <= currentBet.quantity) {
                onNotification?.(`Debes aumentar la cantidad. La apuesta actual es ${currentBet.quantity}, debes apostar al menos ${currentBet.quantity + 1}.`, 'error');
                return;
            }
        }

        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId)
            ;

        if (!currentPlayers) return;

        const nextPlayer = getNextActivePlayer(gameState.currentTurnId, currentPlayers);
        if (!nextPlayer) return;

        await supabase
            .from('dice_rooms')
            .update({ 
                current_bet_quantity: qty, 
                current_bet_face: face, 
                current_turn_player_id: nextPlayer.id,
                last_bet_player_id: myUserId || myId
            })
            .eq('id', roomId);

        // UI optimista del banner
        setGameState(prev => ({
            ...prev,
            currentBet: { quantity: qty, face },
            currentTurnId: nextPlayer.id,
            lastBetUserId: myUserId || myId
        }));
    };

    const resolveRound = async (action: 'LIAR' | 'EXACT') => {
        if (!gameState.currentBet.quantity || !gameState.currentBet.face) return;
        if (!gameState.currentTurnId) return;
        if (!roomId) return;

        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId)
            ;

        if (!currentPlayers) return;

        // CONTAR DADOS (SIN COMODINES - Los 1s son solo 1s)
        let totalCount = 0;
        currentPlayers.forEach(p => {
            if (p.dice_values) {
                p.dice_values.forEach((die: number) => {
                    // Solo contar si el dado coincide EXACTAMENTE con la cara apostada
                    if (die === gameState.currentBet.face) {
                        totalCount++;
                    }
                });
            }
        });

        // DETERMINAR PERDEDOR usando last_bet_player_id (auth.user.id) como fuente de verdad
        let loserId: string | null = null;
        let message = '';
        const diceEmoji = getDiceEmoji(gameState.currentBet.face);

        const bettorKey = gameState.lastBetUserId;
        const bettor =
            (bettorKey ? currentPlayers.find(p => p.user_id === bettorKey) : null) ||
            (bettorKey ? currentPlayers.find(p => p.id === bettorKey) : null) ||
            null;

        if (action === 'LIAR') {
            // Si la apuesta era TRUE (hay >= qty), pierde el acusador (yo).
            // Si la apuesta era LIE (hay < qty), pierde el que apostó (last_bet_player_id).
            if (totalCount >= gameState.currentBet.quantity) {
                loserId = myId;
                const myPlayer = currentPlayers.find(p => p.id === myId);
                message = `❌ ${myPlayer?.name || 'Tú'} es un mentiroso. Había ${totalCount} ${diceEmoji} (apostaste ${gameState.currentBet.quantity}). Pierdes 1 dado.`;
            } else {
                loserId = bettor?.id || null;
                const bettorName = bettor?.name || 'El apostador';
                message = `✅ ${bettorName} mintió. Solo había ${totalCount} ${diceEmoji} (apostó ${gameState.currentBet.quantity}). ${bettorName} pierde 1 dado.`;
            }
        } else if (action === 'EXACT') {
            // Si hay exactamente la cantidad, el acusado pierde (castigo por obvio)
            // Si NO hay exactamente esa cantidad, el acusador pierde
            if (totalCount === gameState.currentBet.quantity) {
                loserId = bettor?.id || null;
                const bettorName = bettor?.name || 'El apostador';
                message = `🎯 ¡EXACTO! Había exactamente ${totalCount} ${diceEmoji}. ${bettorName} pierde 1 dado.`;
            } else {
                loserId = myId;
                const myPlayer = currentPlayers.find(p => p.id === myId);
                message = `❌ ERROR. Había ${totalCount} ${diceEmoji} (no ${gameState.currentBet.quantity}). ${myPlayer?.name || 'Tú'} pierde 1 dado.`;
            }
        }

        if (!loserId) return;

        // Aplicar pérdida de dado
        const loser = currentPlayers.find(p => p.id === loserId);
        if (!loser || !loser.dice_values || loser.dice_values.length === 0) return;

        const newDiceCount = loser.dice_values.length - 1;
        
        if (newDiceCount === 0) {
            // Eliminar todos los dados (jugador eliminado)
            await supabase
                .from('dice_players')
                .update({ dice_values: [] })
                .eq('id', loserId);
        } else {
            // Reducir en 1 dado
            await supabase
                .from('dice_players')
                .update({ dice_values: loser.dice_values.slice(0, -1) })
                .eq('id', loserId);
        }

        // Obtener jugadores actualizados después de la pérdida
        const { data: updatedPlayers } = await supabase
            .from('dice_players')
            .select('*')
            .eq('room_id', roomId)
            ;

        if (!updatedPlayers) return;

        // Verificar si hay ganador (solo 1 jugador con dados)
        const survivors = updatedPlayers.filter(p => (p.dice_values?.length || 0) > 0);
        
        if (survivors.length === 1) {
            // ✅ Nuevo: el backend es el único que calcula ganadores y escribe dice_rooms.game_over_data
            let error = (await supabase.rpc('distribute_dice_winnings', { room_id_param: roomId } as any)).error;
            // fallback por compatibilidad si el RPC usa `code`
            if (error) error = (await supabase.rpc('distribute_dice_winnings', { room_id_param: code } as any)).error;
            if (error) {
                console.error("Error distribute_dice_winnings:", error);
                onNotification?.('Error al repartir ganancias.', 'error');
            }
        } else {
            // Determinar tipo de notificación
            const notificationType = message.includes('❌') || message.includes('ERROR') ? 'error' : 
                                     message.includes('✅') || message.includes('CORRECTO') ? 'success' :
                                     message.includes('🎯') || message.includes('EXACTO') ? 'success' : 'info';
            
            // 🚫 NO USAR onRoundResult (callback local)
            // ✅ GUARDAR EN SUPABASE para que todos lo vean
            const notificationData: NotificationData = {
                message,
                type: notificationType,
                loserId: loserId,
                timestamp: Date.now()
            };

            await supabase
                .from('dice_rooms')
                .update({ notification_data: notificationData, last_bet_player_id: null })
                .eq('id', roomId);
        }
    };

    return {
        players,
        myId,
        loading, // Exponer estado de carga
        gameState,
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
