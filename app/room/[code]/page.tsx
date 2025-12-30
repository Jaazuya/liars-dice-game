'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useLiarGame } from '@/app/hooks/useLiarGame';
import { useGameSounds } from '@/app/hooks/useGameSounds';
import { Lobby } from '@/app/components/Lobby';
import { WantedIntro } from '@/app/components/WantedIntro';
import { KickModal } from '@/app/components/KickModal';
import { RivalsStrip, GameTable, TopBar } from '@/app/components/GameComponents';
import { AnimatedDice } from '@/app/components/AnimatedDice';
import { DiceCup } from '@/app/components/DiceCup';
import { GameSettings } from '@/app/components/GameSettings';
import { GameNotification } from '@/app/components/GameNotification';
import { RoundResult } from '@/app/components/RoundResult';
import { motion, AnimatePresence } from 'framer-motion';

export default function RoomPage() {
  const { code } = useParams();
  const { players, myId, gameState, getDiceEmoji, actions } = useLiarGame(
    code as string,
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
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Detectar si es móvil
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const myPlayer = players.find(p => p.id === myId);
  
  // Calcular total de dados en la mesa
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
  }, [myPlayer?.dice_values, sounds]);
  const isMyTurn = gameState.currentTurnId === myId;
  const amIEliminated = (myPlayer?.dice_values?.length || 0) === 0;

  // Lógica Modal Votación
  const showKickModal = gameState.voteData && gameState.voteData.target_id !== myId && !gameState.voteData.votes[myId];

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

  return (
    <main className="min-h-screen bg-[#0d0d0d] font-serif flex flex-col relative">
      
      {/* Fondo Común - Fijo */}
      <div className="fixed inset-0 -z-10 pointer-events-none opacity-40 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-repeat"></div>

      {/* --- MODAL VOTACIÓN (Siempre encima) --- */}
      {showKickModal && gameState.voteData && (
          <KickModal voteData={gameState.voteData} onVote={actions.castVote} />
      )}

      {/* --- FASE 1: LOBBY DE ESPERA --- */}
      {gameState.status === 'waiting' && (
        <Lobby 
            code={code} 
            players={players} 
            isHost={myPlayer?.is_host} 
            entryFee={gameState.entryFee} 
            onUpdateFee={actions.updateEntryFee} 
            onStart={actions.openTable} 
            onKick={actions.startKickVote} 
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
          />
      )}

      {/* --- FASE 3: MESA DE JUEGO --- */}
      {/* Solo visible si la sala está 'playing' Y yo ya pagué */}
      <div 
        className={`flex-1 flex flex-col relative z-10 w-full min-h-screen transition-opacity duration-1000 ${gameState.status === 'playing' && myPlayer?.is_ready ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'}`}
      >
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
            />

            <RivalsStrip 
                players={players} 
                myId={myId} 
                currentTurnId={gameState.currentTurnId} 
                amIHost={!!myPlayer?.is_host}
                onKick={actions.startKickVote} // Aquí también funciona el kick durante el juego
            />

            <GameTable 
                bet={gameState.currentBet} 
                getEmoji={getDiceEmoji} 
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

      {/* NOTIFICACIONES DEL JUEGO */}
      <AnimatePresence>
        {notification && (
          <GameNotification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </AnimatePresence>

      {/* RESULTADO DE RONDA (Anuncio Grande) - Sincronizado Globalmente */}
      <AnimatePresence>
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
      </AnimatePresence>
    </main>
  );
}