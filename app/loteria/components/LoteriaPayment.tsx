'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';

export interface LoteriaPresencePlayer {
  user_id: string;
  name: string;
  is_host?: boolean;
}

interface LoteriaPaymentProps {
  entryFee: number;
  players: LoteriaPresencePlayer[];
  playersPaymentStatus: Record<string, boolean>;
  myId?: string;
  isHost: boolean;
  onPay: (amount: number) => void;
  onStartGame: () => void;
  onAbandon: () => void;
}

export const LoteriaPayment = ({ 
  entryFee, 
  players, 
  playersPaymentStatus, 
  myId, 
  isHost, 
  onPay, 
  onStartGame,
  onAbandon 
}: LoteriaPaymentProps) => {
  
  const hasPaid = myId ? playersPaymentStatus[myId] : false;
  const allPaid = players.every(p => playersPaymentStatus[p.user_id] || false);
  const [bank, setBank] = useState<number | null>(null);
  const storageKey = myId ? `loteria_bet_${myId}` : null;
  const [myBet, setMyBet] = useState<number>(() => {
    if (typeof window === 'undefined') return entryFee || 50;
    try {
      const raw = storageKey ? window.localStorage.getItem(storageKey) : null;
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : (entryFee || 50);
    } catch {
      return entryFee || 50;
    }
  });

  useEffect(() => {
    let mounted = true;
    const fetchBank = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('global_balance')
        .eq('id', uid)
        .single() as any;

      if (mounted) setBank(profileData?.global_balance ?? null);
    };
    fetchBank();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // La apuesta se elige en la Sala de Espera. Aquí solo la leemos.
  }, [storageKey, myBet]);
  
  // Filtrar jugadores de la tabla loteria (que tienen status de pago)
  // Usamos el array 'players' para nombres, pero verificamos status con 'playersPaymentStatus'

  return (
    <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] text-center z-10 w-full min-h-[100dvh] bg-[#2d1b15] relative overflow-y-auto">
      
      {/* Poster WANTED */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#d7ccc8] p-4 sm:p-8 rounded-sm shadow-2xl max-w-md w-full relative transform rotate-1 border-4 border-[#a1887f]"
        style={{
             backgroundImage: `url('https://www.transparenttextures.com/patterns/aged-paper.png')`,
             boxShadow: '0 0 50px rgba(0,0,0,0.5)'
        }}
      >
         {/* Clavo */}
         <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#3e2723] shadow-md z-20 border border-[#5d4037]"></div>

         <h2 className="font-rye text-4xl sm:text-5xl text-[#3e2723] mb-2 uppercase border-b-4 border-[#3e2723] pb-2 tracking-widest">
            SE BUSCA
         </h2>
         
         <div className="my-6">
            <p className="font-rye text-xl text-[#5d4037] mb-2">Entrada a la Mesa</p>
            <div className="text-6xl font-rye text-[#8b1a1a] animate-pulse">
                ${myBet}
            </div>
            <p className="text-[#5d4037] text-[10px] uppercase tracking-widest mt-2 font-bold">
              Tú decides cuánto apostar (se reparte por puntos)
            </p>
         </div>

         <div className="mb-4 bg-[#3e2723]/10 border border-[#3e2723]/30 rounded p-3">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#3e2723]">Banco</div>
            <div className="font-rye text-2xl text-[#3e2723]">Banco: ${bank?.toLocaleString?.() ?? '...'}</div>
         </div>

         {/* Estado de Pago Personal */}
         {!hasPaid ? (
            <div className="mb-6">
              <div className="bg-[#3e2723]/10 border border-[#3e2723]/30 rounded p-3 mb-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#3e2723] mb-2">
                  Tu apuesta (elegida en la sala)
                </div>
                <div className="font-rye text-4xl text-[#3e2723]">
                  ${myBet}
                </div>
                <p className="text-[#5d4037] text-[10px] uppercase tracking-widest mt-2 font-bold">
                  ¿Listo para pagar y entrar?
                </p>
              </div>

              <button
                  onClick={() => onPay(myBet)}
                  disabled={bank !== null && myBet > bank}
                  className={`w-full font-rye text-2xl py-4 rounded border-2 shadow-lg uppercase tracking-wider transition-all ${
                    bank !== null && myBet > bank
                      ? 'bg-[#a1887f] text-[#d7ccc8] border-[#8d6e63] cursor-not-allowed grayscale'
                      : 'bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] border-[#ff6f00] animate-bounce'
                  }`}
              >
                  💰 PAGAR AHORA
              </button>
            </div>
         ) : (
            <div className="bg-[#2e7d32] text-white font-rye text-xl py-3 rounded border-2 border-[#1b5e20] mb-6 shadow-inner flex items-center justify-center gap-2">
                <span>✅</span> PAGADO
            </div>
         )}

         {/* Lista de Deudores / Pagadores */}
         <div className="bg-[#3e2723]/10 p-4 rounded border border-[#3e2723]/30">
            <h3 className="font-rye text-[#3e2723] text-sm mb-3 uppercase">Estado de la Mesa</h3>
            <div className="flex flex-wrap gap-2 justify-center">
                {players.map(p => {
                    const paid = playersPaymentStatus[p.user_id];
                    return (
                        <div 
                           key={p.user_id} 
                           className={`
                             px-2 py-1 rounded border text-xs font-bold flex items-center gap-1
                             ${paid ? 'bg-[#2e7d32] text-white border-[#1b5e20]' : 'bg-[#c62828] text-white border-[#b71c1c] opacity-80'}
                           `}
                        >
                            {paid ? '✓' : '✗'} {p.name}
                        </div>
                    );
                })}
            </div>
         </div>

         {/* Controles Host */}
         {isHost && (
             <div className="mt-6 pt-4 border-t-2 border-[#3e2723] border-dashed">
                 <button
                    onClick={onStartGame}
                    disabled={!allPaid}
                    className={`
                        w-full font-rye text-xl py-3 rounded border-2 shadow-lg uppercase transition-all
                        ${allPaid 
                            ? 'bg-[#3e2723] text-[#ffb300] border-[#5d4037] hover:scale-105 cursor-pointer' 
                            : 'bg-[#a1887f] text-[#d7ccc8] border-[#8d6e63] cursor-not-allowed grayscale'
                        }
                    `}
                 >
                    {allPaid ? '🤠 Iniciar Partida' : '⏳ Esperando Pagos...'}
                 </button>
                 {!allPaid && (
                    <p className="text-[10px] text-[#5d4037] mt-2 font-mono">
                        Todos deben pagar para iniciar.
                    </p>
                 )}
             </div>
         )}

         <button 
            onClick={onAbandon}
            className="mt-4 text-[#5d4037] underline font-rye text-xs hover:text-[#3e2723]"
         >
            Abandonar Mesa
         </button>

      </motion.div>
    </div>
  );
};

