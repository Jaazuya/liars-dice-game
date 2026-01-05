import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/lib/supabase'; 
import { User, RealtimeChannel } from '@supabase/supabase-js';
import { checkPattern, PATTERN_POINTS, WinPattern, PATTERN_NAMES } from '../loteria/utils/validation';
import { NORMALIZED_LOTERIA_BOARDS } from '../loteria/utils/boards';

export interface LoteriaRoomState {
  room_code: string;
  is_playing: boolean;
  current_card: number | null;
  drawn_cards: number[];
  last_update: string;
  claimed_awards?: Record<string, boolean>;
  last_game_event?: { message: string; type: 'success' | 'error'; timestamp: number } | null;
  rooms?: { host_id: string; status: string; } | null;
}

interface LoteriaPlayer {
  room_code: string;
  user_id: string;
  board_cards: number[];
  marked_cards: number[];
  score?: number;
}

export interface LoteriaLeaderboardEntry {
  user_id: string;
  name: string;
  score: number;
}

export const useLoteriaGame = (roomCode: string, user: User | null) => {
  const [loteriaRoom, setLoteriaRoom] = useState<LoteriaRoomState | null>(null);
  const [myBoard, setMyBoard] = useState<LoteriaPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastNotification, setLastNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [playersScores, setPlayersScores] = useState<Record<string, number>>({});
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [joinError, setJoinError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    // 1. Obtener datos de la sala
    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from('loteria_rooms')
        .select('*, rooms(host_id, status)')
        .eq('room_code', roomCode)
        .single();

      if (data) setLoteriaRoom(data as any);
      setLoading(false);
    };
    fetchRoom();

    // 2. Obtener o Crear Tablero y Puntuaciones iniciales
    const fetchOrCreateBoard = async () => {
      // Fetch ALL scores + usernames first (leaderboard)
      const { data: allScores } = await supabase
        .from('loteria_players')
        // profiles(username) funciona si la FK loteria_players.user_id -> profiles.id existe
        .select('user_id, score, profiles(username)')
        .eq('room_code', roomCode) as any;

      // Fetch boards in this room to know which "tabla" indices are already taken
      const { data: existingBoards } = await supabase
        .from('loteria_players')
        .select('board_cards')
        .eq('room_code', roomCode) as any;
      
      if (allScores) {
        const scoresMap: Record<string, number> = {};
        const namesMap: Record<string, string> = {};
        allScores.forEach((p: any) => { 
          scoresMap[p.user_id] = p.score || 0; 
          const username = p?.profiles?.username;
          if (username) namesMap[p.user_id] = username;
        });
        setPlayersScores(scoresMap);
        setPlayerNames(prev => ({ ...prev, ...namesMap }));
      }

      if (!user?.id) return;
      setJoinError(null);
      
      const { data } = await supabase
        .from('loteria_players')
        .select('*')
        .eq('room_code', roomCode)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setMyBoard(data);
      } else {
        // Capacidad máxima: 10 tableros oficiales
        const currentPlayersCount = Array.isArray(allScores) ? allScores.length : 0;
        if (currentPlayersCount >= 10) {
          const msg = "La sala está llena (Tablas originales agotadas)";
          setJoinError(msg);
          setLastNotification({ message: msg, type: 'error' });
          setTimeout(() => setLastNotification(null), 5000);
          return;
        }

        // Determinar tableros ya asignados (por comparación con las tablas normalizadas)
        const usedIndices = new Set<number>();
        if (Array.isArray(existingBoards)) {
          for (const row of existingBoards) {
            const bc = row?.board_cards;
            if (!Array.isArray(bc) || bc.length !== 16) continue;
            const idx = NORMALIZED_LOTERIA_BOARDS.findIndex((b) => b.length === 16 && b.every((v, i) => v === bc[i]));
            if (idx >= 0) usedIndices.add(idx);
          }
        }

        const availableIndices = NORMALIZED_LOTERIA_BOARDS
          .map((_, idx) => idx)
          .filter((idx) => !usedIndices.has(idx));

        if (availableIndices.length === 0) {
          const msg = "La sala está llena (Tablas originales agotadas)";
          setJoinError(msg);
          setLastNotification({ message: msg, type: 'error' });
          setTimeout(() => setLastNotification(null), 5000);
          return;
        }

        // Selección aleatoria de tablero disponible
        const pickedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        const newBoardCards = NORMALIZED_LOTERIA_BOARDS[pickedIndex];

        if (!Array.isArray(newBoardCards) || newBoardCards.length !== 16) {
          const msg = "Error: Tablas originales mal configuradas (normalización falló).";
          setJoinError(msg);
          setLastNotification({ message: msg, type: 'error' });
          setTimeout(() => setLastNotification(null), 5000);
          return;
        }

        console.log(`Asignando TABLA OFICIAL (random) #${pickedIndex + 1} a user_id=${user.id}`);
        const { data: newData } = await supabase
          .from('loteria_players')
          .insert({
            room_code: roomCode,
            user_id: user.id,
            board_cards: newBoardCards,
            marked_cards: [],
            score: 0
          })
          .select()
          .single();
        if (newData) setMyBoard(newData);
      }
    };
    fetchOrCreateBoard();

    // 3. Suscripción Realtime
    console.log(`🔌 Suscribiendo a canal loteria_${roomCode}...`);
    const channel = supabase
      .channel(`loteria_${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'loteria_rooms' },
        (payload) => {
          const newRoom = payload.new as LoteriaRoomState;
          if (newRoom.room_code !== roomCode) return;
          
          console.log("🔔 UPDATE loteria_rooms:", newRoom);
          
          setLoteriaRoom((prev) => {
            // Detect Notification Change
            if (newRoom.last_game_event && prev?.last_game_event?.timestamp !== newRoom.last_game_event.timestamp) {
               console.log("🔔 Notification detected:", newRoom.last_game_event);
               setLastNotification(newRoom.last_game_event);
               
               // Auto-close after 5s
               setTimeout(() => setLastNotification(null), 5000);
            }
            if (!prev) return null;
            return { ...prev, ...newRoom as any };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loteria_players' },
        async (payload) => {
          const newPlayer = payload.new as LoteriaPlayer;
          if (newPlayer.room_code !== roomCode) return;

          // Actualizar scores globales
          setPlayersScores(prev => ({
            ...prev,
            [newPlayer.user_id]: newPlayer.score || 0
          }));

          // Si no tenemos nombre aún, intentar obtenerlo de profiles
          if (!playerNames[newPlayer.user_id]) {
            supabase
              .from('profiles')
              .select('username')
              .eq('id', newPlayer.user_id)
              .single()
              .then(({ data }) => {
                if (data?.username) {
                  setPlayerNames(prev => ({ ...prev, [newPlayer.user_id]: data.username }));
                }
              });
          }

          // Actualizar mi tablero si soy yo
          if (user?.id && newPlayer.user_id === user.id) {
            console.log("🔔 UPDATE myBoard:", newPlayer);
            setMyBoard(newPlayer);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Estado suscripción ${roomCode}:`, status);
        if (status === 'SUBSCRIBED') {
           console.log("✅ Conectado a Realtime");
        }
      });
    
    channelRef.current = channel;

    return () => { 
      console.log("🔌 Desconectando canal...");
      supabase.removeChannel(channel); 
      channelRef.current = null;
    };
  }, [roomCode, user?.id]);

  // --- ACCIONES DEL HOST ---

  const startGame = async () => {
    if (!loteriaRoom) return;
    
    // 1. Actualización Optimista
    setLoteriaRoom(prev => prev ? { 
        ...prev, 
        is_playing: true, 
        current_card: null, 
        drawn_cards: [],
        claimed_awards: {},
        last_game_event: null
    } : null);
    
    // Reset local board too (optimistic)
    if (myBoard) {
        setMyBoard({ ...myBoard, marked_cards: [], score: 0 });
    }

    // 2. Call RPC for Hard Reset
    const { error } = await supabase.rpc('reset_loteria_room', { p_room_code: roomCode });

    if (error) {
        console.error("❌ RPC Reset failed, falling back to manual update:", JSON.stringify(error, null, 2));
        
        const updateRoom = supabase.from('loteria_rooms').update({
          is_playing: true,
          current_card: null,
          drawn_cards: [],
          claimed_awards: {}, 
          last_game_event: { message: "¡JUEGO REINICIADO!", type: "success", timestamp: 0 },
          last_update: new Date().toISOString()
        }).eq('room_code', roomCode);

        const updatePlayers = supabase.from('loteria_players')
            .update({ marked_cards: [], score: 0 })
            .eq('room_code', roomCode);
        
        await Promise.all([updateRoom, updatePlayers]);
    }
  };

  const updateGameCard = async (cardId: number | null, newDrawnCards: number[]) => {
    supabase.from('loteria_rooms').update({
      current_card: cardId,
      drawn_cards: newDrawnCards,
      last_update: new Date().toISOString()
    }).eq('room_code', roomCode).then(({ error }) => {
      if (error) console.error("Error sincronizando carta:", error);
    });
  };
  
  const resetGame = async () => {
    await startGame();
  };

  // --- ACCIONES DEL JUGADOR ---

  const markCard = async (cardId: number) => {
    if (!user?.id || !myBoard || !loteriaRoom) return;
    
    if (!myBoard.board_cards.includes(cardId)) return;
    if (myBoard.marked_cards.includes(cardId)) return;

    const newMarkedCards = [...myBoard.marked_cards, cardId];
    
    // Optimistic Update
    setMyBoard(prev => prev ? { ...prev, marked_cards: newMarkedCards } : null);

    await supabase.from('loteria_players').update({ marked_cards: newMarkedCards }).eq('room_code', roomCode).eq('user_id', user.id);
  };

  const claimAward = async (pattern: WinPattern) => {
    if (!loteriaRoom || !myBoard || !user) return;
    
    // 1. Optimistic Check: Exclusivity
    if (loteriaRoom.claimed_awards?.[pattern]) {
       setLastNotification({ message: "¡Ya fue reclamado!", type: 'error' });
       setTimeout(() => setLastNotification(null), 3000);
       return;
    }

    // 2. Validate
    const isValid = checkPattern(pattern, myBoard.board_cards, loteriaRoom.drawn_cards);
    const points = isValid ? PATTERN_POINTS[pattern] : -PATTERN_POINTS[pattern];
    
    // Get fresh score from DB or fallback to local + optimistic increment
    const currentScore = myBoard.score || 0;
    const newScore = currentScore + points;
    
    // Optimistic Score Update (Immediate)
    setMyBoard(prev => prev ? { ...prev, score: newScore } : null);
    setPlayersScores(prev => ({ ...prev, [user.id]: newScore }));

    const newClaimedAwards = isValid ? { ...(loteriaRoom.claimed_awards || {}), [pattern]: true } : (loteriaRoom.claimed_awards || {});
    
    // 3. Prepare DB Notification
    const playerName = playerNames[user.id] || user.email?.split('@')[0] || 'Jugador';
    const message = isValid 
      ? `✅ ${playerName} completó ${PATTERN_NAMES[pattern].toUpperCase()} (+${points} pts)`
      : `❌ ${playerName} MINTIÓ sobre ${PATTERN_NAMES[pattern].toUpperCase()} (${points} pts)`;
    const eventPayload = { message, type: isValid ? 'success' : 'error' as const, timestamp: Date.now() };

    // 4. Update DB
    
    // Update Score ATOMICALLY via RPC
    supabase.rpc('update_player_score', {
      p_room_code: roomCode,
      p_user_id: user.id,
      p_points: points
    }).then(({ data: serverScore, error }) => {
       if(error) {
         console.error("Error updating score via RPC:", error);
       } else if (serverScore !== null) {
         // Sync authoritative score
         setMyBoard(prev => prev ? { ...prev, score: serverScore } : null);
       }
    });

    // Update Room (Notification + Awards)
    // Especial: Si es Llenas Valid, mandamos notificacion y esperamos antes de terminar juego
    if (isValid && pattern === 'llenas') {
        const roomUpdates: any = { 
            last_game_event: eventPayload,
            claimed_awards: newClaimedAwards
        };
        await supabase.from('loteria_rooms').update(roomUpdates).eq('room_code', roomCode);
        
        // Retrasar el fin del juego 5s para que se vea el toast
        setTimeout(async () => {
             // Usar RPC para asegurar permisos de escritura
             const { error } = await supabase.rpc('finish_loteria_game', { p_room_code: roomCode });
             if (error) console.error("Error ending game:", error);
        }, 5000);

    } else {
        // Normal update
        const roomUpdates: any = { last_game_event: eventPayload };
        if (isValid) {
          roomUpdates.claimed_awards = newClaimedAwards;
        }
        supabase.from('loteria_rooms')
            .update(roomUpdates)
            .eq('room_code', roomCode)
            .then(({error}) => { if(error) console.error("Error update room notification", error); });
    }
  };

  const returnToLobby = async () => {
     const { error } = await supabase.rpc('return_to_lobby', { p_room_code: roomCode });
     if (error) console.error("Error returning to lobby:", error);
  };

  const closeNotification = () => setLastNotification(null);

  const isHost = user?.id === loteriaRoom?.rooms?.host_id;

  const leaderboard: LoteriaLeaderboardEntry[] = Object.entries(playersScores)
    .map(([user_id, score]) => ({
      user_id,
      name: playerNames[user_id] || 'Jugador',
      score: score || 0
    }))
    .sort((a, b) => b.score - a.score);
  
  return {
    loteriaRoom,
    myBoard,
    currentCard: loteriaRoom?.current_card,
    loading,
    markCard,
    isHost,
    startGame,
    updateGameCard,
    resetGame,
    returnToLobby, // Exposed
    claimAward,
    lastNotification,
    closeNotification,
    playersScores,
    leaderboard,
    joinError
  };
};
