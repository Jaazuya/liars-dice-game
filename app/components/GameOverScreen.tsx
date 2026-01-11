'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation'; // 🔥 Usamos el router de Next.js

interface GameOverData {
  winnerName: string;
  winnerId: string;
  pot: number;
  message: string;
}

interface GameOverScreenProps {
  gameOverData: GameOverData | any;
  currentUserId: string | null;
  isHost: boolean;              // 🔥 Nueva prop para saber si es el Jefe
  onPlayAgain: () => void;      // 🔥 Acción para reiniciar
}

export default function GameOverScreen({ 
  gameOverData, 
  currentUserId, 
  isHost, 
  onPlayAgain 
}: GameOverScreenProps) {
  
  const router = useRouter(); // Hook de navegación
  const [showCoins, setShowCoins] = useState(false);

  if (!gameOverData || typeof gameOverData !== 'object') {
    return null;
  }

  const { winnerName, winnerId, pot, message } = gameOverData;
  const isWinner = currentUserId === winnerId;

  useEffect(() => {
    if (isWinner) {
      setTimeout(() => setShowCoins(true), 500);
    }
  }, [isWinner]);

  // Función segura para volver al inicio
  const handleExit = () => {
    router.push('/'); 
  };

  return (
    // Z-INDEX SUPREMO (z-[10000]) para que nada lo tape
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-[#2A1A10] border-4 border-[#D4AF37] rounded-xl p-8 text-center shadow-[0_0_50px_rgba(212,175,55,0.3)] relative overflow-hidden flex flex-col gap-6"
      >
        {/* Efecto Ganador */}
        {isWinner && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.2)_0%,transparent_70%)] animate-pulse pointer-events-none" />
        )}

        {/* Títulos */}
        <div>
            <h1 className={`text-5xl font-rye mb-2 ${isWinner ? 'text-[#FFD700]' : 'text-gray-300'}`}>
            {isWinner ? '¡VICTORIA!' : 'FIN DEL JUEGO'}
            </h1>
            <p className="text-white/60 italic text-sm">"{message}"</p>
        </div>

        {/* Ganador */}
        <div className="bg-black/30 p-4 rounded-lg border border-[#D4AF37]/30">
            <p className="text-[#8B7355] text-xs font-bold uppercase tracking-widest mb-1">Ganador</p>
            <p className="text-3xl text-white font-serif font-bold">{winnerName}</p>
            <div className="text-[#50C878] font-bold text-2xl mt-2 flex items-center justify-center gap-1">
                <span>+${pot}</span>
            </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex flex-col gap-3 mt-2">
            
            {/* 🤠 BOTÓN SOLO PARA HOST: Jugar Otra Vez */}
            {isHost && (
                <button
                onClick={onPlayAgain}
                className="w-full bg-[#D4AF37] hover:bg-[#F4C430] text-[#2A1A10] font-rye text-2xl px-6 py-3 rounded shadow-lg transform hover:scale-105 transition-all flex items-center justify-center gap-2"
                >
                <span>🔄</span> JUGAR OTRA VEZ
                </button>
            )}

            {/* 🚪 BOTÓN PARA TODOS: Volver al Saloon */}
            <button
                onClick={handleExit}
                className="w-full bg-[#8B0000] hover:bg-[#A52A2A] text-white font-rye text-xl px-6 py-3 rounded border-2 border-[#D4AF37]/50 shadow-lg active:scale-95 transition-all"
            >
                VOLVER AL SALOON
            </button>
        </div>

      </motion.div>
    </div>
  );
}
