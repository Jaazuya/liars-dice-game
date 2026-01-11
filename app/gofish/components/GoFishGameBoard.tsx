'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  roomCode: string;
  user: any;
}

// Helper para obtener la imagen de la carta
const getCardImage = (cardId: string) => `/cards/${cardId}.svg`;

export default function GoFishGameBoard({ roomCode, user }: Props) {
  const [players, setPlayers] = useState<any[]>([]);
  const [room, setRoom] = useState<any>(null);
  
  // ESTADOS DE JUEGO (TU TURNO)
  const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [gameMessage, setGameMessage] = useState("Cargando mesa...");
  const [lastEvent, setLastEvent] = useState<any>(null);
  const [showRivalModal, setShowRivalModal] = useState(false);
  const [showBooksModal, setShowBooksModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // 1. CARGA INICIAL Y REALTIME (FOG OF WAR - RPC Segura)
  useEffect(() => {
    fetchGameState();

    // Solo suscripción a cambios en la sala (no acceso directo a jugadores)
    const channel = supabase
      .channel(`gofish_board_${roomCode}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'gofish_rooms', 
        filter: `room_code=eq.${roomCode}` 
      }, (payload: any) => {
        // Cuando la sala se actualiza, recargar el estado completo usando la RPC segura
        fetchGameState();
        
        // Actualizar last_game_event si existe
        if (payload.new.last_game_event) {
          setLastEvent(payload.new.last_game_event);
          setGameMessage(payload.new.last_game_event.message || "Cambio de turno");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomCode]);

  // Función segura para obtener el estado del juego (FOG OF WAR)
  const fetchGameState = async () => {
    try {
      // Llamar a la RPC segura que devuelve solo la información que el jugador debería ver
      const { data, error } = await supabase.rpc('get_safe_game_state', {
        p_room_code: roomCode
      });

      if (error) {
        console.error('[GoFish] Error al obtener estado seguro:', error);
        return;
      }

      if (data) {
        // La RPC devuelve { room: ..., players: ... }
        // Los jugadores ya vienen con sus nombres y las cartas de oponentes como { suit: 'back', rank: 'back' }
        if (data.room) {
          setRoom(data.room);
          // Actualizar last_game_event si existe
          if (data.room.last_game_event) {
            setLastEvent(data.room.last_game_event);
            setGameMessage(data.room.last_game_event.message || "Esperando...");
          }
        }

        if (data.players && Array.isArray(data.players)) {
          // Los jugadores ya vienen con profiles: { username, avatar_url } desde la RPC (objeto, no array)
          // Las cartas de oponentes ya están convertidas a { suit: 'back', rank: 'back' }
          setPlayers(data.players);
        }
      }
    } catch (err: any) {
      console.error('[GoFish] Excepción al obtener estado seguro:', err);
    }
  };

  // 2. LÓGICA DE JUGADA
  const handlePassTurn = async () => {
    setProcessing(true);
    const { data, error } = await supabase.rpc('pass_gofish_turn', { p_room_code: roomCode });
    if (error) alert(error.message);
    if (data?.message) setGameMessage(data.message);
    setProcessing(false);
  };

  const handlePlayTurn = async () => {
    if (!selectedRivalId || !selectedRank) return;
    setProcessing(true);

    try {
        const { data, error } = await supabase.rpc('play_gofish_turn', {
            p_room_code: roomCode,
            p_target_player_id: selectedRivalId,
            p_rank: selectedRank
        });

        if (error) throw error;

        // Limpiar selección después de jugar
        setSelectedRank(null);
        setSelectedRivalId(null);
        
        // El mensaje de éxito vendrá por el canal de realtime, pero podemos poner uno local rápido
        if (data.success) {
            setGameMessage(data.message);
        }

    } catch (err: any) {
        alert("Error en la jugada: " + err.message);
    } finally {
        setProcessing(false);
    }
  };

  // 3. LÓGICA DE ABANDONO
  const handleLeaveRoom = async () => {
    setShowLeaveConfirm(false);
    setProcessing(true);
    try {
      const { error } = await supabase.rpc('leave_gofish_room', { 
        p_room_code: roomCode 
      });
      if (error) throw error;
      // Redirigir al menú
      window.location.href = '/gofish';
    } catch (err: any) {
      alert("Error al abandonar: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // 3. RENDER
  if (!room || players.length === 0) return <div className="text-[#ffb300] p-10 font-rye text-center">Barajando...</div>;

  const myPlayer = players.find(p => p.user_id === user.id);

  // ------------------------------------------------------------
  // 🏁 BLOQUE DE GAME OVER: REPARTO PROPORCIONAL
  // ------------------------------------------------------------
  if (room && room.game_phase === 'finished') {
      // 1. Calcular Datos Matemáticos
      const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
      const winner = sortedPlayers[0];
      const isWinner = winner.user_id === user.id;
      
      // Sumamos todos los libros para saber el denominador
      const totalBooksInTable = players.reduce((sum, p) => sum + p.score, 0) || 1; // Evitar división por 0

      // Función auxiliar para calcular cuánto ganó cada quién visualmente
      const getPrizeShare = (playerScore: number) => {
          if (playerScore === 0) return 0;
          return Math.floor((playerScore / totalBooksInTable) * room.pot);
      };

      const myPrize = getPrizeShare(myPlayer?.score || 0);

      return (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-[#3e2723] border-[6px] border-[#ffb300] p-8 rounded-xl text-center shadow-[0_0_50px_rgba(255,179,0,0.6)] max-w-2xl w-full wood-texture relative overflow-hidden">
                  
                  {/* Título Dinámico */}
                  <h1 className="text-5xl font-rye text-[#ffb300] mb-2 drop-shadow-[0_4px_0_#000]">
                      {isWinner ? '¡VICTORIA!' : (myPrize > 0 ? '¡BOTÍN REPARTIDO!' : 'FIN DEL JUEGO')}
                  </h1>
                  
                  <p className="text-[#d7ccc8] mb-6 italic text-lg">
                      {myPrize > 0 
                          ? `Te llevas $${myPrize} a casa, vaquero.` 
                          : 'Hoy no hubo suerte en la pesca.'}
                  </p>

                  {/* GANADOR DESTACADO (El que hizo más libros) */}
                  <div className="flex flex-col items-center mb-6">
                      <div className="w-20 h-20 rounded-full border-4 border-[#ffb300] bg-[#1a0f0d] flex items-center justify-center text-4xl shadow-lg mb-2 relative">
                          {isWinner ? '🤠' : '🥇'}
                          <span className="absolute -top-4 text-3xl animate-bounce">👑</span>
                      </div>
                      <p className="text-xl font-bold text-white font-rye">MVP: {winner.profiles?.username || 'Forastero'}</p>
                      <div className="text-yellow-400 text-sm opacity-80">
                          ({winner.score} Libros formados)
                      </div>
                  </div>

                  {/* TABLA DE RESULTADOS Y DINERO */}
                  <div className="bg-[#1a0f0d]/60 rounded-lg p-4 mb-8 border border-[#5d4037]">
                      <div className="flex justify-between items-center mb-3 border-b border-[#5d4037] pb-2 px-2">
                          <span className="text-[#ffb300] font-rye text-sm">JUGADOR</span>
                          <span className="text-[#ffb300] font-rye text-sm">PREMIO</span>
                      </div>

                      <div className="space-y-3">
                          {sortedPlayers.map((p, index) => {
                              const prize = getPrizeShare(p.score);
                              return (
                                  <div key={p.user_id} className="flex justify-between items-center px-2 py-1 hover:bg-white/5 rounded">
                                      {/* Izquierda: Posición y Nombre */}
                                      <div className="flex items-center gap-3">
                                          <span className="text-[#8d6e63] font-mono w-4 font-bold">{index + 1}.</span>
                                          <div className="flex flex-col items-start">
                                              <span className={`font-bold ${p.user_id === winner.user_id ? 'text-yellow-400' : 'text-white'}`}>
                                                  {p.profiles?.username || 'Forastero'}
                                              </span>
                                              <span className="text-xs text-[#d7ccc8] flex items-center gap-1">
                                                  📚 {p.score} libros
                                              </span>
                                          </div>
                                      </div>

                                      {/* Derecha: Dinero Ganado */}
                                      <div className="flex items-center gap-2 bg-green-900/40 px-3 py-1 rounded border border-green-800/50">
                                          <span className="text-lg">💰</span>
                                          <span className={`font-mono text-xl font-bold ${prize > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                              ${prize}
                                          </span>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                      
                      {/* Pie de tabla: Total repartido */}
                      <div className="mt-4 pt-2 border-t border-[#5d4037] flex justify-between px-2 text-xs text-[#8d6e63]">
                          <span>Pozo Total de la Mesa:</span>
                          <span>${room.pot}</span>
                      </div>
                  </div>

                  <button 
                      onClick={() => window.location.href = '/gofish'} 
                      className="bg-[#ffb300] hover:bg-[#ff8f00] text-[#3e2723] font-bold py-4 px-8 rounded-lg w-full font-rye text-xl transition-all hover:scale-[1.02] shadow-lg border-b-4 border-[#ff6f00]"
                  >
                      VOLVER AL SALOON
                  </button>
              </div>
          </div>
      );
  }

  const opponents = players.filter(p => p.user_id !== user.id);
  const isMyTurn = room.turn_player_id === user.id;
  const turnUsername = players.find(p => p.user_id === room.turn_player_id)?.profiles?.username || '...';

  // ============================================
  // FUNCIONES AUXILIARES PARA NOTICIAS GLOBALES
  // ============================================
  
  // Resolver nombre del jugador (siempre muestra el nombre real, nunca "Tú")
  const getPlayerName = (playerId: string | null | undefined): string => {
    if (!playerId) return 'Desconocido';
    const player = players.find(p => p.user_id === playerId);
    return player?.profiles?.username || 'Forastero';
  };

  // Formatear mensaje según el tipo de evento
  const formatGameEvent = (event: any): { icon: string; text: string; color: string; isSpecial: boolean } => {
    if (!event || !event.type) {
      return {
        icon: '🎰',
        text: '¡Bienvenidos al Saloon! Esperando jugada...',
        color: 'text-[#5d4037]',
        isSpecial: false
      };
    }

    const actorName = getPlayerName(event.actor_id);
    const targetName = getPlayerName(event.target_id);
    const rank = event.rank || '?';

    switch (event.type) {
      case 'steal':
        return {
          icon: '🤠',
          text: `${actorName} le robó ${event.amount || 1} carta${event.amount > 1 ? 's' : ''} de ${rank} a ${targetName}`,
          color: 'text-[#2e7d32]',
          isSpecial: false
        };

      case 'fish':
        return {
          icon: '🎣',
          text: `${actorName} pidió ${rank} a ${targetName} pero tuvo que ir a PESCAR`,
          color: 'text-[#1976d2]',
          isSpecial: false
        };

      case 'book':
      case 'book_combo':
        return {
          icon: '📚✨',
          text: `¡${actorName} completó el LIBRO de ${rank}s!`,
          color: 'text-[#ffb300]',
          isSpecial: true
        };

      default:
        return {
          icon: '🎰',
          text: event.message || 'Nueva jugada en la mesa...',
          color: 'text-[#5d4037]',
          isSpecial: false
        };
    }
  };

  // Obtener el evento actual (prioriza lastEvent, luego room.last_game_event)
  const currentEvent = lastEvent || room?.last_game_event;
  const eventDisplay = formatGameEvent(currentEvent);

  return (
    <div className="fixed inset-0 font-rye text-white overflow-hidden border-[12px] border-[#3e2723] shadow-[inset_0_0_80px_rgba(0,0,0,0.8)]">
      {/* Fondo de Terciopelo Verde Realista (Velvet Felt) */}
      {/* Base: Verde oscuro profundo */}
      <div className="absolute inset-0 bg-[#0e2f15]"></div>
      
      {/* Radial Gradient: Iluminación de lámpara de mesa */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1b5e20_0%,_#0e2f15_50%,_#051b0a_100%)]"></div>
      
      {/* Textura de Ruido Granulado (Simula fibra de fieltro) */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(0, 0, 0, 0.03) 0.5deg,
              transparent 1deg,
              rgba(255, 255, 255, 0.01) 1.5deg,
              transparent 2deg
            )
          `,
          backgroundSize: '4px 4px'
        }}
      ></div>
      
      {/* Textura de Fibras Verdes (Refuerzo) */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/green-fibers.png')] opacity-15"></div>

      {/* ============================================
          ZONA SUPERIOR: OPONENTE Y POZO
          ============================================ */}
      
      {/* BOTÓN DE ABANDONAR (Esquina Superior Izquierda) */}
      <motion.button
        onClick={() => setShowLeaveConfirm(true)}
        whileTap={{ scale: 0.95 }}
        className="absolute top-4 left-4 z-50 w-10 h-10 sm:w-12 sm:h-12 bg-[#5d4037] hover:bg-[#8d6e63] border-2 border-[#3e2723] rounded-full flex items-center justify-center shadow-lg transition-all"
        title="Abandonar partida"
      >
        <span className="text-lg sm:text-xl">🚪</span>
      </motion.button>

      {/* POZO (Ficha de Poker Flotante - Esquina Superior Derecha) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="absolute top-4 right-4 z-50 bg-[#3e2723] border-4 border-[#ffb300] px-4 py-2 rounded-lg shadow-[0_4px_8px_rgba(0,0,0,0.5)] backdrop-blur-sm"
      >
        <div className="text-[10px] uppercase tracking-widest text-[#d7ccc8] mb-1">Pozo</div>
        <div className="font-rye text-2xl text-[#ffb300] drop-shadow-md">${room.pot}</div>
      </motion.div>

      {/* CONTADOR DE MIS LIBROS (Debajo del Pozo) */}
      <motion.button
        onClick={() => setShowBooksModal(true)}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-28 right-4 z-50 bg-[#3e2723] border-2 border-[#ffb300] px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-[#4e342e] transition-all"
        title="Ver mis libros"
      >
        <span className="text-lg">📚</span>
        <span className="font-rye text-lg text-[#ffb300] font-bold">
          {myPlayer?.score || 0}
        </span>
      </motion.button>

      {/* ZONA SUPERIOR: BOTÓN DE SELECCIÓN DE RIVAL */}
      <div className="absolute top-4 left-16 sm:left-20 z-40">
        {isMyTurn ? (
          <motion.button
            onClick={() => setShowRivalModal(true)}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-lg shadow-xl border-2 font-rye text-sm sm:text-base transition-all ${
              selectedRivalId
                ? 'bg-[#ffb300]/20 border-[#ffb300] text-[#ffb300]'
                : 'bg-[#3e2723] border-[#5d4037] text-[#d7ccc8] hover:bg-[#4e342e]'
            }`}
          >
            {selectedRivalId ? (
              <span className="flex items-center gap-2">
                <span>🎯</span>
                <span>OBJETIVO: {opponents.find(o => o.user_id === selectedRivalId)?.profiles?.username || '...'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span>🎯</span>
                <span>ELEGIR RIVAL</span>
              </span>
            )}
          </motion.button>
        ) : (
          <div className="px-4 py-2 rounded-lg bg-black/40 border-2 border-[#5d4037] font-rye text-sm sm:text-base text-[#d7ccc8]">
            <span className="flex items-center gap-2">
              <span>⏳</span>
              <span>Turno de {turnUsername}</span>
            </span>
          </div>
        )}
      </div>

      {/* ============================================
          TABLERO DE NOTICIAS GLOBALES (Banner Central)
          ============================================ */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-full px-4 z-30 max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEvent?.ts || currentEvent?.type || 'default'}
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`relative bg-[#d7ccc8] border-2 border-[#5d4037] rounded-lg shadow-lg px-4 py-3 sm:px-6 sm:py-4 text-center ${
              eventDisplay.isSpecial ? 'ring-2 ring-[#ffb300] ring-opacity-50' : ''
            }`}
            style={{
              backgroundImage: `url('https://www.transparenttextures.com/patterns/paper.png')`,
              backgroundSize: 'cover',
              backgroundBlendMode: 'overlay'
            }}
          >
            {/* Efecto de papel viejo con textura */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50/30 to-amber-100/20 rounded-lg opacity-60"></div>
            
            {/* Contenido del mensaje */}
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-1">
                <span className="text-xl sm:text-2xl">{eventDisplay.icon}</span>
                <p className={`font-rye text-base sm:text-lg sm:text-xl font-bold ${eventDisplay.color} ${
                  eventDisplay.isSpecial ? 'animate-pulse' : ''
                }`}>
                  {eventDisplay.text}
                </p>
              </div>
            </div>

            {/* Decoración de esquinas (clavos de papel) */}
            <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[#5d4037]/40"></div>
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#5d4037]/40"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-[#5d4037]/40"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-[#5d4037]/40"></div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ============================================
          ZONA CENTRAL: MAZO DE PESCA
          ============================================ */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-4 flex flex-col items-center gap-3 z-20">
        {/* Mazo de Pesca (Centrado - 40% más grande) */}
        <motion.div 
          className="relative overflow-visible p-2"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div 
            className="w-28 h-40 sm:w-32 sm:h-48 bg-white rounded-lg border-4 border-[#1a0f0d] shadow-2xl overflow-visible p-1"
          >
            <img 
              src="/cards/BACK.svg" 
              alt="Mazo" 
              className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="absolute -top-2 -right-2 bg-[#3e2723] border-2 border-[#ffb300] text-[#ffb300] w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg z-10">
            {room.deck?.length || 0}
          </div>
          <p className="text-center text-[8px] sm:text-xs mt-1 text-[#d7ccc8] uppercase tracking-wider">Mazo</p>
        </motion.div>
      </div>
      
      {/* ============================================
          ZONA INFERIOR: MI MANO (PRIORIDAD #1)
          ============================================ */}
      <div className="fixed bottom-0 left-0 w-full overflow-visible pb-safe z-20 px-4 sm:px-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 1rem)' }}>
        <div className="h-48 sm:h-56 pt-20 pb-4 overflow-visible">
          <AnimatePresence>
            <motion.div 
              layout
              className="flex justify-center items-end h-full overflow-visible"
            >
              {myPlayer?.hand?.map((card: any, index: number) => {
                const isSelected = selectedRank === card.rank;
                return (
                  <motion.div
                    key={`${card.suit}-${card.rank}`}
                    layoutId={`${card.suit}-${card.rank}`}
                    onClick={() => isMyTurn && setSelectedRank(isSelected ? null : card.rank)}
                    animate={{ 
                      y: isSelected ? -40 : 0, 
                      zIndex: isSelected ? 50 : index,
                      scale: isSelected ? 1.1 : 1
                    }}
                    whileHover={{ 
                      y: -20, 
                      zIndex: 51, 
                      scale: 1.05,
                      transition: { duration: 0.2 } 
                    }}
                    className={`relative cursor-pointer drop-shadow-2xl transition-all duration-300 ${
                      index === 0 ? '' : '-ml-12 sm:-ml-16'
                    }`}
                  >
                    <div className="relative inline-block">
                      <img
                        src={card.suit === 'back' || card.rank === 'back' 
                          ? '/cards/BACK.svg' 
                          : `/cards/${card.suit}${card.rank}.svg`}
                        alt={card.suit === 'back' || card.rank === 'back' 
                          ? 'Carta trasera' 
                          : `${card.rank} of ${card.suit}`}
                        className="h-48 sm:h-56 w-auto block"
                        onError={(e) => { e.currentTarget.src = '/cards/JOKER_BLACK.svg'; }}
                      />
                      {isSelected && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute rounded-lg border-4 border-[#ffb300] shadow-[0_0_20px_rgba(255,179,0,0.8)] pointer-events-none"
                          style={{
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            borderRadius: '0.5rem',
                            boxSizing: 'border-box'
                          }}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ============================================
          CONTROLES FLOTANTES (Justo Encima de la Mano)
          ============================================ */}
      
      {/* Botón de Acción Principal (Solo visible cuando todo está listo) */}
      <AnimatePresence>
        {isMyTurn && selectedRank && selectedRivalId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="fixed bottom-[220px] sm:bottom-[260px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
          >
            <motion.button
              onClick={handlePlayTurn}
              disabled={processing}
              whileTap={{ scale: 0.95 }}
              className="w-full font-rye text-base sm:text-lg py-3 sm:py-4 rounded-lg shadow-xl border-b-4 bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] border-[#ff6f00] active:border-b-0 active:translate-y-1 transition-all disabled:opacity-60"
            >
              {processing ? (
                '🎣 Pescando...'
              ) : (
                `ROBAR A ${opponents.find(o => o.user_id === selectedRivalId)?.profiles?.username || '...'}`
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensaje de Espera (Cuando no es mi turno) */}
      {!isMyTurn && (
        <motion.div 
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="fixed bottom-[220px] sm:bottom-[260px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
        >
          <div className="w-full bg-black/60 backdrop-blur-sm border-2 border-[#5d4037] text-center py-3 rounded-lg">
            <p className="font-rye text-sm sm:text-base text-[#ffb300]">Esperando a {turnUsername}...</p>
          </div>
        </motion.div>
      )}

      {/* Botón de Pasar/Robar (Solo cuando no tengo cartas) */}
      {isMyTurn && (!myPlayer?.hand || myPlayer.hand.length === 0) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-[220px] sm:bottom-[260px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm px-4"
        >
          <motion.button
            onClick={handlePassTurn}
            disabled={processing}
            whileTap={{ scale: 0.95 }}
            className="w-full font-rye text-base sm:text-lg py-3 sm:py-4 rounded-lg shadow-xl border-b-4 bg-[#3e2723] hover:bg-[#4e342e] text-[#ffb300] border-[#5d4037] active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
          >
            {processing ? '...' : (room.deck?.length > 0 ? '🃏 Robar del Mazo' : '⏭️ Pasar Turno')}
          </motion.button>
        </motion.div>
      )}

      {/* ============================================
          MODAL DE SELECCIÓN DE RIVALES (Wanted Poster)
          ============================================ */}
      <AnimatePresence>
        {showRivalModal && (
          <>
            {/* Backdrop Oscuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRivalModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300]"
            />
            
            {/* Modal Principal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full z-[301] bg-[#3e2723] border-[8px] border-[#5d4037] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Fondo de Papel Viejo/Wanted Poster */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] opacity-10"></div>
              <div className="absolute inset-0 bg-gradient-to-b from-[#3e2723] via-[#4e342e] to-[#3e2723]"></div>
              
              {/* Contenido del Modal */}
              <div className="relative p-6 sm:p-8">
                {/* Título */}
                <div className="text-center mb-6">
                  <h2 className="font-rye text-3xl sm:text-4xl text-[#ffb300] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] mb-2">
                    WANTED
                  </h2>
                  <p className="text-sm text-[#d7ccc8] uppercase tracking-widest">Elige tu objetivo</p>
                </div>

                {/* Lista de Rivales */}
                <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  {opponents.map((opp) => {
                    const isOppTurn = room.turn_player_id === opp.user_id;
                    const cardCount = opp.hand?.length || 0;
                    const booksCount = opp.books?.length || 0;
                    const isSelected = selectedRivalId === opp.user_id;
                    
                    return (
                      <motion.button
                        key={opp.user_id}
                        onClick={() => {
                          setSelectedRivalId(opp.user_id);
                          setShowRivalModal(false);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'bg-[#ffb300]/30 border-[#ffb300] shadow-lg ring-2 ring-[#ffb300]'
                            : 'bg-[#1a0f0d]/60 border-[#5d4037] hover:bg-[#2d1b15] hover:border-[#8d6e63]'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar/Ícono */}
                          <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center text-2xl sm:text-3xl ${
                            isSelected
                              ? 'border-[#ffb300] bg-[#ffb300]/20'
                              : 'border-[#5d4037] bg-[#2d1b15]'
                          }`}>
                            {opp.profiles?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={opp.profiles.avatar_url} 
                                alt={opp.profiles?.username || 'Jugador'}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <span>🤠</span>
                            )}
                          </div>

                          {/* Información del Jugador */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`font-rye text-base sm:text-lg font-bold truncate ${
                                isSelected ? 'text-[#ffb300]' : 'text-[#d7ccc8]'
                              }`}>
                                {opp.profiles?.username || 'Forastero'}
                              </span>
                              {isOppTurn && (
                                <motion.span
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ repeat: Infinity, duration: 1.5 }}
                                  className="text-[8px] bg-[#ffb300] text-[#3e2723] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap"
                                >
                                  TURNO
                                </motion.span>
                              )}
                            </div>
                            
                            {/* Estadísticas */}
                            <div className="flex items-center gap-3 text-xs sm:text-sm text-[#a1887f]">
                              <span className="flex items-center gap-1">
                                <span>🃏</span>
                                <span>{cardCount} cartas</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span>📚</span>
                                <span>{booksCount} libros</span>
                              </span>
                            </div>
                          </div>

                          {/* Indicador de Selección */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-2xl"
                            >
                              ✓
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Botón de Cerrar */}
                <div className="mt-6 flex justify-center">
                  <motion.button
                    onClick={() => setShowRivalModal(false)}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye rounded-lg border-2 border-[#8d6e63] transition-all"
                  >
                    Cerrar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ============================================
          MODAL DE CONFIRMACIÓN DE ABANDONO
          ============================================ */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <>
            {/* Backdrop Oscuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaveConfirm(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400]"
            />
            
            {/* Modal de Confirmación */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full z-[401] bg-[#3e2723] border-[8px] border-[#5d4037] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="p-6 sm:p-8 text-center">
                <div className="text-5xl mb-4">🚪</div>
                <h2 className="font-rye text-2xl sm:text-3xl text-[#ffb300] mb-4">
                  ¿Seguro que quieres huir, vaquero?
                </h2>
                <p className="text-[#d7ccc8] mb-6 text-sm sm:text-base">
                  Tus cartas volverán al mazo y perderás tu lugar en la mesa.
                </p>
                
                <div className="flex gap-4 justify-center">
                  <motion.button
                    onClick={() => setShowLeaveConfirm(false)}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye rounded-lg border-2 border-[#8d6e63] transition-all"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    onClick={handleLeaveRoom}
                    disabled={processing}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-[#c62828] hover:bg-[#d32f2f] text-white font-rye rounded-lg border-2 border-[#b71c1c] transition-all disabled:opacity-50"
                  >
                    {processing ? 'Saliendo...' : 'Abandonar'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ============================================
          MODAL DE LIBROS FORMADOS
          ============================================ */}
      <AnimatePresence>
        {showBooksModal && (
          <>
            {/* Backdrop Oscuro */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBooksModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[400]"
            />
            
            {/* Modal de Libros */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full z-[401] bg-[#3e2723] border-[8px] border-[#ffb300] rounded-lg shadow-[0_0_50px_rgba(255,179,0,0.3)] overflow-hidden"
            >
              <div className="p-6 sm:p-8">
                <div className="text-center mb-6">
                  <div className="text-5xl mb-2">📚</div>
                  <h2 className="font-rye text-2xl sm:text-3xl text-[#ffb300] mb-2">
                    Tus Libros
                  </h2>
                  <p className="text-[#d7ccc8] text-sm">
                    Total: {myPlayer?.score || 0} libro{(myPlayer?.score || 0) !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Lista de Libros */}
                <div className="min-h-[100px]">
                  {myPlayer?.books && Array.isArray(myPlayer.books) && myPlayer.books.length > 0 ? (
                    <div className="flex flex-wrap gap-3 justify-center">
                      {myPlayer.books.map((book: string, index: number) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="bg-[#ffb300] text-[#3e2723] font-rye text-xl sm:text-2xl font-bold px-4 py-2 rounded-lg border-2 border-[#ff6f00] shadow-lg"
                        >
                          [{book}]
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[#a1887f] font-rye text-lg">
                        Aún no tienes libros
                      </p>
                      <p className="text-[#8d6e63] text-sm mt-2">
                        Forma 4 cartas del mismo rango para crear un libro
                      </p>
                    </div>
                  )}
                </div>

                {/* Botón de Cerrar */}
                <div className="mt-6 flex justify-center">
                  <motion.button
                    onClick={() => setShowBooksModal(false)}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-2 bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye rounded-lg border-2 border-[#8d6e63] transition-all"
                  >
                    Cerrar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}