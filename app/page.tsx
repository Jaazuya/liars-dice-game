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

  // Cargar Top 5 cuando se abre el modal
  useEffect(() => {
    if (showTop5) {
      fetchTop5();
    }
  }, [showTop5]);

  // Cargar Bank cuando se abre el modal (y suscripción a cambios del balance)
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

  // Función CREAR SALA (con game_type) - Versión blindada
  const createRoom = async (gameType: 'DICE' | 'LOTERIA') => {
    if (!user || !profile) return;
    setIsLoading(true);
    setShowGameSelector(false);

    try {
      const playerId = uuidv4();
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const makeCode = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

      let roomCode = '';
      let diceRoomId: string | null = null; // UUID real (dice_rooms.id)
      let attempts = 0;
      while (!roomCode && attempts < 10) {
        attempts += 1;
        const candidate = makeCode();

        if (gameType === 'DICE') {
          // ✅ Esquema correcto: dice_rooms tiene `id` (UUID) y `code` (string)
          const { data: roomData, error } = await supabase
            .from('dice_rooms')
            .insert([{ code: candidate, host_id: user.id } as any])
            .select('id, code')
            .single();

          if (!error && roomData?.id) {
            roomCode = roomData.code || candidate;
            diceRoomId = roomData.id;
          } else if (error?.code && error.code !== '23505') {
            throw new Error(`No se pudo crear sala de Dados: ${error.message}`);
          }
        } else {
          // Lotería: host_id es OBLIGATORIO (economía global + permisos)
          const { error } = await supabase
            .from('loteria_rooms')
            .insert([{
              room_code: candidate,
              host_id: user.id,
              entry_fee: 0,
              is_playing: false,
              // Evita que defaults (ej. [] en jsonb) activen GameOver al crear sala
              game_over_data: null,
              claimed_awards: {},
              drawn_cards: [],
              current_card: null,
              last_game_event: null
            } as any]);

          if (!error) {
            roomCode = candidate;
          } else if (error.code && error.code !== '23505') {
            throw new Error(`No se pudo crear sala de Lotería: ${error.message}`);
          }
        }
      }

      if (!roomCode) throw new Error(
        gameType === 'LOTERIA'
          ? 'No se pudo crear sala de Lotería: tu BD aún tiene un FK loteria_rooms.room_code -> rooms(code). Elimina esa FK (o migra el esquema) para poder crear salas sin rooms.'
          : 'No se pudo generar un código de sala disponible.'
      );

      // Crear jugador host SOLO para dados (lotería se crea en hook al entrar)
      if (gameType === 'DICE') {
        if (!diceRoomId) throw new Error('No se pudo obtener el UUID de la sala de Dados.');

        const { error: playerError } = await supabase
          .from('dice_players')
          .insert([{
            id: playerId,
            room_id: diceRoomId, // ✅ UUID real, NO el code
            name: profile.username,
            user_id: user.id,
            is_host: true,
          } as any]);

        if (playerError) throw playerError;
        localStorage.setItem('playerId', playerId);
      }

      // Si llegamos aquí, TODO EXISTE en la BD.
      // 4. Redirigir SOLO AHORA
      if (gameType === 'LOTERIA') {
        router.push(`/loteria/room/${roomCode}`);
      } else {
        router.push(`/room/${roomCode}`);
      }

    } catch (error: any) {
      console.error('Error CRÍTICO al crear sala:', error);
      alert(`Error: ${error.message || 'No se pudo crear la sala'}`);
      // Al caer aquí, NO se ejecuta el router.push
    } finally {
      setIsLoading(false);
      setShowGameSelector(false);
    }
  };

  // Función UNIRSE A SALA
  const joinRoom = async () => {
    if (!user) {
      alert('Necesitas iniciar sesión para unirte a una sala.');
      return;
    }
    if (!profile?.username) {
      alert('Error: No se encontró tu nombre de usuario.');
      return;
    }
    if (!joinCode.trim()) {
      alert('Pon el código de la sala.');
      return;
    }
    setIsLoading(true);
    const playerId = uuidv4();
    const codeUpper = joinCode.toUpperCase();

    try {
      // 1) Buscar primero en DADOS
      const { data: diceRoom } = await supabase
        .from('dice_rooms')
        .select('id, code, game_phase')
        .eq('code', codeUpper)
        .single() as any;

      if (diceRoom) {
        const { error } = await supabase
          .from('dice_players')
          .insert([{
            id: playerId,
            room_id: diceRoom.id, // ✅ UUID real
            name: profile.username,
            user_id: user.id,
            is_host: false,
          } as any]);

        if (error) throw error;

        localStorage.setItem('playerId', playerId);
        router.push(`/room/${codeUpper}`);
        return;
      }

      // 2) Si no existe, buscar en LOTERÍA
      const { data: loteriaRoom } = await supabase
        .from('loteria_rooms')
        .select('room_code')
        .eq('room_code', codeUpper)
        .single() as any;

      if (loteriaRoom) {
        const { count: lpCount, error: lpErr } = await supabase
          .from('loteria_players')
          .select('*', { count: 'exact', head: true })
          .eq('room_code', codeUpper);
        if (lpErr) throw lpErr;
        if ((lpCount || 0) >= 10) {
          alert('La sala está llena (Tablas originales agotadas)');
          setIsLoading(false);
          return;
        }

        router.push(`/loteria/room/${codeUpper}`);
        return;
      }

      alert('Ese código no existe en Dados ni en Lotería.');
      setIsLoading(false);
      return;

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

  // Pantalla de bienvenida si no hay usuario
  if (!loading && !user) {
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

  // Dashboard si hay usuario
  if (loading) {
    return (
      <main className="min-h-screen bg-[#1a0f0d] flex items-center justify-center">
        <div className="text-[#ffb300] text-xl">Cargando...</div>
      </main>
    );
  }

  const getInitial = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <main className="min-h-screen bg-[#1a0f0d] flex flex-col p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
      <WesternDecor variant="corners" className="opacity-40" />
      
      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto mb-8">
        <div className="bg-[#3e2723] border-[4px] border-[#ffb300] rounded-lg p-4 shadow-lg flex items-center justify-between wood-texture">
          <div className="flex items-center gap-4">
            {/* Avatar */}
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
          <button
            onClick={handleSignOut}
            className="bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] px-4 py-2 rounded border border-[#8d6e63] transition-colors text-sm uppercase font-rye"
          >
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
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowTop5(true)}
            className="bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 px-8 rounded-lg border-4 border-[#ff6f00] shadow-lg text-xl uppercase tracking-wider transition-all w-full sm:w-auto"
          >
            🏆 TOP 5
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
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

      {/* Modal Top 5 */}
      <AnimatePresence>
        {showTop5 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowTop5(false)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-[#3e2723] border-[6px] border-[#ffb300] rounded-lg shadow-2xl max-w-md w-full p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase">
                🏆 TOP 5 JUGADORES
              </h2>
              
              <div className="space-y-3">
                {top5Loading ? (
                  <p className="text-[#d7ccc8] text-center font-mono">Cargando...</p>
                ) : top5Error ? (
                  <p className="text-red-200 text-center font-mono text-sm">{top5Error}</p>
                ) : topPlayers.length === 0 ? (
                  <p className="text-[#d7ccc8] text-center">No hay jugadores aún...</p>
                ) : (
                  topPlayers.map((player, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-[#1a0f0d] border-2 border-[#5d4037] rounded p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {index < 3 ? '👑' : '🏅'} #{index + 1}
                        </span>
                        <span className="text-xl font-rye font-bold text-[#ffb300]">
                          {player.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">👑</span>
                        <span className="text-lg font-bold text-[#d7ccc8]">{player.wins}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowTop5(false)}
                className="mt-6 w-full bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-colors uppercase"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Banco */}
      <AnimatePresence>
        {showBank && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowBank(false)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              className="bg-[#d7ccc8] border-[6px] border-[#3e2723] rounded-lg shadow-2xl max-w-lg w-full p-6 sm:p-8 relative"
              style={{
                backgroundImage: `url('https://www.transparenttextures.com/patterns/aged-paper.png')`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-3xl font-rye font-bold text-[#3e2723] mb-4 text-center uppercase">
                🏦 Banco
              </h2>

              {/* Tu Billetera */}
              <div className="bg-white/40 border-2 border-[#3e2723]/40 rounded p-4 mb-4">
                <div className="text-[#3e2723] font-rye text-lg mb-1 uppercase">Tu Billetera</div>
                {bankLoading && walletBalance === null ? (
                  <div className="h-10 bg-black/10 rounded animate-pulse" />
                ) : (
                  <div className="text-[#8b5a2b] font-rye text-4xl sm:text-5xl drop-shadow-sm">
                    $ {typeof walletBalance === 'number' ? walletBalance.toLocaleString() : '...'}
                  </div>
                )}
                <div className="text-[#5d4037] text-[11px] font-mono mt-2">
                  (Se actualiza en tiempo real)
                </div>
              </div>

              {/* Los Magnates */}
              <div className="bg-[#3e2723] text-[#ffecb3] border-2 border-[#3e2723] rounded p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-rye text-lg uppercase">Los Magnates</div>
                  <div className="text-xs font-mono opacity-80">Top 10</div>
                </div>

                {bankLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-10 bg-black/20 rounded animate-pulse" />
                    ))}
                  </div>
                ) : bankError ? (
                  <div className="bg-red-900/30 border border-red-700 text-red-100 rounded p-3 text-sm font-mono">
                    {bankError}
                  </div>
                ) : magnates.length === 0 ? (
                  <div className="text-center text-sm font-mono opacity-80">
                    No hay datos todavía...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {magnates.map((p, idx) => (
                      <div
                        key={`${p.username}-${idx}`}
                        className="bg-[#1a0f0d]/60 border border-[#8b5a2b]/40 rounded px-3 py-2 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="font-rye text-base shrink-0">
                            {idx === 0 ? '👑' : idx === 1 ? '👑' : idx === 2 ? '👑' : '🏅'} #{idx + 1}
                          </div>
                          <div className="font-rye text-lg truncate">{p.username}</div>
                        </div>
                        <div className="font-mono text-sm sm:text-base text-[#ffb300]">
                          $ {p.global_balance.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowBank(false)}
                className="mt-5 w-full bg-[#3e2723] hover:bg-[#2d1b15] text-[#ffecb3] font-rye font-bold py-3 rounded border-2 border-[#8b5a2b] transition-colors uppercase"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Selección de Juego */}
      <GameSelectorModal
        isOpen={showGameSelector}
        onClose={() => setShowGameSelector(false)}
        onSelect={createRoom}
      />
    </main>
  );
}
