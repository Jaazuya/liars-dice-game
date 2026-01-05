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
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Drawer para Metas en móvil

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
    leaderboard,
    joinError
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

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message} (${e.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#1a0f0d] flex items-center justify-center">
        <div className="text-[#ffb300] text-xl font-rye">Cargando...</div>
      </main>
    );
  }

  // Bloqueo por capacidad (11º jugador) / error de asignación de tablero
  if (joinError) {
    return (
      <main className="min-h-screen bg-[#1a0f0d] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#3e2723] border-2 border-[#8b5a2b] rounded-lg p-6 max-w-lg w-full">
          <h2 className="font-rye text-[#ffb300] text-2xl mb-3">No se pudo entrar</h2>
          <p className="text-[#d7ccc8] mb-5">{joinError}</p>
          <button
            onClick={() => router.push('/loteria')}
            className="bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye px-6 py-3 rounded border-2 border-[#ff6f00] shadow-lg transition-all uppercase"
          >
            Volver
          </button>
        </div>
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
    <main className="min-h-screen relative overflow-hidden bg-[#2d1b15]">
      
      {/* Notificaciones Globales (Toast) */}
      <NotificationToast notification={lastNotification} onClose={closeNotification} />

      {/* Modal de Jugadores (Leaderboard) */}
      <PlayersModal 
        isOpen={showPlayers}
        onClose={() => setShowPlayers(false)}
        leaderboard={leaderboard}
      />

      {/* Fondo */}
      <div 
        className="absolute inset-0 -z-10"
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
      <header className="relative z-20 bg-[#3e2723] border-b-[4px] border-[#5d4037] shadow-lg h-16 shrink-0">
        <div className="w-full h-full px-4 flex items-center justify-between">
          {/* Izquierda: Abandonar + Fullscreen */}
          <div className="flex gap-2">
            <motion.button
                onClick={handleAbandon}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#8b1a1a] hover:bg-[#9b2a2a] text-white font-rye w-10 h-10 sm:w-auto sm:px-4 rounded border-2 border-[#a03a3a] shadow-lg flex items-center justify-center"
                title="Abandonar"
            >
                <span className="hidden sm:inline text-sm">🚪 Salir</span>
                <span className="sm:hidden text-lg">🚪</span>
            </motion.button>
            
            <motion.button
                onClick={toggleFullScreen}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#4e342e] hover:bg-[#5d4037] text-[#ffb300] font-rye w-10 h-10 rounded border-2 border-[#6d4c41] shadow-lg flex items-center justify-center text-lg"
                title="Pantalla Completa"
            >
                ⛶
            </motion.button>
          </div>

          {/* Centro: Título (Oculto en móviles muy pequeños si estorba) */}
          <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
             <h1 className="text-2xl font-rye text-[#ffb300] drop-shadow-md uppercase tracking-wider">
               Loteria
             </h1>
          </div>

          {/* Derecha: Botón Settings y Jugadores */}
          <div className="flex items-center gap-3">
            {/* Score */}
            <div className="bg-[#2d1b15] px-3 py-1 rounded border-2 border-[#ffb300] shadow-lg flex items-center gap-2">
               <span className="text-lg">💰</span>
               <span className="font-rye text-[#ffb300] text-sm">{myScore}</span>
            </div>

            <motion.button
              onClick={() => setShowPlayers(true)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#4e342e] text-[#d7ccc8] font-rye w-10 h-10 rounded border-2 border-[#6d4c41] flex items-center justify-center text-lg"
            >
              👥
            </motion.button>

            <div className="relative">
              <motion.button
                onClick={() => setShowSettings(!showSettings)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="bg-[#5d4037] text-[#ffb300] font-rye w-10 h-10 rounded border-2 border-[#8d6e63] flex items-center justify-center text-xl"
              >
                ⚙️
              </motion.button>
              
              {showSettings && (
                <div className="absolute top-12 right-0 bg-[#3e2716] border-2 border-[#8b5a2b] rounded shadow-xl p-3 z-50 flex flex-col gap-2 min-w-[160px]">
                  <h3 className="text-[#f4e4bc] text-xs font-bold text-center border-b border-[#8b5a2b] pb-2 mb-1 font-rye">
                    VELOCIDAD
                  </h3>
                  {isHost ? (
                    <>
                      <button onClick={() => { setGameSpeed(8000); setShowSettings(false); }} className="text-sm px-3 py-2 rounded text-left text-[#d7ccc8] hover:bg-white/10 font-rye">🐢 Lento (8s)</button>
                      <button onClick={() => { setGameSpeed(5000); setShowSettings(false); }} className="text-sm px-3 py-2 rounded text-left text-[#d7ccc8] hover:bg-white/10 font-rye">🐇 Normal (5s)</button>
                      <button onClick={() => { setGameSpeed(3000); setShowSettings(false); }} className="text-sm px-3 py-2 rounded text-left text-[#d7ccc8] hover:bg-white/10 font-rye">⚡ Rápido (3s)</button>
                    </>
                  ) : (
                    <div className="text-[#a1887f] text-xs text-center italic p-2">Solo Host</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* --- GRID DE JUEGO PRINCIPAL --- */}
      {/* 
         Estructura CSS Grid Adaptativa:
         - Mobile Portrait: Flex Col con SCROLL. El contenedor principal permite scroll vertical.
         - Desktop: Flex Row fijo sin scroll global (el contenido interno puede tener scroll si hace falta).
      */}
      <div className="relative z-10 w-full h-[calc(100vh-64px)] overflow-y-auto lg:overflow-hidden flex flex-col landscape:flex-row lg:flex-row">

        {/* 1. SECCIÓN DECK (Baraja) */}
        {/* Mobile Portrait: Order 2 (Abajo). Landscape: Order 2 (Derecha). Desktop: Order 1 (Izquierda). */}
        <div className="
            order-2 landscape:order-2 lg:order-1
            w-full landscape:w-72 lg:w-72 
            shrink-0 flex flex-col 
            p-2 lg:p-4
            landscape:border-l lg:border-r border-[#5d4037]/50
            landscape:overflow-y-auto lg:overflow-visible
            min-h-[200px] lg:min-h-0
        ">
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

        {/* 2. SECCIÓN TABLERO (Central) */}
        {/* Mobile Portrait: Order 1 (Top). Landscape: Order 1 (Left). Desktop: Order 2 (Center). */}
        <div className="
            order-1 landscape:order-1 lg:order-2
            flex-1 flex flex-col items-center lg:justify-center 
            relative p-2
            shrink-0 lg:shrink
        ">
            {myBoard ? (
              <LoteriaBoard
                boardCards={myBoard.board_cards}
                markedCards={myBoard.marked_cards}
                onCardClick={markCard}
              />
            ) : (
              <div className="text-center p-8 bg-[#3e2723] rounded-lg border-2 border-[#5d4037]">
                <p className="text-[#d7ccc8] font-rye text-lg animate-pulse">Generando...</p>
              </div>
            )}
            
            {/* Botón flotante para abrir Drawer de Metas (Solo Mobile) */}
            <button 
                onClick={() => setIsDrawerOpen(true)}
                className="lg:hidden absolute bottom-4 right-4 z-40 bg-[#ffb300] text-[#3e2723] w-12 h-12 rounded-full shadow-xl flex items-center justify-center border-2 border-[#3e2723] animate-bounce"
                title="Ver Metas"
            >
                🏆
            </button>
        </div>

            {/* 3. SECCIÓN METAS (Patterns) */}
            {/* Desktop only. Mobile uses Drawer. */}
            <div className="hidden lg:flex lg:order-3 w-72 shrink-0 flex-col p-4 border-l border-[#5d4037]/50">
               <WinningPatterns 
                 claimedAwards={loteriaRoom?.claimed_awards}
                 onClaim={claimAward}
               />
            </div>

      </div>

      {/* --- DRAWER DE METAS (MOBILE: Portrait & Landscape) --- */}
      <AnimatePresence>
        {isDrawerOpen && (
            <>
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsDrawerOpen(false)}
                    className="fixed inset-0 bg-black/60 z-50 lg:hidden"
                />
                
                {/* Panel Deslizable */}
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-[#2d1b15] border-l-4 border-[#5d4037] z-50 shadow-2xl flex flex-col lg:hidden"
                >
                    <div className="flex items-center justify-between p-4 bg-[#3e2723] border-b border-[#5d4037]">
                        <h2 className="font-rye text-[#ffb300] text-xl">🏆 Metas y Premios</h2>
                        <button 
                            onClick={() => setIsDrawerOpen(false)}
                            className="text-[#d7ccc8] hover:text-white text-2xl"
                        >
                            ✕
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        <WinningPatterns 
                           claimedAwards={loteriaRoom?.claimed_awards}
                           onClaim={(pattern) => {
                               claimAward(pattern);
                           }}
                        />
                    </div>
                </motion.div>
            </>
        )}
      </AnimatePresence>

    </main>
  );
}
