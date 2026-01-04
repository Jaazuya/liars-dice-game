import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase'; 
import { User } from '@supabase/supabase-js';

export interface LoteriaRoomState {
  room_code: string;
  is_playing: boolean;
  current_card: number | null;
  drawn_cards: number[];
  last_update: string;
  rooms?: { host_id: string; status: string; } | null;
}

interface LoteriaPlayer {
  room_code: string;
  user_id: string;
  board_cards: number[];
  marked_cards: number[];
}

export const useLoteriaGame = (roomCode: string, user: User | null) => {
  const [loteriaRoom, setLoteriaRoom] = useState<LoteriaRoomState | null>(null);
  const [myBoard, setMyBoard] = useState<LoteriaPlayer | null>(null);
  const [loading, setLoading] = useState(true);

  // Generador de tablero simple (16 cartas únicas)
  const generateRandomBoard = () => {
    const deck = Array.from({ length: 54 }, (_, i) => i + 1);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck.slice(0, 16);
  };

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

    // 2. Obtener o Crear Tablero (Fix Loading Infinito)
    const fetchOrCreateBoard = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('loteria_players')
        .select('*')
        .eq('room_code', roomCode)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setMyBoard(data);
      } else {
        console.log("Creando tablero nuevo...");
        const newBoardCards = generateRandomBoard();
        const { data: newData } = await supabase
          .from('loteria_players')
          .insert({
            room_code: roomCode,
            user_id: user.id,
            board_cards: newBoardCards,
            marked_cards: []
          })
          .select()
          .single();
        if (newData) setMyBoard(newData);
      }
    };
    if (user?.id) fetchOrCreateBoard();

    // 3. Suscripción Realtime
    console.log(`🔌 Suscribiendo a canal loteria_${roomCode}...`);
    const channel = supabase
      .channel(`loteria_${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'loteria_rooms' }, // Quitamos filtro de servidor para evitar errores de sintaxis
        (payload) => {
          // Filtrado en cliente
          if ((payload.new as LoteriaRoomState).room_code !== roomCode) return;
          
          console.log("🔔 UPDATE loteria_rooms:", payload.new);
          setLoteriaRoom((prev) => {
            if (!prev) return null;
            return { ...prev, ...payload.new as any };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loteria_players' }, // Quitamos filtro de servidor
        async (payload) => {
          // Filtrado en cliente
          if ((payload.new as LoteriaPlayer).room_code !== roomCode) return;

          if (user?.id && (payload.new as LoteriaPlayer)?.user_id === user.id) {
            console.log("🔔 UPDATE myBoard:", payload.new);
            setMyBoard(payload.new as LoteriaPlayer);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Estado suscripción ${roomCode}:`, status);
        if (status === 'SUBSCRIBED') {
           console.log("✅ Conectado a Realtime");
        }
      });

    return () => { 
      console.log("🔌 Desconectando canal...");
      supabase.removeChannel(channel); 
    };
  }, [roomCode, user?.id]);

  // --- ACCIONES DEL HOST ---

  const startGame = async () => {
    if (!loteriaRoom) return;
    
    // 1. Actualización Optimista (Para que no tengas que recargar)
    setLoteriaRoom(prev => prev ? { ...prev, is_playing: true, current_card: null, drawn_cards: [] } : null);

    // 2. Actualización DB
    const { error } = await supabase.from('loteria_rooms').update({
      is_playing: true,
      current_card: null,
      drawn_cards: [],
      last_update: new Date().toISOString()
    }).eq('room_code', roomCode);
    
    if (error) {
      console.error("❌ Error iniciando juego en BD:", error);
      // Revertir optimismo si falla gravemente? 
      // setLoteriaRoom(prev => prev ? { ...prev, is_playing: false } : null);
    }
  };

  // Esta función es la que usa TheDeck. 
  // La hacemos "optimista" (no espera el await para liberar la UI rápido)
  const updateGameCard = async (cardId: number, newDrawnCards: number[]) => {
    // Importante: No usar await aquí para no bloquear el timer visual, pero sí loguear errores
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
    
    // Validar si la carta ya salió
    const history = loteriaRoom.drawn_cards || [];
    if (!history.includes(cardId)) return;

    if (!myBoard.board_cards.includes(cardId)) return;
    if (myBoard.marked_cards.includes(cardId)) return;

    const newMarkedCards = [...myBoard.marked_cards, cardId];
    await supabase.from('loteria_players').update({ marked_cards: newMarkedCards }).eq('room_code', roomCode).eq('user_id', user.id);
  };

  const isHost = user?.id === loteriaRoom?.rooms?.host_id;
  
  return {
    loteriaRoom,
    myBoard,
    currentCard: loteriaRoom?.current_card,
    loading,
    markCard,
    isHost,
    startGame,
    updateGameCard,
    resetGame
  };
};
