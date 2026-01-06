'use client';
import { DiceGameOverEntry } from '@/app/types/game';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

interface GameOverScreenProps {
    gameOverData: DiceGameOverEntry[];
    isHost: boolean;
    onReset: () => void;
}

export const GameOverScreen = ({ gameOverData, isHost, onReset }: GameOverScreenProps) => {
    const [showCoins, setShowCoins] = useState(false);
    const [bank, setBank] = useState<number | null>(null);
    const top = [...(gameOverData || [])].sort((a, b) => a.rank - b.rank).slice(0, 3);
    const first = top.find(r => r.rank === 1);
    const second = top.find(r => r.rank === 2);
    const third = top.find(r => r.rank === 3);

    useEffect(() => {
        // Animación de monedas después de un breve delay
        const timer = setTimeout(() => setShowCoins(true), 500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        let mounted = true;
        const fetchBank = async (uid: string) => {
            const { data } = await supabase.auth.getUser();
            const userId = uid || data.user?.id;
            if (!userId) return;
            const { data: profileData } = await supabase
                .from('profiles')
                .select('global_balance')
                .eq('id', userId)
                .single() as any;
            if (mounted) setBank(profileData?.global_balance ?? null);
        };

        const setup = async () => {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            if (!uid) return;

            await fetchBank(uid);

            // Realtime: refrescar banco cuando el backend actualice profiles (premios/redondeo)
            const channel = supabase
                .channel(`profile_balance_${uid}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${uid}`
                }, () => {
                    fetchBank(uid);
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        };

        const cleanupPromise = setup();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            {/* Fondo según resultado */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-[#ffd700] via-[#ffed4e] to-[#ffb300]"
            />
            
            {/* Efecto de monedas para ganador */}
            <AnimatePresence>
                {showCoins && (
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
                className="relative w-full max-w-3xl bg-[#1a0f0d] border-8 border-[#ffd700] shadow-[0_0_50px_rgba(255,215,0,0.8)] rounded-lg p-6 md:p-10"
            >
                {/* Textura de papel */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none rounded-lg"></div>

                {/* Título Principal */}
                <div className="text-center mb-8 relative z-10">
                    <motion.h1
                        initial={{ y: -50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="font-rye text-5xl md:text-7xl text-[#ffd700] drop-shadow-[0_0_20px_rgba(255,215,0,0.8)] mb-2"
                    >
                        RESULTADOS
                    </motion.h1>
                    <div className="text-[#d7ccc8] font-rye text-sm md:text-base">
                        ¡Ganancias enviadas a tu cuenta global! <span className="text-[#ffb300]">(Redondeadas a tu favor)</span>
                    </div>
                    <div className="text-[#a1887f] font-mono text-xs mt-2">
                        Banco: ${bank?.toLocaleString?.() ?? '...'}
                    </div>
                </div>

                {/* Tabla de Resultados */}
                <div className="bg-[#2d1b15] border-4 border-[#5d4037] rounded-lg p-6 md:p-8 mb-6 relative z-10">
                    <div className="space-y-3">
                        {first && (
                            <div className="bg-gradient-to-r from-[#ffd700]/20 to-transparent border-l-4 border-[#ffd700] p-4 rounded flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🥇</span>
                                    <div>
                                        <div className="font-rye text-xl md:text-2xl text-[#ffd700]">{first.username}</div>
                                        <div className="text-xs text-[#d7ccc8]">1er Lugar</div>
                                    </div>
                                </div>
                                <div className="font-rye text-2xl md:text-3xl text-[#4caf50]">+${first.payout.toLocaleString()}</div>
                            </div>
                        )}
                        {second && (
                            <div className="bg-gradient-to-r from-[#c0c0c0]/20 to-transparent border-l-4 border-[#c0c0c0] p-4 rounded flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🥈</span>
                                    <div>
                                        <div className="font-rye text-xl md:text-2xl text-[#c0c0c0]">{second.username}</div>
                                        <div className="text-xs text-[#d7ccc8]">2do Lugar</div>
                                    </div>
                                </div>
                                <div className="font-rye text-2xl md:text-3xl text-[#81c784]">+${second.payout.toLocaleString()}</div>
                            </div>
                        )}
                        {third && (
                            <div className="bg-gradient-to-r from-[#cd7f32]/20 to-transparent border-l-4 border-[#cd7f32] p-4 rounded flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🥉</span>
                                    <div>
                                        <div className="font-rye text-xl md:text-2xl text-[#cd7f32]">{third.username}</div>
                                        <div className="text-xs text-[#d7ccc8]">3er Lugar</div>
                                    </div>
                                </div>
                                <div className="font-rye text-2xl md:text-3xl text-[#81c784]">+${third.payout.toLocaleString()}</div>
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

