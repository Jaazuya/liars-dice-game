'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { WesternDecor } from './components/WesternDecor';
import { GameSelectorModal } from './components/GameSelectorModal';

interface TopPlayer {
  username: string;
  wins: number;
}

interface RichPlayer {
  username: string;
  global_balance: number;
}

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTop5, setShowTop5] = useState(false);
  const [showGameSelector, setShowGameSelector] = useState(false);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [top5Loading, setTop5Loading] = useState(false);
  const [top5Error, setTop5Error] = useState<string | null>(null);

  const [showBank, setShowBank] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [magnates, setMagnates] = useState<RichPlayer[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const router = useRouter();

  // Cargar Top 5
  useEffect(() => {
    if (showTop5) fetchTop5();
  }, [showTop5]);

  // Cargar Bank
  useEffect(() => {
    if (!showBank) return;
    let channel: any = null;
    const uid = user?.id;

    const setup = async () => {
      await fetchBankHub();
      if (!uid) return;
      channel = supabase
        .channel(`profile_balance_dashboard_${uid}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`
        }, () => {
          fetchWallet();
        })
        .subscribe();
    };

    setup();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBank, user?.id]);

  const fetchTop5 = async () => {
    try {
      setTop5Loading(true);
      setTop5Error(null);
      const { data, error } = await supabase
        .from('profiles')
        .select('username, wins')
        .order('wins', { ascending: false })
        .limit(5);

      if (error) throw error;
      const cleaned: TopPlayer[] = (data || []).map((row: any) => ({
        username: row?.username || 'Forastero',
        wins: Number.isFinite(row?.wins) ? row.wins : 0
      }));
      cleaned.sort((a, b) => (b.wins - a.wins) || a.username.localeCompare(b.username));
      setTopPlayers(cleaned);
    } catch (error: any) {
      console.error('Error fetching top players:', error);
      setTopPlayers([]);
      setTop5Error(typeof error?.message === 'string' ? error.message : 'No se pudo cargar el Top 5.');
    } finally {
      setTop5Loading(false);
    }
  };

  const fetchWallet = async () => {
    const uid = user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('global_balance')
      .eq('id', uid)
      .single() as any;
    if (error) throw error;
    setWalletBalance(typeof data?.global_balance === 'number' ? data.global_balance : 0);
  };

  const fetchMagnates = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, global_balance')
      .order('global_balance', { ascending: false })
      .limit(10);
    if (error) throw error;
    const cleaned: RichPlayer[] = (data || []).map((row: any) => ({
      username: row?.username || 'Forastero',
      global_balance: Number.isFinite(row?.global_balance) ? row.global_balance : 0
    }));
    cleaned.sort((a, b) => (b.global_balance - a.global_balance) || a.username.localeCompare(b.username));
    setMagnates(cleaned);
  };

  const fetchBankHub = async () => {
    try {
      setBankLoading(true);
      setBankError(null);
      setWalletBalance(null);
      setMagnates([]);
      await Promise.all([fetchWallet(), fetchMagnates()]);
    } catch (error: any) {
      console.error('Error fetching bank hub:', error);
      setBankError(typeof error?.message === 'string' ? error.message : 'No se pudo cargar el Banco.');
    } finally {
      setBankLoading(false);
    }
  };

  // Función CREAR SALA (con game_type) - AHORA CON GO FISH 🎣
  const createRoom = async (gameType: 'DICE' | 'LOTERIA' | 'GOFISH') => {
    if (!user || !profile) return;
    setIsLoading(true);
    setShowGameSelector(false);

    try {
      const playerId = uuidv4();
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const makeCode = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

      // ==========================================
      // CASO 1: GO FISH 🎣 (Usamos el RPC seguro)
      // ==========================================
      if (gameType === 'GOFISH') {
        const roomCode = makeCode();
        // Llamamos a la función SQL que crea sala, baraja y host atómicamente
        const { data, error } = await supabase.rpc('create_gofish_game', {
            p_room_code: roomCode
        });

        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Error al crear sala de pesca');

        // Redirigir
        router.push(`/gofish?room=${roomCode}`);
        return;
      }

      // ==========================================
      // CASO 2: DADOS (RPC Segura)
      // ==========================================
      if (gameType === 'DICE') {
        // 1. Llamar a la RPC
        const { data, error } = await supabase.rpc('create_liar_room', {
          p_entry_fee: 100
        });

        if (error) {
          console.error('Error creando sala:', error);
          // Mostrar notificación de error
          throw new Error(error.message || 'No se pudo crear la sala');
        }

        if (data && data.success) {
          console.log('Sala creada:', data.room_code);
          console.log('🤠 Recibí mi placa de Sheriff:', data.player_id);

          // 🔥 PASO CRÍTICO: Guardar mi identidad ANTES de navegar
          // Esto asegura que al cargar la siguiente página, 'myId' sea correcto
          if (data.player_id) {
            localStorage.setItem('playerId', data.player_id);
          }

          // Redirigir
          window.location.href = `/room/${data.room_code}`;
        } else {
          throw new Error(data?.message || 'No se pudo crear la sala');
        }
      }

      // ==========================================
      // CASO 3: LOTERÍA (Método Clásico)
      // ==========================================
      if (gameType === 'LOTERIA') {
        let roomCode = '';
        let attempts = 0;
        
        while (!roomCode && attempts < 10) {
          attempts += 1;
          const candidate = makeCode();
          const { error } = await supabase
            .from('loteria_rooms')
            .insert([{
              room_code: candidate,
              host_id: user.id,
              entry_fee: 0,
              is_playing: false,
              game_over_data: null,
              claimed_awards: {},
              drawn_cards: [],
              current_card: null,
              last_game_event: null
            } as any]);

          if (!error) roomCode = candidate;
        }

        if (!roomCode) throw new Error('No se pudo generar un código de sala disponible.');
        router.push(`/loteria/room/${roomCode}`);
      }

    } catch (error: any) {
      console.error('Error al crear sala:', error);
      alert(`Error: ${error.message || 'No se pudo crear la sala'}`);
    } finally {
      setIsLoading(false);
      setShowGameSelector(false);
    }
  };

  // Función UNIRSE A SALA - AHORA BUSCA EN LOS 3 JUEGOS 🕵️‍♂️
  const joinRoom = async () => {
    if (!user) { alert('Necesitas iniciar sesión.'); return; }
    if (!joinCode.trim()) { alert('Pon el código de la sala.'); return; }
    
    setIsLoading(true);
    const playerId = uuidv4();
    const codeUpper = joinCode.toUpperCase().trim();

    try {
      // 1) Buscar en DADOS
      const { data: diceRoom } = await supabase
        .from('dice_rooms')
        .select('id, code')
        .eq('code', codeUpper)
        .single() as any;

      if (diceRoom) {
        const { error } = await supabase
          .from('dice_players')
          .insert([{
            id: playerId,
            room_id: diceRoom.id,
            name: profile?.username || 'Forastero',
            user_id: user.id,
            is_host: false,
          } as any]);
        
        if (!error) {
            localStorage.setItem('playerId', playerId);
            router.push(`/room/${codeUpper}`);
            return;
        }
      }

      // 2) Buscar en LOTERÍA
      const { data: loteriaRoom } = await supabase
        .from('loteria_rooms')
        .select('room_code')
        .eq('room_code', codeUpper)
        .single() as any;

      if (loteriaRoom) {
        // La lógica de unirse está en el hook de lotería, solo redirigimos
        router.push(`/loteria/room/${codeUpper}`);
        return;
      }

      // 3) Buscar en GO FISH 🎣 (NUEVO)
      const { data: goFishRoom } = await supabase
        .from('gofish_rooms')
        .select('room_code')
        .eq('room_code', codeUpper)
        .single() as any;

      if (goFishRoom) {
         // Verificamos si ya está dentro para no duplicar error
         const { data: existing } = await supabase
            .from('gofish_players')
            .select('user_id')
            .eq('room_code', codeUpper)
            .eq('user_id', user.id)
            .single();

         if (!existing) {
             const { error: joinErr } = await supabase
                .from('gofish_players')
                .insert({
                    room_code: codeUpper,
                    user_id: user.id,
                    hand: [], // Mano vacía
                    books: [],
                    score: 0,
                    has_paid: false
                });
             if (joinErr) throw joinErr;
         }
         
         router.push(`/gofish?room=${codeUpper}`);
         return;
      }

      alert('Ese código no existe en ningún juego.');
      setIsLoading(false);

    } catch (error) {
      console.error(error);
      alert('Error al unirse.');
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // ... (El resto del renderizado de Login y Header se mantiene igual)
  if (!loading && !user) { /* ... código de login existente ... */ return null; } // (Simplificado aquí por brevedad, usa tu código actual)
  
  if (loading) return <main className="min-h-screen bg-[#1a0f0d] flex items-center justify-center text-[#ffb300]">Cargando...</main>;
  if (!user) { 
      // Aquí pega tu bloque de Login original
      return (
        <main className="min-h-screen bg-[#1a0f0d] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
        <WesternDecor variant="full" className="opacity-30" />
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative z-10 text-center"
        >
            <h1 className="text-6xl font-rye font-bold text-[#ffb300] mb-4 drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)]">
            LIAR'S DICE
            </h1>
            <p className="text-[#d7ccc8] text-xl mb-8 uppercase tracking-widest">El Saloon te espera</p>
            <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/login')}
            className="bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-6 px-12 rounded-lg border-4 border-[#ff6f00] shadow-[0_0_30px_rgba(255,179,0,0.5)] text-2xl uppercase tracking-wider transition-all"
            >
            ENTRAR AL SALOON
            </motion.button>
        </motion.div>
        </main>
      );
  }

  const getInitial = (username: string) => username.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-[#1a0f0d] flex flex-col p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
      <WesternDecor variant="corners" className="opacity-40" />
      
      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto mb-8">
        <div className="bg-[#3e2723] border-[4px] border-[#ffb300] rounded-lg p-4 shadow-lg flex items-center justify-between wood-texture">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1a0f0d] border-2 border-[#ffb300] flex items-center justify-center text-2xl font-bold text-[#ffb300]">
              {profile?.username ? getInitial(profile.username) : '?'}
            </div>
            <div>
              <h2 className="text-2xl font-rye font-bold text-[#ffb300]">
                {profile?.username || 'Forastero'}
              </h2>
              <div className="flex items-center gap-2 text-[#d7ccc8]">
                <span className="text-xl">👑</span>
                <span className="font-bold text-lg">{profile?.wins || 0}</span>
              </div>
            </div>
          </div>
          <button onClick={handleSignOut} className="bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] px-4 py-2 rounded border border-[#8d6e63] transition-colors text-sm uppercase font-rye">
            Salir
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
        {/* Botones Hub */}
        <div className="mb-8 flex flex-col sm:flex-row gap-3 w-full justify-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            onClick={() => setShowTop5(true)}
            className="bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 px-8 rounded-lg border-4 border-[#ff6f00] shadow-lg text-xl uppercase tracking-wider transition-all w-full sm:w-auto"
          >
            🏆 TOP 5
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            onClick={() => setShowBank(true)}
            className="bg-[#5d4037] hover:bg-[#6d4c41] text-[#ffecb3] font-rye font-bold py-4 px-8 rounded-lg border-4 border-[#8d6e63] shadow-lg text-xl uppercase tracking-wider transition-all w-full sm:w-auto"
          >
            🏦 Billetera / Banco
          </motion.button>
        </div>

        {/* Controles de Sala */}
        <div className="bg-[#3e2723] border-[4px] border-[#5d4037] rounded-lg p-8 w-full shadow-2xl wood-texture">
          <h3 className="text-2xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase">
            Crear o Unirse a Sala
          </h3>

          <div className="space-y-4">
            <button 
              onClick={() => setShowGameSelector(true)}
              disabled={isLoading}
              className="w-full bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 rounded border-2 border-[#ff6f00] shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-lg"
            >
              {isLoading ? 'Cargando...' : 'CREAR SALA NUEVA'}
            </button>
            
            <div className="flex items-center gap-2 pt-4 border-t border-[#5d4037]">
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                maxLength={4}
                className="w-24 bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none uppercase text-center font-mono text-lg"
              />
              <button 
                onClick={joinRoom}
                disabled={isLoading}
                className="flex-1 bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-all uppercase"
              >
                UNIRSE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AQUÍ VAN TUS MODALES (Top5, Bank) QUE YA TENÍAS... */}
      {/* ... (Pega aquí el código de tus modales Top5 y Banco del mensaje anterior si los borraste) ... */}
      {/* MODAL TOP 5 */}
      <AnimatePresence>
       {showTop5 && ( /* ... Tu código del Top 5 ... */ 
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowTop5(false)}>
             <div className="bg-[#3e2723] border-[6px] border-[#ffb300] rounded-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                 <h2 className="text-2xl font-rye text-[#ffb300] text-center mb-4">🏆 TOP 5</h2>
                 {/* ... Lista de top players ... */}
                 <div className="space-y-2">
                    {topPlayers.map((p, i) => (
                        <div key={i} className="flex justify-between text-[#d7ccc8]">
                            <span>#{i+1} {p.username}</span>
                            <span>{p.wins} 👑</span>
                        </div>
                    ))}
                 </div>
                 <button onClick={() => setShowTop5(false)} className="mt-4 w-full bg-[#5d4037] text-[#d7ccc8] p-2 rounded">Cerrar</button>
             </div>
          </motion.div>
       )}
      </AnimatePresence>

      {/* MODAL BANCO */}
      <AnimatePresence>
       {showBank && ( /* ... Tu código del Banco ... */ 
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowBank(false)}>
             <div className="bg-[#d7ccc8] border-[6px] border-[#3e2723] rounded-lg p-8 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
                 <h2 className="text-2xl font-rye text-[#3e2723] text-center mb-4">🏦 BANCO</h2>
                 <div className="text-center mb-6">
                    <p className="text-[#3e2723]">Tu Saldo:</p>
                    <p className="text-4xl font-rye text-[#8b5a2b]">$ {walletBalance}</p>
                 </div>
                 <div className="space-y-2 max-h-40 overflow-y-auto">
                    {magnates.map((m, i) => (
                        <div key={i} className="flex justify-between text-[#3e2723] border-b border-[#3e2723]/20 pb-1">
                            <span>#{i+1} {m.username}</span>
                            <span>$ {m.global_balance}</span>
                        </div>
                    ))}
                 </div>
                 <button onClick={() => setShowBank(false)} className="mt-4 w-full bg-[#3e2723] text-[#ffecb3] p-2 rounded">Cerrar</button>
             </div>
          </motion.div>
       )}
      </AnimatePresence>

      {/* ✅ MODAL DE SELECCIÓN DE JUEGO (Conectado a la nueva función) */}
      <GameSelectorModal
        isOpen={showGameSelector}
        onClose={() => setShowGameSelector(false)}
        onSelect={createRoom} // createRoom ahora acepta 'GOFISH'
      />
    </main>
  );
}