'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useLoteriaGame } from '@/app/hooks/useLoteriaGame';
import TheDeck from '@/app/loteria/components/TheDeck';
import { LoteriaBoard } from '@/app/loteria/components/LoteriaBoard';
import { LoteriaLobby } from '@/app/loteria/components/LoteriaLobby';
import { WinningPatterns } from '@/app/loteria/components/WinningPatterns';
import { NotificationToast } from '@/app/loteria/components/NotificationToast';
import { PlayersModal } from '@/app/loteria/components/PlayersModal';
import { GameOverScreen } from '@/app/loteria/components/GameOverScreen';
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
  const [gameSpeed, setGameSpeed] = useState(5000);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Obtener usuario actual
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const { 
    loteriaRoom, 
    myBoard, 
    currentCard, 
    loading, 
    markCard, 
    isHost, 
    startGame, 
    updateGameCard, 
    resetGame,
    claimAward,
    lastNotification,
    playersScores,
    closeNotification,
    returnToLobby,
    leaderboard
  } = useLoteriaGame(roomCode, user);

  // Calcular puntuación personal
  const myScore = user?.id ? (playersScores[user.id] || 0) : 0;

  // Debug: Log cuando cambie current_card
  useEffect(() => {
    if (loteriaRoom) {
      console.log('📋 loteriaRoom.current_card en page.tsx:', loteriaRoom.current_card);
    }
  }, [loteriaRoom?.current_card]);

  // Auto-Pausa cuando hay notificación (alguien reclama)
  useEffect(() => {
    if (lastNotification && isHost) {
      setIsPaused(true);
    }
  }, [lastNotification, isHost]);

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
    if (loteriaRoom?.claimed_awards?.['llenas']) {
       return (
         <GameOverScreen 
           leaderboard={leaderboard}
           isHost={isHost}
           onRestart={resetGame}
           onReturnToLobby={returnToLobby}
         />
       );
    }

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
      
      {/* Notificaciones Globales (Toast) */}
      <NotificationToast notification={lastNotification} onClose={closeNotification} />

      {/* Modal de Jugadores (Leaderboard) */}
      <PlayersModal 
        isOpen={showPlayers}
        onClose={() => setShowPlayers(false)}
        leaderboard={leaderboard}
      />

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
        <div className="max-w-[1920px] mx-auto px-4 py-3 flex items-center justify-between relative h-16">
          {/* Izquierda: Botón Abandonar */}
          <motion.button
            onClick={handleAbandon}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative z-10 bg-[#8b1a1a] hover:bg-[#9b2a2a] text-white font-rye px-4 sm:px-6 py-2 rounded border-2 border-[#a03a3a] shadow-lg transition-all uppercase text-xs sm:text-sm"
          >
            <span className="hidden sm:inline">🚪 Abandonar</span>
            <span className="sm:hidden">🚪</span>
          </motion.button>

          {/* Centro Absoluto: Cartel de madera tallada */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[200px] sm:max-w-md flex justify-center pointer-events-none">
            <div className="bg-[#4e342e] border-[4px] sm:border-[6px] border-[#6d4c41] rounded-lg px-4 sm:px-8 py-1 sm:py-2 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative">
              <div className="absolute top-1 left-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#1a100e]"></div>
              <div className="absolute top-1 right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#1a100e]"></div>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-rye font-bold text-[#ffb300] drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] uppercase tracking-wider text-center whitespace-nowrap">
                LOTERIA MEXICANA
              </h1>
            </div>
          </div>

          {/* Derecha: Botón Settings y Jugadores */}
          <div className="relative z-50 flex items-center gap-3">
            
            {/* Score Display */}
            <div className="relative z-10 bg-[#2d1b15] px-3 py-1 sm:px-4 sm:py-2 rounded border-2 border-[#ffb300] shadow-lg flex items-center gap-2">
               <span className="text-xl">💰</span>
               <span className="font-rye text-[#ffb300] text-sm sm:text-lg">{myScore} pts</span>
            </div>

            {/* Botón Jugadores (Ranking) */}
            <motion.button
              onClick={() => setShowPlayers(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10 bg-[#4e342e] hover:bg-[#5d4037] text-[#d7ccc8] font-rye px-3 py-1 sm:px-4 sm:py-2 rounded border-2 border-[#6d4c41] shadow-lg transition-all uppercase text-sm flex items-center gap-2"
            >
              <span className="text-xl">👥</span> 
              <span className="hidden sm:inline">Jugadores</span>
            </motion.button>

            {/* Botón Settings */}
            <div className="relative">
              <motion.button
                onClick={() => setShowSettings(!showSettings)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="relative z-10 bg-[#5d4037] hover:bg-[#6d4c41] text-[#ffb300] font-rye w-10 h-10 rounded border-2 border-[#8d6e63] shadow-lg transition-all flex items-center justify-center text-xl"
              >
                ⚙️
              </motion.button>
              
              {/* Settings Menu */}
              {showSettings && (
                <div className="absolute top-12 right-0 bg-[#3e2716] border-2 border-[#8b5a2b] rounded shadow-xl p-3 z-50 flex flex-col gap-2 min-w-[160px]">
                  <h3 className="text-[#f4e4bc] text-xs font-bold text-center border-b border-[#8b5a2b] pb-2 mb-1 font-rye">
                    VELOCIDAD DE CARTA
                  </h3>
                  {isHost ? (
                    <>
                      <button 
                        onClick={() => { setGameSpeed(8000); setShowSettings(false); }}
                        className={`text-sm px-3 py-2 rounded text-left transition-colors font-rye ${gameSpeed === 8000 ? 'bg-[#8b5a2b] text-white' : 'text-[#d7ccc8] hover:bg-white/10'}`}
                      >
                        🐢 Lento (8s)
                      </button>
                      <button 
                        onClick={() => { setGameSpeed(5000); setShowSettings(false); }}
                        className={`text-sm px-3 py-2 rounded text-left transition-colors font-rye ${gameSpeed === 5000 ? 'bg-[#8b5a2b] text-white' : 'text-[#d7ccc8] hover:bg-white/10'}`}
                      >
                        🐇 Normal (5s)
                      </button>
                      <button 
                        onClick={() => { setGameSpeed(3000); setShowSettings(false); }}
                        className={`text-sm px-3 py-2 rounded text-left transition-colors font-rye ${gameSpeed === 3000 ? 'bg-[#8b5a2b] text-white' : 'text-[#d7ccc8] hover:bg-white/10'}`}
                      >
                        ⚡ Rápido (3s)
                      </button>
                    </>
                  ) : (
                    <div className="text-[#a1887f] text-xs text-center italic p-2">
                      Solo el host puede cambiar la velocidad
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Grid Principal Adaptativo */}
      <div className="relative z-10 max-w-[1920px] mx-auto px-2 sm:px-4 py-4 sm:py-6 h-[calc(100vh-80px)] overflow-y-auto sm:overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full items-start lg:items-stretch">
          
          {/* Columna 1 (Izquierda): Baraja/Controles - Ancho fijo en desktop, primero en móvil */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col order-1 lg:order-1">
            <TheDeck
              isHost={isHost}
              isPlaying={loteriaRoom.is_playing}
              currentCardId={loteriaRoom.current_card}
              drawnCards={loteriaRoom.drawn_cards || []}
              onUpdateCard={updateGameCard}
              onReset={resetGame}
              gameSpeed={gameSpeed}
              isPaused={isPaused}
              onTogglePause={setIsPaused}
            />
          </div>

          {/* Columna 2 (Centro): Tablero - Ocupa todo el espacio restante */}
          <div className="w-full lg:flex-1 flex flex-col order-2 lg:order-2 min-h-[400px] lg:h-full">
            <div className="flex-1 flex items-center justify-center h-full">
              {myBoard ? (
                <LoteriaBoard
                  boardCards={myBoard.board_cards}
                  markedCards={myBoard.marked_cards}
                  onCardClick={markCard}
                />
              ) : (
                <div className="text-center p-8 bg-[#3e2723] rounded-lg border-2 border-[#5d4037]">
                  <p className="text-[#d7ccc8] font-rye text-lg animate-pulse">
                    Generando tu tablero...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Columna 3 (Derecha): Metas - Ancho fijo en desktop, último en móvil */}
          <div className="w-full lg:w-72 shrink-0 flex flex-col order-3 lg:order-3">
            <WinningPatterns 
              claimedAwards={loteriaRoom?.claimed_awards}
              onClaim={claimAward}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
