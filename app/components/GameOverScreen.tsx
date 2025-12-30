'use client';
import { GameOverData, Player } from '@/app/types/game';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface GameOverScreenProps {
    gameOverData: GameOverData;
    players: Player[];
    myId: string;
    isHost: boolean;
    onReset: () => void;
}

export const GameOverScreen = ({ gameOverData, players, myId, isHost, onReset }: GameOverScreenProps) => {
    const [showCoins, setShowCoins] = useState(false);
    const myPlayer = players.find(p => p.id === myId);
    const winner = players.find(p => p.id === gameOverData.winner);
    const runnerUp = gameOverData.runnerUp ? players.find(p => p.id === gameOverData.runnerUp) : null;
    const losers = players.filter(p => gameOverData.losers.includes(p.id));
    const amIWinner = myId === gameOverData.winner;
    const amIRunnerUp = myId === gameOverData.runnerUp;
    const amILoser = gameOverData.losers.includes(myId);

    useEffect(() => {
        // Animación de monedas después de un breve delay
        const timer = setTimeout(() => setShowCoins(true), 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            {/* Fondo según resultado */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`absolute inset-0 ${
                    amIWinner 
                        ? 'bg-gradient-to-br from-[#ffd700] via-[#ffed4e] to-[#ffb300]' 
                        : amILoser 
                        ? 'bg-gradient-to-br from-[#8b0000] via-[#a00000] to-[#6b0000]'
                        : 'bg-gradient-to-br from-[#4a5568] via-[#2d3748] to-[#1a202c]'
                }`}
            />
            
            {/* Efecto de monedas para ganador */}
            <AnimatePresence>
                {showCoins && amIWinner && (
                    <>
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ 
                                    x: '50%', 
                                    y: '50%', 
                                    opacity: 1,
                                    scale: 1,
                                    rotate: 0
                                }}
                                animate={{ 
                                    x: `${50 + (Math.random() - 0.5) * 100}%`,
                                    y: `${50 + (Math.random() - 0.5) * 100}%`,
                                    opacity: 0,
                                    scale: 0.3,
                                    rotate: 360
                                }}
                                transition={{ 
                                    duration: 2 + Math.random(),
                                    delay: Math.random() * 0.5
                                }}
                                className="absolute text-4xl pointer-events-none"
                            >
                                💰
                            </motion.div>
                        ))}
                    </>
                )}
            </AnimatePresence>

            {/* Contenido Principal */}
            <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={`relative w-full max-w-4xl bg-[#1a0f0d] border-8 ${
                    amIWinner 
                        ? 'border-[#ffd700] shadow-[0_0_50px_rgba(255,215,0,0.8)]' 
                        : amILoser 
                        ? 'border-[#8b0000] shadow-[0_0_50px_rgba(139,0,0,0.8)]'
                        : 'border-[#5d4037] shadow-[0_0_50px_rgba(0,0,0,0.8)]'
                } rounded-lg p-8 md:p-12`}
            >
                {/* Textura de papel */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none rounded-lg"></div>

                {/* Título Principal */}
                <div className="text-center mb-8 relative z-10">
                    {amIWinner ? (
                        <motion.h1
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="font-rye text-6xl md:text-8xl text-[#ffd700] drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] mb-4"
                        >
                            ¡RECOMPENSA COBRADA!
                        </motion.h1>
                    ) : amILoser ? (
                        <motion.h1
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="font-rye text-6xl md:text-8xl text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] mb-4"
                        >
                            ELIMINADO
                        </motion.h1>
                    ) : (
                        <motion.h1
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="font-rye text-6xl md:text-8xl text-[#d7ccc8] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] mb-4"
                        >
                            FIN DE PARTIDA
                        </motion.h1>
                    )}
                </div>

                {/* Tabla de Resultados */}
                <div className="bg-[#2d1b15] border-4 border-[#5d4037] rounded-lg p-6 md:p-8 mb-6 relative z-10">
                    <h2 className="font-rye text-3xl md:text-4xl text-[#ffb300] mb-6 text-center border-b-2 border-[#5d4037] pb-3">
                        RESULTADOS
                    </h2>

                    <div className="space-y-4">
                        {/* Ganador */}
                        <motion.div
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="bg-gradient-to-r from-[#ffd700]/20 to-transparent border-l-4 border-[#ffd700] p-4 rounded"
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🏆</span>
                                    <div>
                                        <p className="font-rye text-xl md:text-2xl text-[#ffd700]">
                                            {gameOverData.winnerName}
                                        </p>
                                        <p className="text-xs text-[#d7ccc8]">GANADOR</p>
                                    </div>
                                </div>
                                <p className="font-rye text-2xl md:text-3xl text-[#4caf50]">
                                    +${gameOverData.amounts.winner.toLocaleString()}
                                </p>
                            </div>
                        </motion.div>

                        {/* Segundo Lugar (si aplica) */}
                        {runnerUp && gameOverData.amounts.runnerUp > 0 && (
                            <motion.div
                                initial={{ x: -50, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.7 }}
                                className="bg-gradient-to-r from-[#c0c0c0]/20 to-transparent border-l-4 border-[#c0c0c0] p-4 rounded"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">🥈</span>
                                        <div>
                                            <p className="font-rye text-xl md:text-2xl text-[#c0c0c0]">
                                                {gameOverData.runnerUpName}
                                            </p>
                                            <p className="text-xs text-[#d7ccc8]">SEGUNDO LUGAR</p>
                                        </div>
                                    </div>
                                    <p className="font-rye text-2xl md:text-3xl text-[#81c784]">
                                        +${gameOverData.amounts.runnerUp.toLocaleString()}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Perdedores */}
                        {losers.length > 0 && (
                            <div className="mt-6 pt-4 border-t-2 border-[#5d4037]">
                                <p className="font-rye text-lg text-[#a1887f] mb-3">ELIMINADOS:</p>
                                <div className="space-y-2">
                                    {losers.map((loser, idx) => {
                                        const entryFee = loser.current_contribution || 0;
                                        return (
                                            <motion.div
                                                key={loser.id}
                                                initial={{ x: -50, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.9 + idx * 0.1 }}
                                                className="flex justify-between items-center bg-[#1a0f0d] p-3 rounded border border-[#5d4037]"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">💀</span>
                                                    <p className="font-rye text-lg text-[#d7ccc8]">{loser.name}</p>
                                                </div>
                                                <p className="font-rye text-lg text-red-400">
                                                    -${entryFee.toLocaleString()}
                                                </p>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Botón Reiniciar (Solo Host) */}
                {isHost && (
                    <motion.button
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        onClick={onReset}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye text-2xl md:text-3xl py-4 rounded-lg border-b-[6px] border-[#ff6f00] active:border-b-0 active:translate-y-1 transition-all shadow-xl uppercase tracking-wider relative z-10"
                    >
                        REINICIAR SALA
                    </motion.button>
                )}

                {/* Mensaje para no-host */}
                {!isHost && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.2 }}
                        className="text-center text-[#a1887f] font-rye text-lg relative z-10"
                    >
                        Esperando al Sheriff para reiniciar...
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
};

