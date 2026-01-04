import { useState, useEffect, useRef } from 'react';

interface TheDeckProps {
  isHost: boolean;
  isPlaying: boolean;
  currentCardId: number | null;
  drawnCards: number[];
  onUpdateCard: (cardId: number, drawnCards: number[]) => Promise<void>;
  onReset: () => Promise<void>;
}

export default function TheDeck({ isHost, currentCardId, drawnCards, onUpdateCard, onReset }: TheDeckProps) {
  // Estado local de la UI
  const [gameStarted, setGameStarted] = useState(false); // ¿Ya se le dio a Play una vez?
  const [isPaused, setIsPaused] = useState(false);
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
    timerRef.current = setInterval(tick, 3000); // Siguientes cada 3s
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // --- BOTONES HANDLERS ---

  const handleInitialPlay = () => {
    // 1. Generar mazo nuevo
    const newDeck = Array.from({ length: 54 }, (_, i) => i + 1)
      .sort(() => Math.random() - 0.5);
    deckRef.current = newDeck;
    drawnHistoryRef.current = []; // Limpiar historial local
    setLocalCurrentCard(null); // Reset visual
    setCardsLeft(54);

    // 2. Cambiar estado UI
    setGameStarted(true);
    setIsPaused(false);

    // 3. Arrancar
    onReset(); // Limpia BD
    startTimer();
  };

  const handlePause = () => {
    stopTimer();
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    // IMPORTANTE: Al reanudar, sacamos carta inmediata y reiniciamos timer
    tick(); 
    timerRef.current = setInterval(tick, 3000);
  };

  const handleFullReset = () => {
    stopTimer();
    setGameStarted(false); // Regresa al botón Play
    setIsPaused(false);
    setCardsLeft(54);
    deckRef.current = [];
    drawnHistoryRef.current = []; // Limpiar historial local
    setLocalCurrentCard(null); // Reset visual
    
    // Limpiar BD y Audio
    onReset(); 
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
    <div className="bg-[#5c3a21] p-4 rounded-lg border-4 border-[#3e2716] shadow-2xl flex flex-col items-center h-full">
      <h2 className="text-[#f4e4bc] font-serif text-2xl mb-4 tracking-widest border-b-2 border-[#8b5a2b] w-full text-center sticky top-0 bg-[#5c3a21] z-10">
        BARAJA
      </h2>

      {/* VISUALIZADOR */}
      <div className="relative bg-[#2a1810] p-2 rounded-lg shadow-inner mb-6 w-full max-w-[240px] aspect-[3/5] flex items-center justify-center border-2 border-[#8b5a2b]">
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

      {/* CONTROLES (SOLO HOST) */}
      {isHost && (
        <div className="flex flex-col gap-3 w-full max-w-[200px] mt-auto">
          
          {/* ESTADO 1: NO INICIADO -> Solo botón PLAY */}
          {!gameStarted && (
             <button 
               onClick={handleInitialPlay} 
               className="bg-amber-700 text-white p-3 rounded font-bold shadow hover:bg-amber-600 transition border-2 border-amber-900 text-lg"
             >
               ▶️ INICIAR JUEGO
             </button>
          )}

          {/* ESTADO 2: JUGANDO -> Botones PAUSA/REANUDAR y REINICIAR */}
          {gameStarted && (
            <>
              {isPaused ? (
                <button onClick={handleResume} className="bg-green-700 text-white p-2 rounded font-bold hover:bg-green-600 border-2 border-green-900 shadow">
                  ▶️ REANUDAR
                </button>
              ) : (
                <button onClick={handlePause} className="bg-yellow-700 text-white p-2 rounded font-bold hover:bg-yellow-600 border-2 border-yellow-900 shadow">
                  ⏸️ PAUSAR
                </button>
              )}
              
              <button onClick={handleFullReset} className="bg-red-800 text-white p-2 rounded font-bold hover:bg-red-700 mt-2 border-2 border-red-950 shadow">
                🔄 REINICIAR TODO
              </button>
              
              <div className="text-[#f4e4bc] text-center mt-2 font-mono text-sm opacity-80">
                Cartas restantes: {cardsLeft}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
