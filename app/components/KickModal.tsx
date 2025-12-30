'use client';
import { VoteData } from "@/app/types/game";
import { motion } from 'framer-motion';

export const KickModal = ({ voteData, onVote }: { voteData: VoteData, onVote: (v: boolean) => void }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-[#3e2723] p-8 rounded border-[6px] border-[#5d4037] shadow-2xl max-w-sm w-full text-center relative">
                
                {/* Soga de ahorcado decorativa */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-6xl">🪢</div>

                <h2 className="font-rye text-3xl text-[#ffb300] mb-2 uppercase">Juicio Sumario</h2>
                <p className="text-[#d7ccc8] mb-6 font-sans">
                    Se ha propuesto expulsar a <br/>
                    <span className="font-rye text-2xl text-red-400">{voteData.target_name}</span>
                </p>

                <div className="flex gap-4">
                    <motion.button 
                        onClick={() => onVote(false)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-[#4e342e] hover:bg-[#5d4037] text-[#d7ccc8] font-rye py-3 rounded border-b-4 border-[#3e2723] active:border-b-0"
                    >
                        PERDONAR
                    </motion.button>
                    <motion.button 
                        onClick={() => onVote(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 bg-[#b71c1c] hover:bg-[#c62828] text-white font-rye py-3 rounded border-b-4 border-[#7f0000] active:border-b-0"
                    >
                        EXPULSAR
                    </motion.button>
                </div>
                
                <p className="text-xs text-stone-500 mt-4">Se requiere mayoría de votos.</p>
            </div>
        </div>
    );
};