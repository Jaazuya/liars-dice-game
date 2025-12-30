import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { Player, GameState, VoteData, NotificationData } from '@/app/types/game';

export const useLiarGame = (
    code: string, 
    onNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void,
    onRoundResult?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', onClose?: () => void) => void
) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [myId, setMyId] = useState<string>('');
    const [gameState, setGameState] = useState<GameState>({
        status: 'waiting',
        pot: 0,
        entryFee: 100,
        currentTurnId: null,
        currentBet: { quantity: 0, face: 0 },
        voteData: null,
        notificationData: null
    });

    // Ref para evitar múltiples ejecuciones del auto-start
    const hasCheckedAllReady = useRef(false);
    // Ref para evitar múltiples timeouts de notificación
    const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const getDiceEmoji = (num: number) => ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][num] || '?';

    // --- CARGA DE DATOS Y SUSCRIPCIONES ---
    useEffect(() => {
        if (!code) return;
        const storedId = localStorage.getItem('playerId');
        if (storedId) setMyId(storedId);

        const fetchAll = async () => {
            const { data: p } = await supabase
                .from('players')
                .select('*')
                .eq('room_code', code)
                .order('created_at', { ascending: true });
            if (p) setPlayers(p);

            const { data: r } = await supabase
                .from('rooms')
                .select('*')
                .eq('code', code)
                .single();
            if (r) {
                setGameState(prev => ({
                    ...prev,
                    status: r.status,
                    pot: r.pot || 0,
                    entryFee: r.entry_fee || 100,
                    currentTurnId: r.current_turn_player_id,
                    currentBet: { 
                        quantity: r.current_bet_quantity || 0, 
                        face: r.current_bet_face || 0 
                    },
                    voteData: r.kick_vote_data,
                    notificationData: r.notification_data || null
                }));
            }
        };

        fetchAll();

        const channel = supabase.channel(`room_${code}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'players', 
                filter: `room_code=eq.${code}` 
            }, () => {
                fetchAll();
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'rooms', 
                filter: `code=eq.${code}` 
            }, (payload) => {
                const r = payload.new as any;
                setGameState(prev => ({
                    ...prev,
                    status: r.status,
                    pot: r.pot,
                    entryFee: r.entry_fee,
                    currentTurnId: r.current_turn_player_id,
                    voteData: r.kick_vote_data,
                    currentBet: r.current_bet_quantity !== undefined 
                        ? { quantity: r.current_bet_quantity, face: r.current_bet_face } 
                        : prev.currentBet,
                    notificationData: r.notification_data !== undefined ? r.notification_data : prev.notificationData
                }));
            })
            .subscribe();

        return () => { 
            supabase.removeChannel(channel); 
        };
    }, [code]);

    // --- INICIO DEL JUEGO (FASE 3) ---
    const startRound = async () => {
        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', code)
            .order('created_at', { ascending: true });

        if (!currentPlayers || currentPlayers.length === 0) return;

        // Seleccionar jugador inicial aleatorio
        const starter = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
        
        // Barajear dados para TODOS (5 dados iniciales)
        const diceUpdates = currentPlayers.map(p => {
            const newDice = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
            return supabase
                .from('players')
                .update({ dice_values: newDice })
                .eq('id', p.id);
        });
        await Promise.all(diceUpdates);

        // Calcular pot total (suma de todas las contribuciones)
        const totalPot = currentPlayers.reduce((sum, p) => {
            return sum + (p.current_contribution || 0);
        }, 0);

        // Iniciar juego
        await supabase
            .from('rooms')
            .update({ 
                status: 'playing', 
                current_turn_player_id: starter.id, 
                current_bet_quantity: 0, 
                current_bet_face: 0,
                pot: totalPot
            })
            .eq('code', code);
    };

    // --- AUTO-INICIO DEL JUEGO (Cuando todos están listos) ---
    useEffect(() => {
        if (gameState.status !== 'boarding' || players.length === 0) {
            hasCheckedAllReady.current = false;
            return;
        }

        const allReady = players.every(p => p.is_ready);
        const myPlayer = players.find(p => p.id === myId);
        
        // Solo el host puede iniciar el juego
        if (allReady && myPlayer?.is_host && !hasCheckedAllReady.current) {
            hasCheckedAllReady.current = true;
            startRound();
        } else if (!allReady) {
            hasCheckedAllReady.current = false;
        }
    }, [players, gameState.status, myId, code]);

    // --- ACCIONES FASE 1: LOBBY ---

    const updateEntryFee = async (amount: number) => {
        if (amount < 0) return;
        await supabase
            .from('rooms')
            .update({ entry_fee: amount })
            .eq('code', code);
    };

    const openTable = async () => {
        // Reiniciar estado de listos de todos
        await Promise.all(
            players.map(p => 
                supabase
                    .from('players')
                    .update({ is_ready: false })
                    .eq('id', p.id)
            )
        );
        await supabase
            .from('rooms')
            .update({ status: 'boarding' })
            .eq('code', code);
    };

    // --- ACCIONES FASE 2: BOARDING ---

    const payEntry = async (): Promise<boolean> => {
        const me = players.find(p => p.id === myId);
        if (!me || me.money < gameState.entryFee) return false;

        // Descontar dinero y marcar ready
        const { error } = await supabase
            .from('players')
            .update({ 
                money: me.money - gameState.entryFee,
                current_contribution: gameState.entryFee,
                is_ready: true
            })
            .eq('id', me.id);

        return !error;
    };

    // --- SISTEMA DE EXPULSIÓN (VOTE KICK) ---

    const startKickVote = async (targetId: string, targetName: string) => {
        const voteData: VoteData = {
            target_id: targetId,
            initiator_id: myId,
            target_name: targetName,
            votes: { [myId]: true }
        };
        await supabase
            .from('rooms')
            .update({ kick_vote_data: voteData })
            .eq('code', code);
    };

    const castVote = async (vote: boolean) => {
        if (!gameState.voteData) return;
        
        const newVotes = { ...gameState.voteData.votes, [myId]: vote };
        const currentVoteData = { ...gameState.voteData, votes: newVotes };

        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', code);

        if (!currentPlayers) return;

        const totalPlayers = currentPlayers.length;
        const totalVotes = Object.keys(newVotes).length;
        const yesVotes = Object.values(newVotes).filter(v => v).length;
        const noVotes = Object.values(newVotes).filter(v => !v).length;
        
        // Umbral: Mayoría simple (> 50%)
        const threshold = Math.floor(totalPlayers / 2) + 1;

        if (yesVotes >= threshold) {
            // EXPULSAR
            await supabase
                .from('players')
                .delete()
                .eq('id', gameState.voteData.target_id);
            await supabase
                .from('rooms')
                .update({ kick_vote_data: null })
                .eq('code', code);
            
            // Si el expulsado tenía el turno, pasar al siguiente
            if (gameState.currentTurnId === gameState.voteData.target_id) {
                const nextPlayer = getNextActivePlayer(gameState.voteData.target_id, currentPlayers);
                if (nextPlayer) {
                    await supabase
                        .from('rooms')
                        .update({ current_turn_player_id: nextPlayer.id })
                        .eq('code', code);
                }
            }
        } else if (noVotes >= threshold || totalVotes === totalPlayers) {
            // FALLÓ LA VOTACIÓN
            await supabase
                .from('rooms')
                .update({ kick_vote_data: null })
                .eq('code', code);
        } else {
            // SEGUIR VOTANDO
            await supabase
                .from('rooms')
                .update({ kick_vote_data: currentVoteData })
                .eq('code', code);
        }
    };

    // --- FUNCIÓN AUXILIAR: Obtener siguiente jugador activo ---
    const getNextActivePlayer = (currentPlayerId: string, playerList: Player[]): Player | null => {
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
        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', code)
            .order('created_at', { ascending: true });

        if (!currentPlayers) return;

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
                .from('players')
                .update({ dice_values: newDice })
                .eq('id', p.id);
        });
        await Promise.all(reShuffleUpdates);

        // Pasar turno al perdedor (o siguiente activo si el perdedor fue eliminado)
        let nextTurnPlayer = currentPlayers.find(p => p.id === loserId);
        if (!nextTurnPlayer || (nextTurnPlayer.dice_values?.length || 0) === 0) {
            nextTurnPlayer = getNextActivePlayer(loserId, currentPlayers) || survivors[0];
        }

        if (nextTurnPlayer) {
            await supabase
                .from('rooms')
                .update({ 
                    current_bet_quantity: 0, 
                    current_bet_face: 0,
                    current_turn_player_id: nextTurnPlayer.id,
                    notification_data: null // Limpiar notificación
                })
                .eq('code', code);
        }
    };

    // --- CONTROL DE TIEMPO: El Host ejecuta handleNextRound después de 5 segundos ---
    useEffect(() => {
        const myPlayer = players.find(p => p.id === myId);
        const isHost = myPlayer?.is_host || false;

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
    }, [gameState.notificationData, players, myId, gameState.status, code]);

    // --- LÓGICA DE JUEGO: APUESTAS Y RESOLUCIÓN ---

    const placeBet = async (qty: number, face: number) => {
        if (!gameState.currentTurnId) return;

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
            .from('players')
            .select('*')
            .eq('room_code', code)
            .order('created_at', { ascending: true });

        if (!currentPlayers) return;

        const nextPlayer = getNextActivePlayer(gameState.currentTurnId, currentPlayers);
        if (!nextPlayer) return;

        await supabase
            .from('rooms')
            .update({ 
                current_bet_quantity: qty, 
                current_bet_face: face, 
                current_turn_player_id: nextPlayer.id 
            })
            .eq('code', code);
    };

    const resolveRound = async (action: 'LIAR' | 'EXACT') => {
        if (!gameState.currentBet.quantity || !gameState.currentBet.face) return;
        if (!gameState.currentTurnId) return;

        // Obtener jugadores actualizados
        const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', code)
            .order('created_at', { ascending: true });

        if (!currentPlayers) return;

        // Encontrar al acusado (el jugador anterior que hizo la apuesta)
        const myIndex = currentPlayers.findIndex(p => p.id === myId);
        if (myIndex === -1) return;

        let prevIndex = (myIndex - 1 + currentPlayers.length) % currentPlayers.length;
        while ((currentPlayers[prevIndex].dice_values?.length || 0) === 0) {
            prevIndex = (prevIndex - 1 + currentPlayers.length) % currentPlayers.length;
            if (prevIndex === myIndex) return; // Evitar bucle infinito
        }
        const accused = currentPlayers[prevIndex];

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

        // DETERMINAR PERDEDOR según la acción
        let loserId: string | null = null;
        let message = '';
        const diceEmoji = getDiceEmoji(gameState.currentBet.face);

        if (action === 'LIAR') {
            // Si hay >= cantidad apostada, el acusador (yo) pierde
            // Si hay < cantidad apostada, el acusado pierde
            if (totalCount >= gameState.currentBet.quantity) {
                loserId = myId;
                const myPlayer = currentPlayers.find(p => p.id === myId);
                message = `❌ ${myPlayer?.name || 'Tú'} es un mentiroso. Había ${totalCount} ${diceEmoji} (apostaste ${gameState.currentBet.quantity}). Pierdes 1 dado.`;
            } else {
                loserId = accused.id;
                message = `✅ ${accused.name} es un mentiroso. Solo había ${totalCount} ${diceEmoji} (apostó ${gameState.currentBet.quantity}). ${accused.name} pierde 1 dado.`;
            }
        } else if (action === 'EXACT') {
            // Si hay exactamente la cantidad, el acusado pierde (castigo por obvio)
            // Si NO hay exactamente esa cantidad, el acusador pierde
            if (totalCount === gameState.currentBet.quantity) {
                loserId = accused.id;
                message = `🎯 ¡EXACTO! Había exactamente ${totalCount} ${diceEmoji}. ${accused.name} pierde 1 dado.`;
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
                .from('players')
                .update({ dice_values: [] })
                .eq('id', loserId);
        } else {
            // Reducir en 1 dado
            await supabase
                .from('players')
                .update({ dice_values: loser.dice_values.slice(0, -1) })
                .eq('id', loserId);
        }

        // Obtener jugadores actualizados después de la pérdida
        const { data: updatedPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_code', code)
            .order('created_at', { ascending: true });

        if (!updatedPlayers) return;

        // Verificar si hay ganador (solo 1 jugador con dados)
        const survivors = updatedPlayers.filter(p => (p.dice_values?.length || 0) > 0);
        
        if (survivors.length === 1) {
            // ¡HAY GANADOR!
            const winner = survivors[0];
            const { data: roomData } = await supabase
                .from('rooms')
                .select('pot')
                .eq('code', code)
                .single();

            const potAmount = roomData?.pot || 0;

            // Dar dinero al ganador
            await supabase
                .from('players')
                .update({ 
                    money: winner.money + potAmount,
                    current_contribution: 0
                })
                .eq('id', winner.id);

            // Limpiar todos los dados y contribuciones
            await Promise.all(
                updatedPlayers.map(p => 
                    supabase
                        .from('players')
                        .update({ 
                            dice_values: null, 
                            current_contribution: 0 
                        })
                        .eq('id', p.id)
                )
            );

            // Volver a estado waiting
            await supabase
                .from('rooms')
                .update({ 
                    status: 'waiting', 
                    pot: 0, 
                    current_bet_quantity: 0,
                    current_bet_face: 0,
                    current_turn_player_id: null,
                    notification_data: null
                })
                .eq('code', code);

            // Mostrar mensaje grande para el ganador (local)
            onNotification?.(`🏆 ¡GANADOR: ${winner.name}! Se lleva $${potAmount}`, 'success');
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
                .from('rooms')
                .update({ notification_data: notificationData })
                .eq('code', code);
        }
    };

    return {
        players,
        myId,
        gameState,
        getDiceEmoji,
        actions: {
            updateEntryFee,
            openTable,
            payEntry,
            placeBet,
            resolveRound,
            startKickVote,
            castVote
        }
    };
};
