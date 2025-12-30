'use client';
import { Player } from "@/app/types/game";
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. BARRA SUPERIOR ---
export const TopBar = ({ me, pot, myTurn, turnName }: { me?: Player, pot: number, myTurn?: boolean, turnName?: string }) => (
    <div className="w-full bg-[#3e2723] border-b-[4px] sm:border-b-[6px] border-[#251614] shadow-2xl z-20 shrink-0 relative flex flex-col items-center pt-2 pb-2 sm:pb-4">
        <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_12px)] pointer-events-none"></div>
        <div className="w-full max-w-lg flex justify-between items-end px-2 sm:px-4 relative z-10">
            {/* Pozo en el centro */}
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 top-0.5 sm:top-1">
                <div className="bg-black/60 px-3 sm:px-4 md:px-6 pt-1 pb-1 sm:pb-2 rounded-b-xl border-x-2 border-b-2 border-[#ffb300] shadow-[0_0_20px_rgba(255,179,0,0.2)]">
                    <span className="block text-center text-[#ffb300] text-[8px] sm:text-[10px] uppercase tracking-widest font-sans">Pozo</span>
                    <span className="font-rye text-3xl sm:text-4xl md:text-5xl text-[#ffca28] drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)]">${pot}</span>
                </div>
                {/* Indicador de Turno debajo del Pozo */}
                {turnName !== undefined && (
                    <motion.div 
                        animate={myTurn ? { 
                            scale: [1, 1.05, 1],
                        } : {}}
                        transition={{ 
                            duration: 2, 
                            repeat: myTurn ? Infinity : 0,
                            ease: "easeInOut"
                        }}
                        className={`mt-2 px-3 sm:px-4 py-1 sm:py-1.5 border-2 shadow-lg rounded-lg ${myTurn ? 'bg-[#ffb300] border-[#ff6f00]' : 'bg-[#3e2723] border-[#5d4037]'}`}
                    >
                        <motion.span 
                            animate={myTurn ? { 
                                x: [0, 3, -3, 0]
                            } : {}}
                            transition={{ 
                                duration: 1.5, 
                                repeat: myTurn ? Infinity : 0,
                                ease: "easeInOut"
                            }}
                            className={`font-rye text-xs sm:text-sm md:text-base uppercase tracking-wider ${myTurn ? 'text-[#3e2723]' : 'text-[#d7ccc8]'}`}
                        >
                            {myTurn ? '👉 ¡Tu Turno! 👈' : `Turno de ${turnName || '...'}`}
                        </motion.span>
                    </motion.div>
                )}
            </div>
            {/* Dinero y Apuesta a la derecha */}
            <div className="flex flex-col items-end transform rotate-1 ml-auto">
                <div className="flex flex-col items-end mb-2">
                    <span className="text-[#d7ccc8] text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-sans mb-0.5 sm:mb-1 bg-black/40 px-1.5 sm:px-2 rounded">Dinero</span>
                    <span className="font-rye text-2xl sm:text-3xl md:text-4xl text-[#4caf50] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">${me?.money || 0}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[#d7ccc8] text-[8px] sm:text-[10px] uppercase tracking-[0.2em] font-sans mb-0.5 sm:mb-1 bg-black/40 px-1.5 sm:px-2 rounded">Apuesta</span>
                    <span className="font-rye text-xl sm:text-2xl md:text-3xl text-[#ffab91] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">${me?.current_contribution || 0}</span>
                </div>
            </div>
        </div>
    </div>
);

// --- 2. TIRA DE RIVALES (CON BOTÓN EXPULSAR) ---
export const RivalsStrip = ({ players, myId, currentTurnId, amIHost, onKick }: { players: Player[], myId: string, currentTurnId: string | null, amIHost: boolean, onKick: (id: string, name: string) => void }) => (
    <div className="w-full overflow-x-auto flex gap-3 p-4 no-scrollbar shrink-0 h-auto items-start bg-[#1a0f0d] border-b border-[#5d4037]">
        {players.filter(p => p.id !== myId).map(rival => (
            <motion.div 
                key={rival.id} 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                    opacity: currentTurnId === rival.id ? 1 : 0.8,
                    scale: currentTurnId === rival.id ? 1.1 : 0.95
                }}
                transition={{ duration: 0.3 }}
                className="shrink-0 relative flex flex-col items-center min-w-[90px] z-10"
            >
                
                {/* BOTÓN EXPULSAR (Solo lo ve el Host) */}
                {amIHost && (
                    <motion.button 
                        onClick={() => onKick(rival.id, rival.name)}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-red-900 text-white rounded-full flex items-center justify-center text-[10px] border border-red-500 shadow hover:bg-red-700 transition-colors"
                        title="Expulsar jugador"
                    >
                        💀
                    </motion.button>
                )}

                {/* Indicador de Turno */}
                <AnimatePresence>
                    {currentTurnId === rival.id && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ 
                                y: { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
                            }}
                            className="absolute -top-3 text-2xl"
                        >
                            👇
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tarjeta Jugador */}
                <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className={`bg-[#d7ccc8] p-2 rounded-sm shadow-md border-2 w-full flex flex-col items-center ${currentTurnId === rival.id ? 'border-[#ffb300] bg-[#efebe9]' : 'border-[#5d4037]'}`}
                >
                    <motion.div 
                        animate={currentTurnId === rival.id ? { rotate: [0, 10, -10, 0] } : {}}
                        transition={{ duration: 2, repeat: currentTurnId === rival.id ? Infinity : 0, repeatDelay: 1 }}
                        className="w-10 h-10 rounded-full bg-[#3e2723] flex items-center justify-center text-xl mb-1 border-2 border-[#5d4037] text-[#d7ccc8]"
                    >
                        🤠
                    </motion.div>
                    <span className="font-rye text-sm text-[#3e2723] truncate w-full text-center">{rival.name}</span>
                    <div className="w-full h-[1px] bg-[#5d4037]/50 my-1"></div>
                    <div className="flex gap-1 items-center justify-center">
                        <span className="text-sm">🎲</span>
                        <span className="font-rye text-lg text-black">{(rival.dice_values?.length || 0)}</span>
                    </div>
                </motion.div>
            </motion.div>
        ))}
    </div>
);

// --- 3. MESA CENTRAL ---
export const GameTable = ({ bet, getEmoji }: { bet: { quantity: number, face: number }, getEmoji: (n: number) => string }) => (
    <div className="flex-1 flex items-center justify-center relative p-1.5 sm:p-2 md:p-4 w-full min-h-[120px] sm:min-h-[150px] md:min-h-[180px]">
        <div className="bg-[#1b5e20] border-[6px] sm:border-[8px] md:border-[10px] lg:border-[12px] border-[#3e2723] rounded-[20px] sm:rounded-[30px] md:rounded-[40px] w-full max-w-sm sm:max-w-md md:max-w-lg aspect-[2/1] sm:aspect-[2.5/1] md:aspect-[3/1] flex items-center justify-center shadow-[inset_0_0_60px_rgba(0,0,0,0.6)] relative overflow-hidden ring-2 sm:ring-4 ring-black/40">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>
            <div className="text-center relative z-10 transform transition-all duration-500">
                <AnimatePresence mode="wait">
                    {bet.quantity > 0 ? (
                        <motion.div
                            key="bet"
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: -20 }}
                            transition={{ duration: 0.4, type: "spring" }}
                            className="flex flex-col items-center"
                        >
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-[#a5d6a7] text-xs uppercase mb-2 tracking-[0.3em] font-sans font-bold"
                            >
                                La Apuesta es
                            </motion.p>
                            <div className="flex items-center gap-4">
                                <motion.span 
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                                    className="font-rye text-5xl sm:text-6xl md:text-[7rem] leading-none text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,0.5)]"
                                >
                                    {bet.quantity}
                                </motion.span>
                                <motion.span 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="font-rye text-2xl sm:text-3xl md:text-4xl text-[#ffb300] mt-2 sm:mt-4"
                                >
                                    X
                                </motion.span>
                                <motion.span 
                                    initial={{ scale: 0, rotate: 180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                                    className="text-4xl sm:text-5xl md:text-[6rem] leading-none text-[#fff8e1] drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
                                >
                                    {getEmoji(bet.face)}
                                </motion.span>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center"
                        >
                            <motion.span 
                                animate={{ rotate: [0, 10, -10, 10, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                                className="text-6xl mb-4"
                            >
                                🔫
                            </motion.span>
                            <div className="font-rye text-2xl text-[#a5d6a7]">Mesa Limpia</div>
                            <div className="font-sans text-sm text-[#a5d6a7]">Esperando al valiente...</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    </div>
);