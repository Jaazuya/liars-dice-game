'use client';
import { Player } from "@/app/types/game";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/app/lib/supabase";

export const WantedIntro = ({ entryFee, players, myId, onPay, onKick, isHost, onAbandon }: { 
    entryFee: number, 
    players: Player[], 
    myId: string, 
    onPay: () => Promise<boolean>,
    onKick?: (id: string) => void,
    isHost?: boolean,
    onAbandon?: () => void
}) => {
    const [isPaying, setIsPaying] = useState(false);
    const [bank, setBank] = useState<number | null>(null);
    const [bankLoading, setBankLoading] = useState(true);
    const me = players.find(p => p.id === myId);
    const imReady = me?.is_ready;

    useEffect(() => {
        let mounted = true;
        const fetchBank = async () => {
            setBankLoading(true);
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            if (!uid) { if (mounted) setBankLoading(false); return; }

            const { data: profileData } = await supabase
                .from('profiles')
                .select('global_balance')
                .eq('id', uid)
                .single() as any;

            if (mounted) {
                setBank(profileData?.global_balance ?? null);
                setBankLoading(false);
            }
        };
        fetchBank();
        return () => { mounted = false; };
    }, []);

    const handlePay = async () => {
        setIsPaying(true);
        await onPay();
        // Refrescar banco (la RPC ya hizo el cobro)
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (uid) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('global_balance')
                .eq('id', uid)
                .single() as any;
            setBank(profileData?.global_balance ?? bank);
        }
        setIsPaying(false);
    };

    // ¿Quiénes faltan?
    const pendingCount = players.filter(p => !p.is_ready).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-500">
            {/* Botón Abandonar (Esquina superior izquierda) */}
            {onAbandon && (
                <button
                    onClick={onAbandon}
                    className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
                >
                    🚪 Abandonar
                </button>
            )}
            
            <div className="relative bg-[#eecfa1] w-full max-w-md p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center rotate-1">
                
                {/* Textura Papel */}
                <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none"></div>
                <div className="w-4 h-4 bg-[#3e2723] rounded-full mx-auto mb-4 shadow-xl border border-black/50 relative z-10"></div>

                <h1 className="font-rye text-6xl text-[#3e2723] mb-1 tracking-widest drop-shadow-sm">WANTED</h1>
                <p className="font-sans font-bold text-[#b71c1c] uppercase tracking-[0.2em] text-sm mb-6 border-b-2 border-[#3e2723] pb-2">Entry Fee Required</p>

                <div className="font-rye text-7xl text-[#b71c1c] mb-8 drop-shadow-md decoration-4 underline decoration-[#3e2723]">
                    ${entryFee}
                </div>

                <div className="w-full mb-4 bg-[#3e2723]/10 border border-[#3e2723]/40 rounded p-2 text-[#3e2723]">
                    <div className="text-[10px] uppercase tracking-widest font-bold">Banco</div>
                    <div className="font-rye text-2xl">
                        {bankLoading ? '...' : `$${(bank ?? 0).toLocaleString()}`}
                    </div>
                </div>

                {/* LISTA DE ESTADO DE PAGO */}
                <div className="w-full bg-[#d7ccc8]/40 p-4 rounded border border-[#8d6e63] mb-6 max-h-48 overflow-y-auto custom-scrollbar">
                    <p className="text-[#3e2723] text-[10px] uppercase tracking-widest mb-2 font-bold text-left">Estado de la Banda:</p>
                    {players.map(p => (
                        <div key={p.id} className="flex justify-between items-center border-b border-[#8d6e63]/30 py-2 last:border-0 text-sm group">
                            <span className="font-rye text-[#3e2723]">{p.name}</span>
                            <div className="flex items-center gap-2">
                                {p.is_ready ? (
                                    <span className="text-[#2e7d32] font-bold text-[10px] bg-[#a5d6a7] px-2 py-0.5 rounded border border-[#2e7d32]">PAGADO</span>
                                ) : (
                                    <span className="text-[#b71c1c] font-bold text-[10px] animate-pulse">PENDIENTE...</span>
                                )}
                                {/* Botón Kick (Solo Host, no puede expulsarse a sí mismo) */}
                                {isHost && onKick && !p.is_host && (
                                    <button
                                        onClick={() => onKick(p.id)}
                                        className="opacity-0 group-hover:opacity-100 bg-red-900/80 hover:bg-red-600 text-white w-6 h-6 rounded flex items-center justify-center transition-all border border-red-800 text-xs"
                                        title="Expulsar jugador (acción inmediata)"
                                    >
                                        💀
                                    </button>
                                )}
                            </div>
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
                            disabled={isPaying || (bank !== null && bank < entryFee)}
                            whileHover={{ scale: (bank !== null && bank >= entryFee) ? 1.05 : 1 }}
                            whileTap={{ scale: (bank !== null && bank >= entryFee) ? 0.95 : 1 }}
                            className="w-full bg-[#3e2723] text-[#eecfa1] font-rye text-2xl py-4 border-4 border-double border-[#eecfa1] shadow-xl hover:bg-black transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                        >
                            {(bank !== null && bank < entryFee) ? "SIN FONDOS" : (isPaying ? "PAGANDO..." : "PAGAR Y ENTRAR")}
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