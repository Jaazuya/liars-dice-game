import { motion, AnimatePresence } from 'framer-motion';
import { LoteriaLeaderboardEntry } from '@/app/hooks/useLoteriaGame2';

interface PlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboard: LoteriaLeaderboardEntry[];
}

export const PlayersModal = ({ isOpen, onClose, leaderboard }: PlayersModalProps) => {
    const sortedPlayers = [...leaderboard].sort((a, b) => b.score - a.score);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
                    onClick={onClose}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#3e2716] border-[4px] border-[#5d4037] rounded-lg shadow-2xl z-50 overflow-hidden"
                  >
                     <div className="bg-[#4e342e] p-4 border-b-2 border-[#5d4037] flex justify-between items-center">
                        <h2 className="font-rye text-[#ffb300] text-xl">POSICIONES</h2>
                        <button onClick={onClose} className="text-[#d7ccc8] text-xl hover:text-white">✕</button>
                     </div>
                     
                     <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
                        {sortedPlayers.length === 0 ? (
                           <div className="text-center text-[#a1887f] italic py-4">Esperando jugadores...</div>
                        ) : (
                           sortedPlayers.map((p, index) => {
                               const score = p.score || 0;
                               return (
                                   <div key={p.user_id} className="flex items-center justify-between bg-[#2a1810] p-3 rounded border border-[#5d4037]">
                                       <div className="flex items-center gap-3">
                                           <span className={`
                                               w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                                               ${index === 0 ? 'bg-[#ffb300] text-black shadow-[0_0_10px_#ffb300]' : 
                                                 index === 1 ? 'bg-[#cfd8dc] text-black' : 
                                                 index === 2 ? 'bg-[#a1887f] text-black' : 'bg-[#1a100e] text-[#a1887f]'}
                                           `}>
                                               {index + 1}
                                           </span>
                                           <span className="text-[#d7ccc8] font-rye truncate max-w-[150px]">{p.name || 'Jugador'}</span>
                                       </div>
                                       <span className={`font-bold text-lg ${score >= 0 ? 'text-[#81c784]' : 'text-[#e57373]'}`}>
                                           {score > 0 ? '+' : ''}{score} pts
                                       </span>
                                   </div>
                               );
                           })
                        )}
                     </div>
                  </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

