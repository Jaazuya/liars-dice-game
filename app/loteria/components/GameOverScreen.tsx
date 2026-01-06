import { motion } from 'framer-motion';
import { LoteriaLeaderboardEntry } from '@/app/hooks/useLoteriaGame2';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { DiceGameOverEntry } from '@/app/types/game';

interface GameOverScreenProps {
  leaderboard: LoteriaLeaderboardEntry[];
  gameOverData?: DiceGameOverEntry[]; // backend result: distribute_loteria_winnings
  payoutPending?: boolean;
  onRestart?: () => void;
  onReturnToLobby?: () => void;
  isHost: boolean;
}

export const GameOverScreen = ({ leaderboard, gameOverData, payoutPending, onRestart, onReturnToLobby, isHost }: GameOverScreenProps) => {
  const winner = leaderboard[0];
  const [bank, setBank] = useState<number | null>(null);

  const top = useMemo(() => {
    // Esperamos array tipo: [{username, rank, payout, score?}, ...]
    if (Array.isArray(gameOverData)) {
      return [...gameOverData].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, 3);
    }
    return [];
  }, [gameOverData]);

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const fetchBank = async (uid: string) => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('global_balance')
        .eq('id', uid)
        .single() as any;
      if (mounted) setBank(profileData?.global_balance ?? null);
    };

    const setup = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;

      await fetchBank(uid);

      channel = supabase
        .channel(`profile_balance_loteria_${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`
        }, () => {
          fetchBank(uid);
        })
        .subscribe();
    };

    setup();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#1a0f0d]/95 flex flex-col items-center justify-start sm:justify-center overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg p-4 sm:p-0 my-4 sm:my-0 flex flex-col items-center"
      >
        {/* Cartel de Madera */}
        <div className="bg-[#3e2723] border-[6px] border-[#5d4037] rounded-lg p-6 sm:p-8 shadow-[0_0_50px_rgba(255,179,0,0.2)] text-center relative w-full">
          
          {/* Clavos decorativos */}
          <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>

          <h1 className="text-3xl sm:text-5xl font-rye text-[#ffb300] mb-2 uppercase drop-shadow-md animate-bounce">
            ¡BUENAS!
          </h1>
          
          <div className="text-[#d7ccc8] font-rye text-lg sm:text-xl mb-6">
            Tenemos un ganador
          </div>
          
          <div className="bg-[#1a100e] border border-[#5d4037] rounded p-3 mb-5 text-[#ffecb3] text-sm sm:text-base font-rye">
            ¡Ganancias enviadas a tu cuenta global! <span className="text-[#ffb300]">(Redondeadas a tu favor)</span>
          </div>
          {payoutPending && (
            <div className="bg-[#1a100e] border border-[#5d4037] rounded p-3 mb-5 text-[#d7ccc8] text-xs sm:text-sm font-mono">
              Calculando y repartiendo premios...
            </div>
          )}
          <div className="text-[#a1887f] font-mono text-xs mb-5">
            Banco: ${bank?.toLocaleString?.() ?? '...'}
          </div>

          {/* Ganadores (backend) */}
          {top.length > 0 ? (
            <div className="mb-6 space-y-3">
              {top.map((row) => {
                const rank = row?.rank;
                const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                const color = rank === 1 ? 'text-[#ffd700]' : rank === 2 ? 'text-[#c0c0c0]' : 'text-[#cd7f32]';
                return (
                  <div key={row.user_id || `${row.username}-${rank}`} className="bg-[#2d1b15] p-4 rounded border-2 border-[#8b5a2b] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{icon}</div>
                      <div className="text-left">
                        <div className={`font-rye text-xl ${color}`}>{row?.username || 'Jugador'}</div>
                        <div className="text-[#a1887f] text-xs font-mono">
                          Lugar #{rank} · {row?.score ?? 0} pts
                        </div>
                      </div>
                    </div>
                    <div className="font-rye text-2xl text-[#4caf50]">+${(row?.payout ?? 0).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          ) : (
          /* Fallback: Ganador por puntaje (legacy) */
          winner && (
            <div className="bg-[#2d1b15] p-4 rounded border-2 border-[#8b5a2b] mb-6 flex flex-col items-center gap-3">
              <div className="text-4xl sm:text-5xl">👑</div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white font-rye tracking-wider">
                  {winner.name}
                </h2>
                <p className="text-[#ffb300] font-mono text-lg sm:text-xl">
                  {winner.score} pts
                </p>
              </div>
            </div>
          ))}

          {/* Tabla de Posiciones (legacy) */}
          {/* Si ya tenemos `game_over_data`, ocultamos el leaderboard para que todo sea backend-driven. */}
          {top.length === 0 && (
            <div className="bg-[#1a100e] p-3 rounded border border-[#5d4037] mb-6 max-h-[30vh] overflow-y-auto">
               <h3 className="text-[#a1887f] font-rye text-sm mb-2 border-b border-[#3e2723] pb-1">
                 Tabla de Posiciones
               </h3>
               <ul className="space-y-2">
                 {leaderboard.slice(1).map((player, idx) => (
                   <li key={player.user_id} className="flex justify-between items-center text-sm text-[#d7ccc8] px-2">
                     <span>{idx + 2}. {player.name}</span>
                     <span className="font-mono text-[#a1887f]">{player.score}</span>
                   </li>
                 ))}
               </ul>
            </div>
          )}

          {/* Botones de Acción (Grandes para móvil) */}
          <div className="flex flex-col gap-3 w-full">
            {isHost && onRestart && (
              <button
                onClick={onRestart}
                className="w-full bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye py-4 rounded text-lg sm:text-xl shadow-lg border-2 border-[#ff6f00] uppercase tracking-wide active:scale-95 transition-transform"
              >
                🔄 Nueva Partida
              </button>
            )}
            
            {onReturnToLobby && (
               <button
                 onClick={onReturnToLobby}
                 className="w-full bg-[#4e342e] hover:bg-[#5d4037] text-[#d7ccc8] font-rye py-4 rounded text-lg sm:text-xl shadow border-2 border-[#6d4c41] uppercase tracking-wide active:scale-95 transition-transform"
               >
                 🚪 Volver al Saloon
               </button>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
};
