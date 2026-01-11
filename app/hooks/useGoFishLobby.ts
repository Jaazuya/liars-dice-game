import { useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

export const useGoFishLobby = (user: any) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FUNCIÓN 1: CREAR SALA
  const createRoom = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // 1. Generamos un código aleatorio de 4 letras (Ej: FISH, TUNA)
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    try {
      // 2. Llamamos al SQL Blindado que acabamos de crear
      const { data, error: rpcError } = await supabase.rpc('create_gofish_game', {
        p_room_code: roomCode
      });

      if (rpcError) throw rpcError;
      if (data && !data.success) throw new Error(data.error);

      // 3. Si todo salió bien, nos vamos a la sala
      console.log('Sala creada:', roomCode);
      // OJO: Aquí deberíamos redirigir a una URL dinámica, por ahora recargaremos la página
      // o guardaremos el estado. Para este paso, usaremos query params.
      router.push(`/gofish?room=${roomCode}`);
      
    } catch (err: any) {
      console.error('Error creando sala:', err);
      setError(err.message || 'No se pudo crear la sala');
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN 2: UNIRSE A SALA
  const joinRoom = async (codeInput: string) => {
    if (!user || !codeInput) return;
    setLoading(true);
    setError(null);
    const code = codeInput.trim().toUpperCase();

    try {
      // 1. Verificar si la sala existe
      const { data: room, error: roomError } = await supabase
        .from('gofish_rooms')
        .select('room_code')
        .eq('room_code', code)
        .single();

      if (roomError || !room) throw new Error('Sala no encontrada');

      // 2. Verificar si ya estoy dentro (para no duplicar)
      const { data: existingPlayer } = await supabase
        .from('gofish_players')
        .select('user_id')
        .eq('room_code', code)
        .eq('user_id', user.id)
        .single();

      // 3. Si no estoy, me meto
      if (!existingPlayer) {
        const { error: joinError } = await supabase
          .from('gofish_players')
          .insert({
            room_code: code,
            user_id: user.id,
            hand: [],
            books: [],
            score: 0,
            has_paid: false
          });
        
        if (joinError) throw joinError;
      }

      // 4. Redirigir
      router.push(`/gofish?room=${code}`);

    } catch (err: any) {
      console.error('Error uniéndose:', err);
      setError(err.message || 'No se pudo entrar a la sala');
    } finally {
      setLoading(false);
    }
  };

  return {
    createRoom,
    joinRoom,
    loading,
    error
  };
};