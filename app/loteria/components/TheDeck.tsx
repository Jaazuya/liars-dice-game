import { useState, useEffect, useRef } from 'react';

interface TheDeckProps {
  isHost: boolean;
  isPlaying: boolean;
  currentCardId: number | null;
  drawnCards: number[];
  gameSpeed: number;
  isPaused: boolean;
  onTogglePause: (paused: boolean) => void;
  onUpdateCard: (cardId: number | null, drawnCards: number[]) => Promise<void>;
  onReset: () => Promise<void>;
}

export default function TheDeck({ isHost, currentCardId, drawnCards, onUpdateCard, onReset, gameSpeed, isPaused, onTogglePause }: TheDeckProps) {
  // Estado local de la UI
  const [gameStarted, setGameStarted] = useState(false); // ¿Ya se le dio a Play una vez?
  // isPaused ahora viene de props
  const [cardsLeft, setCardsLeft] = useState(54);
  const [localCurrentCard, setLocalCurrentCard] = useState<number | null>(null); // Estado local prioritario para Host
  
  // Refs para lógica imperativa (Timer y Mazo)
  const deckRef = useRef<number[]>([]);
  const drawnHistoryRef = useRef<number[]>([]); // Historial local del host
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sincronizar historial cuando se resetea desde fuera
  useEffect(() => {
    if (!gameStarted && drawnCards.length === 0) {
      drawnHistoryRef.current = [];
      if (!isHost) setLocalCurrentCard(null); // Limpiar local si no es host (aunque no se usa)
    }
  }, [drawnCards, gameStarted, isHost]);

  // Actualizar timer si cambia la velocidad o el estado de pausa
  useEffect(() => {
    if (gameStarted) {
      if (isPaused) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // Si NO está pausado y no hay timer corriendo, iniciarlo (siempre que no estemos en estado inicial)
        if (!timerRef.current) {
           timerRef.current = setInterval(tick, gameSpeed);
        } else {
           // Si ya existe, reiniciar con nueva velocidad
           clearInterval(timerRef.current);
           timerRef.current = setInterval(tick, gameSpeed);
        }
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [gameSpeed, isPaused, gameStarted]);

  // Decidir qué carta mostrar: Host ve la suya (inmediata), Jugadores ven la de la BD (Realtime)
  const displayCardId = isHost ? localCurrentCard : currentCardId;

  // --- LÓGICA DEL JUEGO (TIMER) ---
  
  const tick = () => {
    // 1. Verificar fin del mazo
    if (deckRef.current.length === 0) {
      stopTimer();
      return;
    }

    // 2. Sacar carta
    const nextCard = deckRef.current[0];
    deckRef.current = deckRef.current.slice(1);
    setCardsLeft(deckRef.current.length);

    // 3. Actualizar UI Local INMEDIATAMENTE
    setLocalCurrentCard(nextCard);
    
    // 4. Actualizar historial local
    drawnHistoryRef.current = [...drawnHistoryRef.current, nextCard];

    // 5. ENVIAR A BD (Esto hace que los demas la vean)
    onUpdateCard(nextCard, drawnHistoryRef.current);
  };

  const startTimer = () => {
    stopTimer(); // Limpieza preventiva
    tick(); // Primera carta inmediata
    // El useEffect se encargará de configurar el intervalo basado en isPaused=false
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // --- UNDO HANDLER ---
  const handleUndo = () => {
    if (!isPaused || drawnHistoryRef.current.length === 0) return;

    // 1. Recuperar la última carta sacada
    const lastCard = drawnHistoryRef.current[drawnHistoryRef.current.length - 1];

    // 2. Devolverla al PRINCIPIO del mazo (será la siguiente en salir)
    deckRef.current = [lastCard, ...deckRef.current];
    setCardsLeft(deckRef.current.length);

    // 3. Eliminarla del historial
    drawnHistoryRef.current.pop();

    // 4. Determinar cuál es la carta actual ahora (la anterior a la que borramos)
    const newCurrent = drawnHistoryRef.current.length > 0 
      ? drawnHistoryRef.current[drawnHistoryRef.current.length - 1] 
      : null;

    // 5. Actualizar estado local y DB
    setLocalCurrentCard(newCurrent);
    onUpdateCard(newCurrent, drawnHistoryRef.current);
  };

  // --- BOTONES HANDLERS ---

  const handleInitialPlay = async () => {
    // 1. Generar mazo nuevo
    const newDeck = Array.from({ length: 54 }, (_, i) => i + 1)
      .sort(() => Math.random() - 0.5);
    deckRef.current = newDeck;
    drawnHistoryRef.current = []; // Limpiar historial local
    setLocalCurrentCard(null); // Reset visual
    setCardsLeft(54);

    // 2. Cambiar estado UI
    setGameStarted(true);
    onTogglePause(false); // Asegurar que no esté pausado

    // 3. Arrancar (Esperar a que la BD se limpie primero)
    await onReset(); 
    startTimer();
  };

  const handlePause = () => {
    onTogglePause(true);
  };

  const handleResume = () => {
    onTogglePause(false);
    // IMPORTANTE: Al reanudar manual, queremos tick inmediato.
    // El useEffect manejará el intervalo, pero queremos feedback instantáneo.
    tick(); 
  };

  const handleFullReset = async () => {
    if (!window.confirm("¿Estás seguro de reiniciar toda la partida? Se borrarán los puntos y marcas de todos.")) return;

    stopTimer();
    setGameStarted(false); // Regresa al botón Play
    onTogglePause(false);
    setCardsLeft(54);
    deckRef.current = [];
    drawnHistoryRef.current = []; // Limpiar historial local
    setLocalCurrentCard(null); // Reset visual
    
    // Limpiar BD y Audio
    await onReset(); 
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => stopTimer();
  }, []);

  // --- REPRODUCTOR (Reactivo a la BD o Local para Host) ---
  // Se dispara cuando displayCardId cambia
  useEffect(() => {
    if (!displayCardId) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(`/assets/loteria/sounds/${displayCardId}.m4a`);
    audioRef.current = audio;
    audio.play().catch(() => console.log("Audio pendiente de interacción"));

  }, [displayCardId]);

  return (
    <div className="bg-[#5c3a21] p-2 sm:p-3 rounded-lg border-4 border-[#3e2716] shadow-2xl flex flex-col items-center w-full max-w-[260px] mx-auto h-fit transition-all duration-300 relative">
      <h2 className="text-[#f4e4bc] font-serif text-lg sm:text-xl mb-2 tracking-widest border-b-2 border-[#8b5a2b] w-full text-center bg-[#5c3a21] z-10 py-1">
        BARAJA
      </h2>

      {/* VISUALIZADOR */}
      <div className="relative bg-[#2a1810] p-1.5 rounded shadow-inner w-full aspect-[3/5] flex items-center justify-center border-2 border-[#8b5a2b]">
        {displayCardId ? (
          <img 
            key={displayCardId}
            src={`/assets/loteria/img/${displayCardId}.jpg`} 
            alt="Carta"
            className="w-full h-full object-fill rounded animate-fadeIn"
          />
        ) : (
          <div className="text-[#8b5a2b] text-center opacity-50">
            <span className="text-4xl">🃏</span>
            <p>Esperando...</p>
          </div>
        )}
      </div>

      {/* CONTROLES (SOLO HOST) - Pegados a la carta */}
      {isHost && (
        <div className="flex flex-col gap-1.5 w-full mt-2">
          
          {/* ESTADO 1: NO INICIADO -> Solo botón PLAY */}
          {!gameStarted && (
             <button 
               onClick={handleInitialPlay} 
               className="bg-amber-700 text-white p-2 rounded font-bold shadow hover:bg-amber-600 transition border-2 border-amber-900 text-base w-full flex items-center justify-center gap-2"
             >
               ▶️ INICIAR
             </button>
          )}

          {/* ESTADO 2: JUGANDO -> Botones PAUSA/REANUDAR y REINICIAR */}
          {gameStarted && (
            <>
              {isPaused ? (
                <div className="flex gap-2 w-full">
                  {/* UNDO BUTTON (Solo visible en Pausa) */}
                   <button 
                     onClick={handleUndo} 
                     disabled={drawnHistoryRef.current.length === 0}
                     className="bg-blue-800 text-white p-1.5 rounded font-bold hover:bg-blue-700 border-2 border-blue-950 shadow flex items-center justify-center gap-1 text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                     title="Regresar carta anterior"
                   >
                     ⏪
                   </button>
                   
                   <button onClick={handleResume} className="bg-green-700 text-white p-1.5 rounded font-bold hover:bg-green-600 border-2 border-green-900 shadow flex-[2] flex items-center justify-center gap-2 text-sm sm:text-base">
                     ▶️ REANUDAR
                   </button>
                </div>
              ) : (
                <button onClick={handlePause} className="bg-yellow-700 text-white p-1.5 rounded font-bold hover:bg-yellow-600 border-2 border-yellow-900 shadow w-full flex items-center justify-center gap-2 text-sm sm:text-base">
                  ⏸️ PAUSAR
                </button>
              )}
              
              <button onClick={handleFullReset} className="bg-red-800 text-white p-1.5 rounded font-bold hover:bg-red-700 border-2 border-red-950 shadow w-full flex items-center justify-center gap-2 text-sm sm:text-base">
                🔄 REINICIAR
              </button>
              
              <div className="text-[#f4e4bc] text-center font-mono text-xs opacity-80 mt-0.5">
                Cartas: {cardsLeft}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
