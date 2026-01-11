'use client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import GoFishWaitingRoom from './components/GoFishWaitingRoom';
// 1. IMPORTANTE: Traemos el Tablero de Juego
import GoFishGameBoard from './components/GoFishGameBoard';

export default function GoFishPage() {
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Protección contra SSR: Solo acceder a searchParams después de montar
  const roomCodeParam = isMounted ? searchParams.get('room') : null; 

  // 1. HOOKS: ESTADOS
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');

  // 3. HOOKS: EFECTOS
  
  // Efecto para marcar el componente como montado (solo en cliente)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Efecto para verificar sesión (solo después de montar)
  useEffect(() => {
    if (!isMounted) return;
    
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
      } else {
        setUser(user);
      }
      setLoadingUser(false);
    };
    checkUser();
  }, [isMounted, router]);

  // Efecto para detectar cambios en la sala
  useEffect(() => {
    if (!roomCodeParam || !user) return;
    // Reseteamos a lobby localmente al entrar, el componente hijo (WaitingRoom)
    // se encargará de detectar si la sala ya está 'playing' y llamar a onGameStart
    setGamePhase('lobby'); 
  }, [roomCodeParam, user]);

  // Redirección si no hay sala (Tu lógica original)
  useEffect(() => {
    if (loadingUser) return;
    if (!user) return;
    if (roomCodeParam) return;
    router.replace('/');
  }, [loadingUser, user, roomCodeParam, router]);


  // ============================================================
  // 4. RENDERIZADO CONDICIONAL
  // ============================================================

  // No renderizar nada en el servidor, solo en el cliente
  if (!isMounted) {
    return <div className="min-h-screen bg-[#1a0f0d]" />;
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#1a0f0d] flex items-center justify-center">
        <div className="text-[#ffb300] font-rye text-xl animate-pulse">Cargando pescador... 🎣</div>
      </div>
    );
  }

  if (!user) return null;

  // CASO A: ESTAMOS DENTRO DE UNA SALA (?room=CODIGO)
  if (roomCodeParam) {
    
    // 2. CAMBIO PRINCIPAL: Si estamos jugando, mostramos la MESA
    if (gamePhase === 'playing') {
      return (
        <GoFishGameBoard 
            roomCode={roomCodeParam.trim().toUpperCase()} 
            user={user} 
        />
      );
    }

    // Si no, mostramos la Sala de Espera
    return (
      <GoFishWaitingRoom
        roomCode={roomCodeParam.trim().toUpperCase()}
        user={user}
        onGameStart={() => setGamePhase('playing')}
      />
    );
  }

  // CASO B: SIN SALA -> redirigiendo al Lobby principal
  return (
    <div className="min-h-screen bg-[#1a0f0d] flex items-center justify-center p-6 text-center">
      <div className="text-[#ffb300] font-rye text-xl animate-pulse">
        Redirigiendo al Lobby principal...
      </div>
    </div>
  );
}