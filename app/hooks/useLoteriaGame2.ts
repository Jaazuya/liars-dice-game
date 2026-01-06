import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { RealtimeChannel, User } from '@supabase/supabase-js';
import { checkPattern, PATTERN_NAMES, PATTERN_POINTS, WinPattern } from '../loteria/utils/validation';
import { NORMALIZED_LOTERIA_BOARDS } from '../loteria/utils/boards';

export interface LoteriaRoomState {
  id?: string; // UUID (si existe en la tabla)
  room_code: string;
  is_playing: boolean;
  current_card: number | null;
  drawn_cards: number[];
  last_update: string;
  claimed_awards?: Record<string, boolean>;
  last_game_event?: { message: string; type: 'success' | 'error'; timestamp: number } | null;
  host_id?: string;
  entry_fee?: number;
  game_speed_ms?: number;
  enabled_patterns?: WinPattern[];
  game_over_data?: any; // WinnerData[] (backend)
}

interface LoteriaPlayer {
  room_code: string;
  user_id: string;
  board_cards: number[];
  marked_cards: number[];
  score?: number;
  has_paid?: boolean;
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
  const [lastNotification, setLastNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [playersScores, setPlayersScores] = useState<Record<string, number>>({});
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [playersPaymentStatus, setPlayersPaymentStatus] = useState<Record<string, boolean>>({});
  const [joinError, setJoinError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const winningsTriggeredRef = useRef(false);
  const winningsTimeoutRef = useRef<any>(null);
  const ignoreGameOverRef = useRef(false);

  const notifyDbError = (prefix: string, error: any) => {
    if (!error) return;
    // A veces Supabase trae errores con props no-enumerables o incluso objetos vacíos;
    // logeamos metadata adicional para poder diagnosticar (RLS / tipos / params).
    const ownKeys = (() => {
      try {
        return Object.getOwnPropertyNames(error);
      } catch {
        return [];
      }
    })();
    const safe = {
      type: typeof error,
      asString: (() => {
        try {
          return String(error);
        } catch {
          return '';
        }
      })(),
      keys: ownKeys,
      message: (error as any)?.message,
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      status: (error as any)?.status
    };
    console.error(prefix, safe, error);

    const msg =
      typeof safe.message === 'string' && safe.message.length > 0
        ? safe.message
        : (safe.asString && safe.asString !== '[object Object]' ? safe.asString : 'Error desconocido (revisa consola).');

    setLastNotification({ message: `${prefix}: ${msg}`, type: 'error' });
    setTimeout(() => setLastNotification(null), 4000);
  };

  useEffect(() => {
    if (!roomCode) return;

    const fetchRoom = async () => {
      const { data } = await supabase
        .from('loteria_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .single();

      if (data) setLoteriaRoom(data as any);
      setLoading(false);
    };

    const fetchOrCreateBoard = async () => {
      const { data: allPlayers } = await supabase
        .from('loteria_players')
        .select('user_id, score, has_paid, profiles(username)')
        .eq('room_code', roomCode) as any;

      const { data: existingBoards } = await supabase
        .from('loteria_players')
        .select('board_cards')
        .eq('room_code', roomCode) as any;

      if (allPlayers) {
        const scoresMap: Record<string, number> = {};
        const namesMap: Record<string, string> = {};
        const paymentMap: Record<string, boolean> = {};

        allPlayers.forEach((p: any) => {
          scoresMap[p.user_id] = p.score || 0;
          paymentMap[p.user_id] = p.has_paid || false;
          const username = p?.profiles?.username;
          if (username) namesMap[p.user_id] = username;
        });

        setPlayersScores(scoresMap);
        setPlayersPaymentStatus(paymentMap);
        setPlayerNames(prev => ({ ...prev, ...namesMap }));
      }

      if (!user?.id) return;
      setJoinError(null);

      const { data: me } = await supabase
        .from('loteria_players')
        .select('*')
        .eq('room_code', roomCode)
        .eq('user_id', user.id)
        .single();

      if (me) {
        setMyBoard(me);
        return;
      }

      const currentPlayersCount = Array.isArray(allPlayers) ? allPlayers.length : 0;
      if (currentPlayersCount >= 10) {
        const msg = 'La sala está llena (Tablas originales agotadas)';
        setJoinError(msg);
        setLastNotification({ message: msg, type: 'error' });
        setTimeout(() => setLastNotification(null), 5000);
        return;
      }

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
        const msg = 'La sala está llena (Tablas originales agotadas)';
        setJoinError(msg);
        setLastNotification({ message: msg, type: 'error' });
        setTimeout(() => setLastNotification(null), 5000);
        return;
      }

      const pickedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      const newBoardCards = NORMALIZED_LOTERIA_BOARDS[pickedIndex];
      if (!Array.isArray(newBoardCards) || newBoardCards.length !== 16) {
        const msg = 'Error: Tablas originales mal configuradas.';
        setJoinError(msg);
        setLastNotification({ message: msg, type: 'error' });
        setTimeout(() => setLastNotification(null), 5000);
        return;
      }

      const { data: inserted } = await supabase
        .from('loteria_players')
        .insert({
          room_code: roomCode,
          user_id: user.id,
          board_cards: newBoardCards,
          marked_cards: [],
          score: 0,
          has_paid: false
        })
        .select()
        .single();

      if (inserted) setMyBoard(inserted);
    };

    fetchRoom();
    fetchOrCreateBoard();

    const channel = supabase
      .channel(`loteria_${roomCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loteria_rooms' }, (payload) => {
        const newRoom = payload.new as LoteriaRoomState;
        if (newRoom.room_code !== roomCode) return;

        setLoteriaRoom(prev => {
          // Si el host presionó "Nueva Partida", ignoramos actualizaciones tardías (ej. el RPC de premios)
          // que vuelven a escribir `game_over_data`/`claimed_awards` y nos regresan a la pantalla de win.
          if (ignoreGameOverRef.current) {
            const merged: any = prev ? ({ ...prev, ...newRoom as any }) : (newRoom as any);
            const sanitized: any = { ...merged, game_over_data: null, claimed_awards: {} };

            const cleared =
              (!sanitized.game_over_data || (Array.isArray(sanitized.game_over_data) && sanitized.game_over_data.length === 0)) &&
              (!sanitized.claimed_awards || Object.keys(sanitized.claimed_awards).length === 0) &&
              (sanitized.entry_fee ?? 0) === 0 &&
              sanitized.is_playing === false;

            if (cleared) ignoreGameOverRef.current = false;
            return sanitized;
          }

          if (newRoom.last_game_event && prev?.last_game_event?.timestamp !== newRoom.last_game_event.timestamp) {
            setLastNotification(newRoom.last_game_event);
            setTimeout(() => setLastNotification(null), 5000);
          }
          if (!prev) return newRoom as any;
          return { ...prev, ...newRoom as any };
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loteria_players' }, async (payload) => {
        const newPlayer = payload.new as LoteriaPlayer;
        if (newPlayer.room_code !== roomCode) return;

        setPlayersScores(prev => ({ ...prev, [newPlayer.user_id]: newPlayer.score || 0 }));
        setPlayersPaymentStatus(prev => ({ ...prev, [newPlayer.user_id]: newPlayer.has_paid || false }));

        if (!playerNames[newPlayer.user_id]) {
          supabase
            .from('profiles')
            .select('username')
            .eq('id', newPlayer.user_id)
            .single()
            .then(({ data }) => {
              if (data?.username) setPlayerNames(prev => ({ ...prev, [newPlayer.user_id]: data.username }));
            });
        }

        if (user?.id && newPlayer.user_id === user.id) setMyBoard(newPlayer);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, user?.id]);

  useEffect(() => {
    if (!loteriaRoom) return;
    const amHost = user?.id === loteriaRoom?.host_id;
    if (!amHost) return;
    if (winningsTriggeredRef.current) return;

    const ll = !!loteriaRoom.claimed_awards?.['llenas'];
    const hasResult = Array.isArray(loteriaRoom.game_over_data)
      ? loteriaRoom.game_over_data.length > 0
      : !!loteriaRoom.game_over_data;
    if (!ll || hasResult) return;

    winningsTriggeredRef.current = true;

    winningsTimeoutRef.current = setTimeout(async () => {
      // Igual que el pago: intentar con id/room_id/room_code y loggear error útil.
      const candidates = [
        (loteriaRoom as any)?.id,
        (loteriaRoom as any)?.room_id,
        roomCode
      ].filter((v, i, arr) => typeof v === 'string' && v.length > 0 && arr.indexOf(v) === i) as string[];

      let lastErr: any = null;
      let ok = false;
      for (const roomIdParam of candidates) {
        const r = await supabase.rpc('distribute_loteria_winnings', { room_id_param: roomIdParam } as any);
        if (!r.error) { ok = true; break; }
        lastErr = r.error;
      }

      if (!ok) {
        // fallback por compatibilidad (algunos SQL usan p_room_code)
        const r2 = await supabase.rpc('distribute_loteria_winnings', { p_room_code: roomCode } as any);
        if (!r2.error) ok = true;
        else lastErr = r2.error;
      }

      if (!ok) notifyDbError('No se pudieron repartir premios', lastErr);
    }, 3000);
  }, [loteriaRoom?.claimed_awards?.['llenas'], loteriaRoom?.game_over_data, loteriaRoom?.host_id, user?.id, roomCode]);

  const startGame = async () => {
    if (!loteriaRoom) return;

    setLoteriaRoom(prev => prev ? ({
      ...prev,
      is_playing: true,
      current_card: null,
      drawn_cards: [],
      claimed_awards: {},
      last_game_event: null,
      game_over_data: null
    }) : null);

    if (myBoard) setMyBoard({ ...myBoard, marked_cards: [], score: 0 });

    const { error } = await supabase.rpc('reset_loteria_room', { p_room_code: roomCode });
    if (error) {
      console.error('reset_loteria_room failed:', error);
      await Promise.all([
        supabase.from('loteria_rooms').update({
          is_playing: true,
          current_card: null,
          drawn_cards: [],
          claimed_awards: {},
          game_over_data: null,
          last_update: new Date().toISOString()
        }).eq('room_code', roomCode),
        supabase.from('loteria_players').update({ marked_cards: [], score: 0, has_paid: false }).eq('room_code', roomCode)
      ]);
    }

    winningsTriggeredRef.current = false;
  };

  const updateGameCard = async (cardId: number | null, newDrawnCards: number[]) => {
    supabase
      .from('loteria_rooms')
      .update({ current_card: cardId, drawn_cards: newDrawnCards, last_update: new Date().toISOString() })
      .eq('room_code', roomCode)
      .then(({ error }) => { if (error) console.error('Error sincronizando carta:', error); });
  };

  const resetGame = async () => startGame();

  const markCard = async (cardId: number) => {
    if (!user?.id || !myBoard || !loteriaRoom) return;
    if (!myBoard.board_cards.includes(cardId)) return;
    if (myBoard.marked_cards.includes(cardId)) return;

    const newMarkedCards = [...myBoard.marked_cards, cardId];
    setMyBoard(prev => prev ? ({ ...prev, marked_cards: newMarkedCards }) : null);
    await supabase
      .from('loteria_players')
      .update({ marked_cards: newMarkedCards })
      .eq('room_code', roomCode)
      .eq('user_id', user.id);
  };

  const claimAward = async (pattern: WinPattern) => {
    if (!loteriaRoom || !myBoard || !user) return;

    // Si el Host configuró metas habilitadas, respetarlas.
    if (Array.isArray(loteriaRoom.enabled_patterns) && loteriaRoom.enabled_patterns.length > 0) {
      if (!loteriaRoom.enabled_patterns.includes(pattern)) {
        setLastNotification({ message: 'Esa meta no está habilitada en esta partida.', type: 'error' });
        setTimeout(() => setLastNotification(null), 3000);
        return;
      }
    }

    if (loteriaRoom.claimed_awards?.[pattern]) {
      setLastNotification({ message: '¡Ya fue reclamado!', type: 'error' });
      setTimeout(() => setLastNotification(null), 3000);
      return;
    }

    const isValid = checkPattern(pattern, myBoard.board_cards, loteriaRoom.drawn_cards);
    const points = isValid ? PATTERN_POINTS[pattern] : -PATTERN_POINTS[pattern];

    const currentScore = myBoard.score || 0;
    const newScore = currentScore + points;
    setMyBoard(prev => prev ? ({ ...prev, score: newScore }) : null);
    setPlayersScores(prev => ({ ...prev, [user.id]: newScore }));

    const newClaimedAwards = isValid
      ? { ...(loteriaRoom.claimed_awards || {}), [pattern]: true }
      : (loteriaRoom.claimed_awards || {});

    const playerName = playerNames[user.id] || user.email?.split('@')[0] || 'Jugador';
    const message = isValid
      ? `✅ ${playerName} completó ${PATTERN_NAMES[pattern].toUpperCase()} (+${points} pts)`
      : `❌ ${playerName} MINTIÓ sobre ${PATTERN_NAMES[pattern].toUpperCase()} (${points} pts)`;
    const eventPayload = { message, type: isValid ? 'success' : 'error' as const, timestamp: Date.now() };

    supabase.rpc('update_player_score', { p_room_code: roomCode, p_user_id: user.id, p_points: points })
      .then(({ data: serverScore, error }) => {
        if (error) console.error('Error updating score via RPC:', error);
        else if (serverScore !== null) setMyBoard(prev => prev ? ({ ...prev, score: serverScore }) : null);
      });

    if (isValid && pattern === 'llenas') {
      // ✅ Al validar LLENAS: cerramos la partida para que la UI pase a "fin de juego"
      // y el host dispare la repartición (distribute_loteria_winnings).
      await supabase.from('loteria_rooms').update({
        last_game_event: eventPayload,
        claimed_awards: newClaimedAwards,
        is_playing: false,
        current_card: null,
        last_update: new Date().toISOString()
      }).eq('room_code', roomCode);
      return;
    }

    const roomUpdates: any = { last_game_event: eventPayload };
    if (isValid) roomUpdates.claimed_awards = newClaimedAwards;
    supabase.from('loteria_rooms').update(roomUpdates).eq('room_code', roomCode)
      .then(({ error }) => { if (error) console.error('Error update room notification', error); });
  };

  const returnToLobby = async () => {
    // Host "Nueva Partida": cancela disparos pendientes de reparto y evita rebote a GameOver
    ignoreGameOverRef.current = true;
    winningsTriggeredRef.current = false;
    if (winningsTimeoutRef.current) {
      clearTimeout(winningsTimeoutRef.current);
      winningsTimeoutRef.current = null;
    }

    // UI optimista: limpiamos estado local para que regrese a Lobby aunque el RPC tarde
    setLoteriaRoom(prev => prev ? ({
      ...prev,
      is_playing: false,
      entry_fee: 0,
      current_card: null,
      drawn_cards: [],
      claimed_awards: {},
      game_over_data: null,
      last_game_event: null
    }) : prev);
    setPlayersPaymentStatus({});
    winningsTriggeredRef.current = false;

    const { error } = await supabase.rpc('return_to_lobby', { p_room_code: roomCode });
    if (error) console.error('Error returning to lobby:', error);

    // Fallback fuerte: asegura que el row en BD quede limpio aunque un RPC tardío haya escrito game_over_data
    const { error: hardError } = await supabase
      .from('loteria_rooms')
      .update({
        is_playing: false,
        entry_fee: 0,
        current_card: null,
        drawn_cards: [],
        claimed_awards: {},
        game_over_data: null,
        last_game_event: null,
        last_update: new Date().toISOString()
      } as any)
      .eq('room_code', roomCode);

    if (hardError) console.error('Error limpiando sala (fallback):', hardError);
  };

  const closeNotification = () => setLastNotification(null);

  const leaderboard: LoteriaLeaderboardEntry[] = Object.entries(playersScores)
    .map(([user_id, score]) => ({ user_id, name: playerNames[user_id] || 'Jugador', score: score || 0 }))
    .sort((a, b) => b.score - a.score);

  const updateEntryFee = async (fee: number) => {
    const amHost = user?.id === loteriaRoom?.host_id;
    if (!amHost) return;

    // UI optimista (esto también "abre" la pantalla de pago cuando fee > 0)
    setLoteriaRoom(prev => prev ? ({ ...prev, entry_fee: fee }) : prev);

    const { error } = await supabase
      .from('loteria_rooms')
      .update({ entry_fee: fee })
      .eq('room_code', roomCode);

    if (error) {
      console.error('No se pudo actualizar entry_fee:', error);
      setLastNotification({ message: 'No se pudo abrir la mesa de pagos.', type: 'error' });
      setTimeout(() => setLastNotification(null), 3000);
    }
  };

  const payEntry = async (amountOverride?: number) => {
    if (!user?.id) return;
    const amount = amountOverride ?? loteriaRoom?.entry_fee ?? 0;
    if (!amount || amount <= 0) return;

    // El RPC puede esperar UUID (id/room_id) o el code, dependiendo del esquema.
    // Probamos en orden: id -> room_id -> room_code.
    const candidates = [
      (loteriaRoom as any)?.id,
      (loteriaRoom as any)?.room_id,
      roomCode
    ].filter((v, i, arr) => typeof v === 'string' && v.length > 0 && arr.indexOf(v) === i) as string[];

    let lastError: any = null;
    let ok = false;
    const tryRpc = async (label: string, params: any) => {
      const { error } = await supabase.rpc('pay_game_entry', params as any);
      if (error) console.warn('pay_game_entry intento falló:', label, params, error);
      return error;
    };

    // Intento #1: firma "universal" (como Dados) usando room_id_param
    for (const roomIdParam of candidates) {
      const error = await tryRpc('universal(room_id_param)', {
        user_id_param: user.id,
        room_table_name: 'loteria_rooms',
        room_id_param: roomIdParam,
        amount
      });
      if (!error) {
        ok = true;
        lastError = null;
        break;
      }
      lastError = error;
    }

    // Intento #2: firma alternativa usada en otras RPCs (p_room_code)
    if (!ok) {
      const error = await tryRpc('alt(p_room_code)', {
        user_id_param: user.id,
        room_table_name: 'loteria_rooms',
        p_room_code: roomCode,
        amount
      });
      if (!error) {
        ok = true;
        lastError = null;
      } else {
        lastError = error;
      }
    }

    // Intento #3: nombres de params estilo p_* (por compatibilidad con SQL antiguo)
    if (!ok) {
      const error = await tryRpc('alt(p_*)', {
        p_user_id: user.id,
        p_room_code: roomCode,
        p_room_table_name: 'loteria_rooms',
        p_amount: amount
      });
      if (!error) {
        ok = true;
        lastError = null;
      } else {
        lastError = error;
      }
    }

    if (!ok) {
      notifyDbError('No se pudo pagar la entrada', lastError);
      return;
    }

    setMyBoard(prev => prev ? ({ ...prev, has_paid: true }) : null);
    await supabase.from('loteria_players')
      .update({ has_paid: true })
      .eq('room_code', roomCode)
      .eq('user_id', user.id);
  };

  const isHost = user?.id === loteriaRoom?.host_id;

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
    returnToLobby,
    claimAward,
    lastNotification,
    closeNotification,
    playersScores,
    playersPaymentStatus,
    leaderboard,
    joinError,
    payEntry,
    updateEntryFee
  };
};


