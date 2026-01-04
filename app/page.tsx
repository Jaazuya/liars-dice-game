'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { WesternDecor } from './components/WesternDecor';

interface TopPlayer {
  username: string;
  wins: number;
}

export default function Home() {
  const { user, profile, loading, signOut } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTop5, setShowTop5] = useState(false);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const router = useRouter();

  // Cargar Top 5 cuando se abre el modal
  useEffect(() => {
    if (showTop5) {
      fetchTop5();
    }
  }, [showTop5]);

  const fetchTop5 = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, wins')
        .order('wins', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopPlayers(data || []);
    } catch (error) {
      console.error('Error fetching top players:', error);
      setTopPlayers([]);
    }
  };

  // Función CREAR SALA
  const createRoom = async () => {
    if (!profile?.username) {
      alert('Error: No se encontró tu nombre de usuario.');
      return;
    }
    setIsLoading(true);
    const newRoomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const playerId = uuidv4();

    try {
      await supabase.from('rooms').insert([{ code: newRoomCode }]);
      await supabase.from('players').insert([{ 
        id: playerId, 
        room_code: newRoomCode, 
        name: profile.username, 
        is_host: true 
      }]);
      localStorage.setItem('playerId', playerId);
      router.push(`/room/${newRoomCode}`);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  // Función UNIRSE A SALA
  const joinRoom = async () => {
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
      const { data: roomData } = await supabase
        .from('rooms')
        .select('code, status')
        .eq('code', codeUpper)
        .single();
      
      if (!roomData) {
        alert('Esa sala no existe, compañero.');
        setIsLoading(false);
        return;
      }

      const playerData: any = {
        id: playerId,
        room_code: codeUpper,
        name: profile.username,
        is_host: false,
        seat_index: null
      };

      if (roomData.status === 'playing') {
        playerData.dice_values = [];
        playerData.money = 0;
        playerData.current_contribution = 0;
        playerData.is_ready = false;
      }

      const { error } = await supabase
        .from('players')
        .insert([playerData]);

      if (error) throw error;

      localStorage.setItem('playerId', playerId);
      router.push(`/room/${codeUpper}`);

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
        {/* Botón Top 5 */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowTop5(true)}
          className="mb-8 bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 px-8 rounded-lg border-4 border-[#ff6f00] shadow-lg text-xl uppercase tracking-wider transition-all"
        >
          🏆 TOP 5
        </motion.button>

        {/* Controles de Sala */}
        <div className="bg-[#3e2723] border-[4px] border-[#5d4037] rounded-lg p-8 w-full shadow-2xl wood-texture">
          <h3 className="text-2xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase">
            Crear o Unirse a Sala
          </h3>

          <div className="space-y-4">
            <button 
              onClick={createRoom}
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
                {topPlayers.length === 0 ? (
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
                        <span className="text-2xl">#{index + 1}</span>
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
    </main>
  );
}
