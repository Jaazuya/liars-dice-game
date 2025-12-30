'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(''); // Estado para el código de invitación
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Función CREAR SALA
  const createRoom = async () => {
    if (!name.trim()) return alert('¡Necesitas un nombre, forastero!');
    setIsLoading(true);
    const newRoomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const playerId = uuidv4();

    try {
      await supabase.from('rooms').insert([{ code: newRoomCode }]);
      await supabase.from('players').insert([{ id: playerId, room_code: newRoomCode, name: name, is_host: true }]);
      localStorage.setItem('playerId', playerId);
      router.push(`/room/${newRoomCode}`);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  // Función UNIRSE A SALA (Nueva)
  const joinRoom = async () => {
    if (!name.trim() || !joinCode.trim()) return alert('Pon tu nombre y el código de la sala.');
    setIsLoading(true);
    const playerId = uuidv4();
    const codeUpper = joinCode.toUpperCase();

    try {
      // 1. Verificar si la sala existe
      const { data: roomData } = await supabase.from('rooms').select('code').eq('code', codeUpper).single();
      
      if (!roomData) {
        alert('Esa sala no existe, compañero.');
        setIsLoading(false);
        return;
      }

      // 2. Insertar jugador en la sala
      const { error } = await supabase
        .from('players')
        .insert([{ id: playerId, room_code: codeUpper, name: name, is_host: false }]);

      if (error) throw error;

      localStorage.setItem('playerId', playerId);
      router.push(`/room/${codeUpper}`);

    } catch (error) {
      console.error(error);
      alert('Error al unirse.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-900 flex flex-col items-center justify-center p-4">
      <div className="bg-stone-800 border-4 border-amber-700 p-8 rounded-lg max-w-md w-full text-center shadow-2xl">
        <h1 className="text-4xl font-bold text-amber-500 mb-6 uppercase tracking-widest">Liar's Dice</h1>
        
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu Nombre"
          className="w-full bg-stone-900 border border-stone-600 text-stone-200 p-3 rounded mb-6 focus:border-amber-500 outline-none text-lg font-bold"
        />

        <div className="space-y-4">
          <button 
            onClick={createRoom}
            disabled={isLoading}
            className="w-full bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold py-3 rounded transition border-2 border-amber-500"
          >
            {isLoading ? 'Cargando...' : 'CREAR SALA NUEVA'}
          </button>
          
          <div className="flex items-center gap-2 pt-4 border-t border-stone-700">
            <input 
              type="text" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="CÓDIGO"
              maxLength={4}
              className="w-24 bg-stone-900 border border-stone-600 text-stone-200 p-3 rounded focus:border-amber-500 outline-none uppercase text-center font-mono"
            />
            <button 
              onClick={joinRoom}
              disabled={isLoading}
              className="flex-1 bg-stone-700 hover:bg-stone-600 text-stone-300 font-bold py-3 rounded border-2 border-stone-500"
            >
              UNIRSE
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}