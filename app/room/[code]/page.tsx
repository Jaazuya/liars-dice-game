'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useLiarGame } from '@/app/hooks/useLiarGame';
import { useGameSounds } from '@/app/hooks/useGameSounds';
import { Lobby } from '@/app/components/Lobby';
import { WantedIntro } from '@/app/components/WantedIntro';
import { RivalsStrip, GameTable, TopBar } from '@/app/components/GameComponents';
import { AnimatedDice } from '@/app/components/AnimatedDice';
import { DiceCup } from '@/app/components/DiceCup';
import { GameSettings } from '@/app/components/GameSettings';
import { GameNotification } from '@/app/components/GameNotification';
import { RoundResult } from '@/app/components/RoundResult';
import GameOverScreen from '@/app/components/GameOverScreen';
import { WesternDecor } from '@/app/components/WesternDecor';
import WesternNotificationBanner from '@/app/components/WesternNotificationBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/app/lib/supabase';

export default function RoomPage() {
  const { code } = useParams();
  const codeStr = (Array.isArray(code) ? code[0] : code || '').toString().toUpperCase();
  const { players, myId, gameState, roomId, getDiceEmoji, actions, loading } = useLiarGame(
    codeStr,
    (message, type) => setNotification({ message, type }),
    // onRoundResult ya no se usa, las notificaciones vienen de gameState.notificationData
    undefined
  );
  const sounds = useGameSounds(true);
  
  const [betQty, setBetQty] = useState(1);
  const [betQtyInput, setBetQtyInput] = useState('1');
  const [betFace, setBetFace] = useState(2);
  const [isShakingDice, setIsShakingDice] = useState(false);
  const [prevDiceValues, setPrevDiceValues] = useState<number[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type?: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Variable derivada necesaria para hooks subsiguientes
  const myPlayer = players.find(p => p.id === myId);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calcular total de dados en la mesa (necesario para validaciones en render, no en hooks)
  const totalDiceOnTable = players.reduce((total, p) => {
    return total + (p.dice_values?.length || 0);
  }, 0);

  useEffect(() => {
    // Cuando hay una apuesta, establecer la cantidad mínima para subir
    // SIEMPRE debes aumentar la cantidad, sin importar la cara
    if (gameState.currentBet.quantity > 0) {
      // La cantidad mínima siempre es currentBet.quantity + 1
      const newQty = gameState.currentBet.quantity + 1;
      setBetQty(newQty);
      setBetQtyInput(newQty.toString());
    } else {
      // Si no hay apuesta, empezar en 1
      setBetQty(1);
      setBetQtyInput('1');
    }
  }, [gameState.currentBet]);

  // Detectar cuando se barajan los dados (solo cuando cambian realmente)
  useEffect(() => {
    const currentDice = myPlayer?.dice_values || [];
    const currentDiceString = JSON.stringify(currentDice);
    const prevDiceString = JSON.stringify(prevDiceValues);
    
    // Solo animar si los dados realmente cambiaron (no solo se actualizó la referencia)
    if (prevDiceValues.length > 0 && currentDiceString !== prevDiceString) {
      // Verificar que realmente hay una diferencia en los valores
      const currentSorted = [...currentDice].sort().join(',');
      const prevSorted = [...prevDiceValues].sort().join(',');
      
      if (currentSorted !== prevSorted) {
        setIsShakingDice(true);
        sounds.playDiceShake();
        const timer = setTimeout(() => setIsShakingDice(false), 1500);
        setPrevDiceValues(currentDice);
        return () => clearTimeout(timer);
      } else {
        // Si los valores son iguales, solo actualizar la referencia
        setPrevDiceValues(currentDice);
      }
    } else if (prevDiceValues.length === 0 && currentDice.length > 0) {
      // Primera vez que se asignan dados
      setPrevDiceValues(currentDice);
    }
  }, [myPlayer?.dice_values, sounds]); // myPlayer se usa aquí

  // Función para cerrar la notificación (definida antes del useEffect que la usa)
  const handleCloseNotification = () => {
    // Esto borra los datos y hace desaparecer el cartel
    // Nota: El notificationData se limpia automáticamente desde el backend,
    // pero podemos forzar la limpieza local si es necesario
    // Por ahora, el backend maneja la limpieza automática
  };

  // Control del retraso dramático para Game Over (5 segundos después de que termine el juego)
  useEffect(() => {
    if (gameState.status === 'finished' && gameState.gameOverData) {
      // Esperamos 5 segundos de drama...
      const timer = setTimeout(() => {
        // 1. 🔥 MATAMOS LA NOTIFICACIÓN (Para que no estorbe)
        // Cierra la notificación justo antes de mostrar la pantalla de victoria
        handleCloseNotification();
        
        // 2. MOSTRAMOS LA PANTALLA DE VICTORIA
        setShowGameOver(true);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      // Si el juego se reinicia o cambia de estado, ocultamos la pantalla
      setShowGameOver(false);
    }
  }, [gameState.status, gameState.gameOverData, handleCloseNotification]);

  // Funciones de zoom (incrementos de 5%)
  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 0.05, 2);
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 0.05, 0.75);
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    // Scroll al inicio cuando se resetea
    if (gameContainerRef.current?.parentElement) {
      gameContainerRef.current.parentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  const isMyTurn = gameState.currentTurnId === myId;
  const amIEliminated = (myPlayer?.dice_values?.length || 0) === 0;
  const lastBetName =
    (gameState.lastBetUserId
      ? players.find(p => p.user_id === gameState.lastBetUserId)?.name ||
        players.find(p => p.id === gameState.lastBetUserId)?.name
      : null) || null;

  // Detectar si soy el host
  const isHost = !!myPlayer?.is_host;

  // Función para reiniciar la partida (Solo la usará el Host)
  const handlePlayAgain = async () => {
    if (!codeStr || !isHost) return;
    
    try {
      console.log("Intentando reiniciar sala con código:", codeStr); // Para depurar

      // 🔥 CAMBIO AQUÍ: Usamos 'p_room_code' y le pasamos la variable 'codeStr' (string)
      const { error } = await supabase.rpc('reset_liar_game', { 
        p_room_code: codeStr 
      });
      
      if (error) {
        // Imprime el mensaje real del error para verlo mejor
        console.error('Error SQL:', error.message, error.details);
        throw error;
      }

      console.log("¡Partida reiniciada con éxito!");
      
      // No necesitas hacer nada más, el Realtime detectará 
      // el cambio de fase a 'lobby' y actualizará la pantalla solo.
      
    } catch (err) {
      console.error("Error crítico reiniciando:", err);
      // Aquí podrías mostrar una notificación de error si quieres
    }
  };

  // --- PANTALLA DE CARGA (MOVIDA DESPUÉS DE TODOS LOS HOOKS) ---
  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        <div className="text-[#ffb300] text-2xl font-rye animate-pulse relative z-10">
          Entrando al Saloon...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] font-serif flex flex-col relative">
      
      {/* Fondo Común - Fijo */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-repeat"></div>
      
      {/* Decoración Western (solo en esquinas cuando está jugando) */}
      {gameState.status === 'playing' && (
        <WesternDecor variant="corners" className="opacity-20 fixed inset-0 pointer-events-none" />
      )}


          {/* --- FASE 1: LOBBY DE ESPERA --- */}
          {gameState.status === 'not_found' && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-[#3e2723] border-4 border-[#ffb300] rounded-lg p-6 text-center max-w-lg w-full">
                <div className="text-[#ffb300] font-rye text-2xl mb-2">Sala no encontrada</div>
                <div className="text-[#d7ccc8] text-sm mb-4">
                  Código: <span className="font-mono font-bold">{codeStr || '—'}</span>
                </div>
                <button
                  onClick={() => (window.location.href = '/')}
                  className="w-full bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-3 rounded border-2 border-[#ff6f00] uppercase"
                >
                  Volver al Inicio
                </button>
              </div>
            </div>
          )}

          {gameState.status === 'waiting' && (
            <Lobby
                code={codeStr}
                players={players}
                isHost={myPlayer?.is_host}
                entryFee={gameState.entryFee}
                onUpdateFee={actions.updateEntryFee}
                onStart={actions.openTable}
                onKick={actions.kickPlayer}
                onAbandon={actions.abandonGame}
                allowCheats={gameState.allowCheats}
                onToggleCheats={actions.toggleCheats}
                randomTurns={gameState.randomTurns}
                onToggleRandomTurns={actions.toggleRandomTurns}
            />
          )}

      {/* --- FASE 2: CARTEL DE APUESTAS (BOARDING) --- */}
      {/* Se muestra si la sala está en 'boarding', O si ya está en 'playing' pero yo no estoy listo aún */}
      {(gameState.status === 'boarding' || (gameState.status === 'playing' && !myPlayer?.is_ready)) && (
          <WantedIntro 
              entryFee={gameState.entryFee} 
              players={players}
              myId={myId}
              onPay={actions.payEntry}
              onKick={actions.kickPlayer}
              isHost={myPlayer?.is_host}
              onAbandon={actions.abandonGame}
          />
      )}

      {/* --- FASE 3: MESA DE JUEGO --- */}
      {/* Solo visible si la sala está 'playing' Y yo ya pagué */}
      <div 
        className={`flex-1 flex flex-col relative z-10 w-full min-h-screen transition-opacity duration-1000 ${gameState.status === 'playing' && myPlayer?.is_ready ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'}`}
      >
        {/* Botón Abandonar (Esquina superior izquierda) */}
        <button
          onClick={actions.abandonGame}
          className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
        >
          🚪 Abandonar
        </button>
        <div 
          ref={gameContainerRef}
          className="w-full"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease-out'
          }}
        >
            
            <TopBar 
                me={myPlayer} 
                pot={gameState.pot} 
                myTurn={isMyTurn && !amIEliminated}
                turnName={players.find(p => p.id === gameState.currentTurnId)?.name}
                entryFee={gameState.entryFee}
            />


            <RivalsStrip 
                players={players} 
                myId={myId} 
                currentTurnId={gameState.currentTurnId} 
                amIHost={!!myPlayer?.is_host}
                onKick={actions.kickPlayer} // Expulsión inmediata del Host
            />

            <GameTable 
                bet={gameState.currentBet} 
                getEmoji={getDiceEmoji}
                lastBetName={lastBetName}
            />

            <div className="bg-[#2d1b15] border-t-2 sm:border-t-4 border-[#5d4037] p-2 sm:p-3 md:p-4 pb-4 sm:pb-6 md:pb-8 shrink-0 flex flex-col items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative z-20">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] pointer-events-none"></div>
                <div className="w-full max-w-lg flex flex-col gap-2 sm:gap-3 md:gap-4 relative z-10 px-2 sm:px-4">
                    <DiceCup 
                        values={myPlayer?.dice_values || []}
                        isShaking={isShakingDice}
                        onShakeComplete={() => setIsShakingDice(false)}
                    />

                    {isMyTurn && !amIEliminated && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col gap-2 sm:gap-3 md:gap-4 w-full"
                        >
                            {gameState.currentBet.quantity > 0 && (
                                <div className="flex gap-2 sm:gap-3 w-full">
                                    <motion.button 
                                        onClick={() => {
                                            sounds.playLiar();
                                            actions.resolveRound('LIAR');
                                        }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex-1 bg-[#b71c1c] text-[#ffcdd2] font-rye text-sm sm:text-base md:text-lg lg:text-xl py-2.5 sm:py-3 md:py-4 rounded-lg sm:rounded-xl border-b-[4px] sm:border-b-[6px] border-[#7f0000] active:border-b-0 active:translate-y-1 shadow-xl"
                                    >
                                        ¡MENTIROSO!
                                    </motion.button>
                                    <motion.button 
                                        onClick={() => {
                                            sounds.playButtonClick();
                                            actions.resolveRound('EXACT');
                                        }}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex-1 bg-[#0d47a1] text-[#bbdefb] font-rye text-sm sm:text-base md:text-lg lg:text-xl py-2.5 sm:py-3 md:py-4 rounded-lg sm:rounded-xl border-b-[4px] sm:border-b-[6px] border-[#002171] active:border-b-0 active:translate-y-1 shadow-xl"
                                    >
                                        ¡EXACTO!
                                    </motion.button>
                                </div>
                            )}
                            
                            {/* BOTÓN DE ESPIONAJE (Truco) */}
                            {gameState.allowCheats && gameState.currentBet.quantity > 0 && (
                                <motion.button
                                    onClick={async () => {
                                        sounds.playButtonClick();
                                        const count = await actions.useCheat();
                                        if (count !== null) {
                                            const diceEmoji = getDiceEmoji(gameState.currentBet.face);
                                            setNotification({
                                                message: `🕵️ Psst... Hay exactamente ${count} dados de ${diceEmoji}.`,
                                                type: 'info'
                                            });
                                        }
                                    }}
                                    disabled={!!myPlayer?.has_used_cheat}
                                    whileHover={{ scale: myPlayer?.has_used_cheat ? 1 : 1.05 }}
                                    whileTap={{ scale: myPlayer?.has_used_cheat ? 1 : 0.95 }}
                                    className={`w-full bg-[#6a1b9a] text-[#e1bee7] font-rye text-sm sm:text-base md:text-lg py-2 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl border-b-[4px] sm:border-b-[6px] border-[#4a148c] active:border-b-0 active:translate-y-1 shadow-xl flex items-center justify-center gap-2 ${
                                        myPlayer?.has_used_cheat ? 'opacity-50 cursor-not-allowed grayscale' : ''
                                    }`}
                                    title={myPlayer?.has_used_cheat ? 'Ya usaste tu truco' : 'Espiar dados en la mesa (solo 1 vez por partida)'}
                                >
                                    <span>👁️</span>
                                    <span>{myPlayer?.has_used_cheat ? 'TRUCO USADO' : 'ESPIAR'}</span>
                                </motion.button>
                            )}
                            
                            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 bg-black/40 p-2 sm:p-3 md:p-4 lg:p-5 rounded-xl sm:rounded-2xl border-2 border-[#5d4037] w-full">
                                <div className="flex flex-col items-center w-full">
                                    <label className="text-[#ffb300] font-sans text-[9px] sm:text-[10px] md:text-xs tracking-[0.2em] sm:tracking-[0.3em] mb-1 sm:mb-2 font-bold">CANTIDAD</label>
                                    <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                                        <motion.button
                                            onClick={() => {
                                                sounds.playButtonClick();
                                                // La cantidad mínima siempre es currentBet.quantity + 1
                                                const minQty = gameState.currentBet.quantity > 0 
                                                    ? gameState.currentBet.quantity + 1 
                                                    : 1;
                                                const newQty = Math.max(minQty, betQty - 1);
                                                setBetQty(newQty);
                                                setBetQtyInput(newQty.toString());
                                            }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-[#3e2723] text-[#ffb300] rounded-lg sm:rounded-xl border-2 border-[#5d4037] flex items-center justify-center text-2xl sm:text-3xl font-bold hover:bg-[#4e342e] transition-colors shadow-md"
                                        >
                                            −
                                        </motion.button>
                                        <input
                                            type="number"
                                            min={gameState.currentBet.quantity > 0 
                                                ? gameState.currentBet.quantity + 1 
                                                : 1}
                                            max={totalDiceOnTable}
                                            value={betQtyInput}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                // Si está vacío o es solo "0", permitir borrar
                                                if (value === '' || value === '0') {
                                                    setBetQtyInput(value);
                                                    return;
                                                }
                                                const num = parseInt(value);
                                                // La cantidad mínima siempre es currentBet.quantity + 1
                                                const minQty = gameState.currentBet.quantity > 0 
                                                    ? gameState.currentBet.quantity + 1 
                                                    : 1;
                                                if (!isNaN(num) && num >= minQty && num <= totalDiceOnTable) {
                                                    setBetQtyInput(value);
                                                    setBetQty(num);
                                                }
                                            }}
                                            onFocus={(e) => {
                                                if (e.target.value === '0' || e.target.value === '') {
                                                    e.target.select();
                                                }
                                            }}
                                            onBlur={(e) => {
                                                // La cantidad mínima siempre es currentBet.quantity + 1
                                                const minQty = gameState.currentBet.quantity > 0 
                                                    ? gameState.currentBet.quantity + 1 
                                                    : 1;
                                                if (e.target.value === '' || parseInt(e.target.value) < minQty) {
                                                    setBetQtyInput(minQty.toString());
                                                    setBetQty(minQty);
                                                } else {
                                                    const num = Math.min(totalDiceOnTable, Math.max(minQty, parseInt(e.target.value) || minQty));
                                                    setBetQtyInput(num.toString());
                                                    setBetQty(num);
                                                }
                                            }}
                                            className="w-20 h-14 sm:w-24 sm:h-16 md:w-28 md:h-18 lg:w-32 lg:h-20 text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-rye bg-[#3e2723] text-[#ffb300] rounded-lg sm:rounded-xl border-2 border-[#5d4037] outline-none shadow-inner"
                                        />
                                        <motion.button
                                            onClick={() => {
                                                sounds.playButtonClick();
                                                const newQty = Math.min(totalDiceOnTable, betQty + 1);
                                                setBetQty(newQty);
                                                setBetQtyInput(newQty.toString());
                                            }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-[#3e2723] text-[#ffb300] rounded-lg sm:rounded-xl border-2 border-[#5d4037] flex items-center justify-center text-2xl sm:text-3xl font-bold hover:bg-[#4e342e] transition-colors shadow-md"
                                        >
                                            +
                                        </motion.button>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center w-full">
                                    <label className="text-[#ffb300] font-sans text-[9px] sm:text-[10px] md:text-xs tracking-[0.2em] sm:tracking-[0.3em] mb-1 sm:mb-2 mt-0.5 sm:mt-1 font-bold">CARA DEL DADO</label>
                                    <div className="flex justify-center gap-1 sm:gap-1.5 md:gap-2 w-full px-0.5 sm:px-1">
                                        {[1,2,3,4,5,6].map(n => (
                                            <motion.button 
                                                key={n} 
                                                onClick={() => {
                                                    sounds.playButtonClick();
                                                    setBetFace(n);
                                                }}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                className={`shrink-0 flex-1 h-10 sm:h-12 md:h-14 lg:h-16 rounded-lg sm:rounded-xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl flex items-center justify-center transition-all border-2 shadow-md ${betFace === n ? 'bg-[#ffb300] border-[#ff6f00] text-black scale-105 z-10' : 'bg-[#3e2723] border-[#5d4037] text-white/50'}`}
                                            >
                                                {getDiceEmoji(n)}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                                <motion.button 
                                    onClick={() => {
                                        // Validar apuesta antes de enviar
                                        const currentBet = gameState.currentBet;
                                        
                                        // Validar que la cantidad no exceda el total de dados en la mesa
                                        if (betQty > totalDiceOnTable) {
                                            setNotification({ 
                                                message: `No puedes apostar más de ${totalDiceOnTable} dados (total en la mesa).`, 
                                                type: 'error' 
                                            });
                                            return;
                                        }
                                        
                                        // Validar que siempre se aumente la cantidad
                                        if (currentBet.quantity > 0 && betQty <= currentBet.quantity) {
                                            setNotification({ 
                                                message: `Debes aumentar la cantidad. La apuesta actual es ${currentBet.quantity}, debes apostar al menos ${currentBet.quantity + 1}.`, 
                                                type: 'error' 
                                            });
                                            return;
                                        }
                                        
                                        if (betQty > 0 && betFace >= 1 && betFace <= 6) {
                                            sounds.playBetPlaced();
                                            actions.placeBet(betQty, betFace);
                                        } else {
                                            setNotification({ 
                                                message: 'Apuesta inválida. Verifica la cantidad y la cara del dado.', 
                                                type: 'error' 
                                            });
                                        }
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full mt-1 sm:mt-2 h-11 sm:h-12 md:h-14 lg:h-16 bg-[#2e7d32] text-[#a5d6a7] font-rye text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl rounded-lg sm:rounded-xl border-b-[4px] sm:border-b-[6px] border-[#1b5e20] active:border-b-0 active:translate-y-1 shadow-[0_5px_0_#1b5e20] uppercase tracking-wider sm:tracking-widest leading-none flex items-center justify-center"
                                >
                                    SUBIR APUESTA
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* SETTINGS (Siempre visible durante el juego) */}
      {gameState.status === 'playing' && myPlayer?.is_ready && (
        <GameSettings
          zoomLevel={zoomLevel}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
        />
      )}

      {/* NOTIFICACIONES DEL JUEGO - Deshabilitado: Solo usamos WesternNotificationBanner */}
      {/* <AnimatePresence>
        {notification && (
          <GameNotification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </AnimatePresence> */}

      {/* RESULTADO DE RONDA - Deshabilitado: Solo usamos WesternNotificationBanner */}
      {/* <AnimatePresence>
        {gameState.notificationData && (
          <RoundResult
            message={gameState.notificationData.message}
            type={gameState.notificationData.type}
            onClose={() => {
              // No hacer nada aquí, el Host manejará el siguiente paso automáticamente
              // La notificación desaparecerá cuando notification_data se limpie en la BD
            }}
            autoCloseDelay={undefined}
          />
        )}
      </AnimatePresence> */}

      {/* PANTALLA DE FIN DE JUEGO (Con retraso dramático de 5 segundos) */}
      <AnimatePresence>
        {showGameOver && gameState.gameOverData && (
          <GameOverScreen
            gameOverData={gameState.gameOverData}
            currentUserId={myPlayer?.user_id || null}
            isHost={isHost}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </AnimatePresence>

      {/* 🔥 BANNER DE NOTIFICACIONES (ÚNICA INSTANCIA - Al final para que flote sobre todo) */}
      <WesternNotificationBanner 
        data={gameState.notificationData}
        onClose={handleCloseNotification}
      />
    </main>
  );
}