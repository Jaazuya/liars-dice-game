'use client';
import { Player } from "@/app/types/game";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const WantedIntro = ({ entryFee, players, myId, onPay }: { entryFee: number, players: Player[], myId: string, onPay: () => Promise<boolean> }) => {
    const [isPaying, setIsPaying] = useState(false);
    const me = players.find(p => p.id === myId);
    const imReady = me?.is_ready;

    const handlePay = async () => {
        setIsPaying(true);
        await onPay();
    };

    // ¿Quiénes faltan?
    const pendingCount = players.filter(p => !p.is_ready).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-500">
            <div className="relative bg-[#eecfa1] w-full max-w-md p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center rotate-1">
                
                {/* Textura Papel */}
                <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none"></div>
                <div className="w-4 h-4 bg-[#3e2723] rounded-full mx-auto mb-4 shadow-xl border border-black/50 relative z-10"></div>

                <h1 className="font-rye text-6xl text-[#3e2723] mb-1 tracking-widest drop-shadow-sm">WANTED</h1>
                <p className="font-sans font-bold text-[#b71c1c] uppercase tracking-[0.2em] text-sm mb-6 border-b-2 border-[#3e2723] pb-2">Entry Fee Required</p>

                <div className="font-rye text-7xl text-[#b71c1c] mb-8 drop-shadow-md decoration-4 underline decoration-[#3e2723]">
                    ${entryFee}
                </div>

                {/* LISTA DE ESTADO DE PAGO */}
                <div className="w-full bg-[#d7ccc8]/40 p-4 rounded border border-[#8d6e63] mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                    <p className="text-[#3e2723] text-[10px] uppercase tracking-widest mb-2 font-bold text-left">Estado de la Banda:</p>
                    {players.map(p => (
                        <div key={p.id} className="flex justify-between items-center border-b border-[#8d6e63]/30 py-2 last:border-0 text-sm">
                            <span className="font-rye text-[#3e2723]">{p.name}</span>
                            {p.is_ready ? (
                                <span className="text-[#2e7d32] font-bold text-[10px] bg-[#a5d6a7] px-2 py-0.5 rounded border border-[#2e7d32]">PAGADO</span>
                            ) : (
                                <span className="text-[#b71c1c] font-bold text-[10px] animate-pulse">PENDIENTE...</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* BOTÓN PAGAR (O MENSAJE DE ESPERA) */}
                <AnimatePresence mode="wait">
                    {!imReady ? (
                        <motion.button 
                            key="pay-button"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            onClick={handlePay}
                            disabled={isPaying || me!.money < entryFee}
                            whileHover={{ scale: me!.money >= entryFee ? 1.05 : 1 }}
                            whileTap={{ scale: me!.money >= entryFee ? 0.95 : 1 }}
                            className="w-full bg-[#3e2723] text-[#eecfa1] font-rye text-2xl py-4 border-4 border-double border-[#eecfa1] shadow-xl hover:bg-black transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                        >
                            {me!.money < entryFee ? "SIN FONDOS" : (isPaying ? "PAGANDO..." : "PAGAR Y ENTRAR")}
                        </motion.button>
                    ) : (
                        <motion.div 
                            key="accepted"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="w-full bg-[#3e2723]/10 border-2 border-[#3e2723] p-4 text-[#3e2723] font-rye text-lg flex flex-col items-center"
                        >
                            <motion.span
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                💰 PAGO ACEPTADO
                            </motion.span>
                            <span className="text-xs font-sans mt-1 opacity-70">
                                {pendingCount === 0 ? "¡EMPEZANDO PARTIDA!" : `ESPERANDO A ${pendingCount} JUGADOR(ES)...`}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};