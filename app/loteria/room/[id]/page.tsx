'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useLoteriaGame } from '@/app/hooks/useLoteriaGame';
import TheDeck from '@/app/loteria/components/TheDeck';
import { LoteriaBoard } from '@/app/loteria/components/LoteriaBoard';
import { LoteriaLobby } from '@/app/loteria/components/LoteriaLobby';
import { WinningPatterns } from '@/app/loteria/components/WinningPatterns';
import { Player } from '@/app/types/game';
import { motion } from 'framer-motion';
import { User } from '@supabase/supabase-js';

export default function LoteriaRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const roomCode = id as string;
  const [user, setUser] = useState<User | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const storedPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null;

  // Obtener usuario actual
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { loteriaRoom, myBoard, currentCard, loading, markCard, isHost, startGame, updateGameCard, resetGame } = useLoteriaGame(roomCode, user);

  // Debug: Log cuando cambie current_card
  useEffect(() => {
    if (loteriaRoom) {
      console.log('📋 loteriaRoom.current_card en page.tsx:', loteriaRoom.current_card);
    }
  }, [loteriaRoom?.current_card]);

  useEffect(() => {
    if (!roomCode) return;
    const fetchPlayers = async () => {
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true });
      if (playersData) {
        setPlayers(playersData);
      }
    };
    fetchPlayers();
    const channel = supabase.channel(`loteria_players_${roomCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_code=eq.${roomCode}`
      }, () => {
        fetchPlayers();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, storedPlayerId]);

  const handleStartGame = async () => {
    if (!isHost) return;
    // Usar la función del hook que tiene actualización optimista
    await startGame();
  };

  const handleAbandon = async () => {
    if (!storedPlayerId) return;
    await supabase
      .from('players')
      .delete()
      .eq('id', storedPlayerId);
    router.push('/');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1a0f0d] flex items-center justify-center">
        <div className="text-[#ffb300] text-xl font-rye">Cargando...</div>
      </main>
    );
  }

  if (!loteriaRoom?.is_playing) {
    return (
      <LoteriaLobby
        code={roomCode}
        players={players}
        isHost={isHost}
        onStart={handleStartGame}
        onAbandon={handleAbandon}
      />
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Fondo: Papel tapiz victoriano arriba y lambrín de madera abajo */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(to bottom, 
              rgba(250, 240, 230, 0.15) 0%, 
              rgba(250, 240, 230, 0.15) 60%,
              rgba(45, 27, 21, 0.95) 60%,
              rgba(45, 27, 21, 0.95) 100%
            ),
            url('https://www.transparenttextures.com/patterns/wood-pattern.png')
          `,
          backgroundSize: 'auto, 200px 200px'
        }}
      />

      {/* Encabezado (Top Bar) */}
      <header className="relative z-20 bg-[#3e2723] border-b-[4px] border-[#5d4037] shadow-lg">
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between">
          {/* Izquierda: Botón Abandonar */}
          <motion.button
            onClick={handleAbandon}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-[#8b1a1a] hover:bg-[#9b2a2a] text-white font-rye px-6 py-2 rounded border-2 border-[#a03a3a] shadow-lg transition-all uppercase text-sm"
          >
            🚪 Abandonar
          </motion.button>

          {/* Centro: Cartel de madera tallada */}
          <div className="bg-[#4e342e] border-[6px] border-[#6d4c41] rounded-lg px-8 py-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative">
            <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[#1a100e]"></div>
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1a100e]"></div>
            <h1 className="text-3xl md:text-4xl font-rye font-bold text-[#ffb300] drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)] uppercase tracking-wider">
              LOTERIA MEXICANA
            </h1>
          </div>

          {/* Derecha: Botón Settings */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="bg-[#5d4037] hover:bg-[#6d4c41] text-[#ffb300] font-rye w-10 h-10 rounded border-2 border-[#8d6e63] shadow-lg transition-all flex items-center justify-center text-xl"
          >
            ⚙️
          </motion.button>
        </div>
      </header>

      {/* Grid Principal (3 Columnas) - Prioriza el tablero central */}
      <div className="relative z-10 max-w-[1920px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6 h-[calc(100vh-120px)]">
          {/* Columna 1 (Izquierda): Baraja/Controles */}
          <div className="flex flex-col">
            <TheDeck
              isHost={isHost}
              isPlaying={loteriaRoom.is_playing}
              currentCardId={loteriaRoom.current_card}
              drawnCards={loteriaRoom.drawn_cards || []}
              onUpdateCard={updateGameCard}
              onReset={resetGame}
            />
          </div>

          {/* Columna 2 (Centro): Tablero */}
          <div className="flex flex-col">
            <div className="bg-[#3e2723] border-[6px] border-[#5d4037] rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] p-6 h-full flex flex-col relative">
              {/* Clavos decorativos */}
              <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
              <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
              <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>

              {/* Título */}
              <h2 className="text-2xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] border-b-2 border-[#5d4037] pb-3">
                CARTA
              </h2>

              {/* Tablero dentro del marco */}
              <div className="flex-1 flex items-center justify-center">
                {myBoard ? (
                  <LoteriaBoard
                    boardCards={myBoard.board_cards}
                    markedCards={myBoard.marked_cards}
                    onCardClick={markCard}
                  />
                ) : (
                  <div className="text-center">
                    <p className="text-[#d7ccc8] font-rye text-lg">
                      Generando tu tablero...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Columna 3 (Derecha): Metas */}
          <div className="flex flex-col">
            <WinningPatterns />
          </div>
        </div>
      </div>
    </main>
  );
}
