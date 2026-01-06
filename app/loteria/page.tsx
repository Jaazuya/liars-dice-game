'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/app/hooks/useAuth';
import { motion } from 'framer-motion';
import { WesternDecor } from '@/app/components/WesternDecor';

export default function LoteriaLobby() {
  const { user, profile, loading } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Función CREAR MESA DE LOTERÍA
  const createLoteriaRoom = async () => {
    if (!user) {
      alert('Necesitas iniciar sesión para crear una mesa.');
      return;
    }
    if (!profile?.username) {
      alert('Error: No se encontró tu nombre de usuario.');
      return;
    }
    setIsLoading(true);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const makeCode = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    const playerId = uuidv4();

    try {
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
            // Evita que defaults (ej. [] en jsonb) activen GameOver al entrar a una sala nueva
            game_over_data: null,
            claimed_awards: {},
            drawn_cards: [],
            current_card: null,
            last_game_event: null
          } as any]);
        if (!error) roomCode = candidate;
      }

      if (!roomCode) throw new Error('No se pudo generar un código de mesa disponible.');

      // Guardamos playerId (solo para UI/compatibilidad; la membresía se maneja en loteria_players)
      localStorage.setItem('playerId', playerId);
      router.push(`/loteria/room/${roomCode}`);
    } catch (error) {
      console.error(error);
      alert('Error al crear la mesa de lotería.');
      setIsLoading(false);
    }
  };

  // Función UNIRSE A MESA
  const joinLoteriaRoom = async () => {
    if (!user) {
      alert('Necesitas iniciar sesión para unirte a una mesa.');
      return;
    }
    if (!profile?.username) {
      alert('Error: No se encontró tu nombre de usuario.');
      return;
    }
    if (!joinCode.trim()) {
      alert('Pon el código de la mesa.');
      return;
    }
    setIsLoading(true);
    const playerId = uuidv4();
    const codeUpper = joinCode.toUpperCase();

    try {
      // Verificar que la mesa existe en loteria_rooms
      const { data: loteriaRoom, error: roomError } = await supabase
        .from('loteria_rooms')
        .select('room_code')
        .eq('room_code', codeUpper)
        .single();
      if (roomError || !loteriaRoom) {
        alert('Esa mesa no existe, compañero.');
        setIsLoading(false);
        return;
      }

      // Capacidad: máximo 10 jugadores (según loteria_players)
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

      localStorage.setItem('playerId', playerId);
      router.push(`/loteria/room/${codeUpper}`);

    } catch (error) {
      console.error(error);
      alert('Error al unirse a la mesa.');
      setIsLoading(false);
    }
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
            LOTERÍA MEXICANA
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

  return (
    <main className="min-h-screen bg-[#1a0f0d] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
      <WesternDecor variant="corners" className="opacity-40" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        {/* Título */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-rye font-bold text-[#ffb300] mb-4 drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)]">
            LOTERÍA MEXICANA
          </h1>
          <p className="text-[#d7ccc8] text-lg uppercase tracking-widest">¡Que empiece el juego!</p>
        </div>

        {/* Controles de Mesa */}
        <div className="bg-[#3e2723] border-[4px] border-[#5d4037] rounded-lg p-8 w-full shadow-2xl wood-texture">
          <div className="space-y-4">
            <motion.button 
              onClick={createLoteriaRoom}
              disabled={isLoading}
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              className="w-full bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 rounded border-2 border-[#ff6f00] shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-lg"
            >
              {isLoading ? 'Creando...' : 'CREAR MESA DE LOTERÍA'}
            </motion.button>
            
            <div className="flex items-center gap-2 pt-4 border-t border-[#5d4037]">
              <input 
                type="text" 
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CÓDIGO"
                maxLength={4}
                className="w-24 bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none uppercase text-center font-mono text-lg"
              />
              <motion.button 
                onClick={joinLoteriaRoom}
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className="flex-1 bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-all uppercase"
              >
                UNIRSE CON CÓDIGO
              </motion.button>
            </div>
          </div>
        </div>

        {/* Botón para volver al dashboard */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-[#d7ccc8] hover:text-[#ffb300] font-rye text-sm uppercase tracking-wider transition-colors"
          >
            ← Volver al Dashboard
          </button>
        </div>
      </motion.div>
    </main>
  );
}

