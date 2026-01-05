import { motion } from 'framer-motion';
import { LoteriaLeaderboardEntry } from '@/app/hooks/useLoteriaGame';

interface GameOverScreenProps {
  leaderboard: LoteriaLeaderboardEntry[];
  onRestart?: () => void;
  onReturnToLobby?: () => void;
  isHost: boolean;
}

export const GameOverScreen = ({ leaderboard, onRestart, onReturnToLobby, isHost }: GameOverScreenProps) => {
  const sortedPlayers = [...leaderboard].sort((a, b) => b.score - a.score);

  const winner = sortedPlayers[0];
  const winnerScore = winner ? (winner.score || 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#3e2716] border-[6px] border-[#ffb300] rounded-xl p-6 sm:p-10 max-w-lg w-full shadow-[0_0_50px_rgba(255,179,0,0.5)] text-center relative overflow-hidden"
      >
        {/* Decoracion */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />

        <h1 className="text-4xl sm:text-5xl font-rye text-[#ffb300] mb-2 drop-shadow-lg">
          ¡FIN DEL JUEGO!
        </h1>
        
        <div className="my-6">
            <p className="text-[#d7ccc8] font-rye text-lg">GANADOR</p>
            <div className="text-3xl sm:text-4xl font-bold text-white mt-2 animate-bounce">
                {winner ? (winner.name || 'Jugador') : 'Nadie'}
            </div>
            <div className="text-[#ffca28] font-mono text-xl mt-1">
                {winnerScore} Pts
            </div>
        </div>

        <div className="bg-[#2a1810] rounded-lg p-4 mb-6 max-h-40 overflow-y-auto border border-[#5d4037] custom-scrollbar">
            {sortedPlayers.slice(1).map((p, i) => (
                <div key={p.user_id} className="flex justify-between text-[#a1887f] text-sm py-1 border-b border-[#3e2716] last:border-0">
                    <span>{i + 2}. {p.name || 'Jugador'}</span>
                    <span>{p.score || 0} pts</span>
                </div>
            ))}
        </div>

        {isHost ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                    onClick={onRestart}
                    className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white font-rye px-6 py-3 rounded text-lg border-2 border-[#4caf50] shadow-lg transition-transform hover:scale-105"
                >
                    JUGAR DE NUEVO
                </button>
                <button 
                    onClick={onReturnToLobby}
                    className="bg-[#d84315] hover:bg-[#bf360c] text-white font-rye px-6 py-3 rounded text-lg border-2 border-[#ff5722] shadow-lg transition-transform hover:scale-105"
                >
                    SALIR AL LOBBY
                </button>
            </div>
        ) : (
            <p className="text-[#a1887f] italic text-sm">Esperando al host...</p>
        )}
      </motion.div>
    </div>
  );
};
