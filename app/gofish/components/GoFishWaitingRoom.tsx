'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { WesternDecor } from '@/app/components/WesternDecor';

interface Props {
  roomCode: string;
  user: any;
  onGameStart: () => void; // Para avisarle al padre que el juego empezó
}

export default function GoFishWaitingRoom({ roomCode, user, onGameStart }: Props) {
  const router = useRouter();
  const [players, setPlayers] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any>(null);
  const [loadingPay, setLoadingPay] = useState(false);
  const [myBalance, setMyBalance] = useState(0);
  const [starting, setStarting] = useState(false);
  const [view, setView] = useState<'lobby' | 'payments'>('lobby');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [profilesById, setProfilesById] = useState<Record<string, { username?: string; avatar_url?: string | null }>>({});
  const channelRef = useRef<any>(null);
  const subscribedRef = useRef(false);
  const profilesRef = useRef<Record<string, { username?: string; avatar_url?: string | null }>>({});
  const viewRef = useRef<'lobby' | 'payments'>('lobby');
  const isHostRef = useRef(false);

  // Identificar si soy Host
  const myId = String(user?.id ?? user?.user_id ?? '').trim();
  const hostId = String(roomData?.host_id ?? '').trim();
  const isHost = !!myId && !!hostId && hostId === myId;
  const amIPaid = players.find(p => String(p.user_id ?? '').trim() === myId)?.has_paid;
  const entryFee = Number.isFinite(roomData?.entry_fee) ? Number(roomData.entry_fee) : 0;
  const effectiveFee = entryFee > 0 ? entryFee : 50;
  const allPaid = players.length > 1 && players.every(p => !!p.has_paid);
  const copyCode = () => {
    try {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const updateEntryFee = async (nextFee: number) => {
    if (!isHost) return;
    if (!roomData) return;
    setErrorMsg(null);

    const fee = Math.max(10, Math.round(nextFee));
    // UI optimista
    setRoomData((prev: any) => prev ? ({ ...prev, entry_fee: fee }) : prev);

    const { error } = await supabase
      .from('gofish_rooms')
      .update({ entry_fee: fee })
      .eq('room_code', roomCode);

    if (error) {
      console.error('update entry_fee failed:', error);
      setErrorMsg(error.message || 'No se pudo actualizar la apuesta.');
      // fallback: re-fetch sala para volver a un valor consistente
      fetchRoomData();
    }
  };

  const openPayments = async () => {
    setView('payments');
    try {
      // Broadcast inmediato (para que todos cambien aunque el presence tarde)
      channelRef.current?.send({
        type: 'broadcast',
        event: 'host_view',
        payload: { view: 'payments', by: myId }
      });
    } catch {}
  };

  const goLobby = async () => {
    setView('lobby');
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'host_view',
        payload: { view: 'lobby', by: myId }
      });
    } catch {}
  };

  // 1. Cargar Datos Iniciales y Balance
  useEffect(() => {
    let mounted = true;
    setErrorMsg(null);
    fetchRoomData();
    fetchPlayers();
    fetchMyBalance();

    // SUSCRIPCIÓN REALTIME (Jugadores, Sala y Presence/Broadcast)
    const channel = supabase
      .channel(`gofish_room_${roomCode}`, {
        config: { presence: { key: myId || roomCode } }
      })
      // Presence: seguir al host (lobby/payments) como en Lotería/Dados
      .on('presence', { event: 'sync' }, () => {
        if (!mounted) return;
        try {
          const state = channel.presenceState?.() || {};
          const all = Object.values(state).flat() as any[];
          const host = all.find((p) => p?.is_host);
          const hostView = host?.view;
          if (!isHost && (hostView === 'lobby' || hostView === 'payments')) {
            setView(hostView);
          }
        } catch {}
      })
      .on('presence', { event: 'join' }, () => {
        if (!mounted) return;
        try {
          const state = channel.presenceState?.() || {};
          const all = Object.values(state).flat() as any[];
          const host = all.find((p) => p?.is_host);
          const hostView = host?.view;
          if (!isHost && (hostView === 'lobby' || hostView === 'payments')) {
            setView(hostView);
          }
        } catch {}
      })
      // Broadcast: cambio inmediato de vista por parte del host
      .on('broadcast', { event: 'host_view' }, (payload: any) => {
        if (!mounted) return;
        const nextView = payload?.payload?.view;
        if (!isHostRef.current && (nextView === 'lobby' || nextView === 'payments')) {
          setView(nextView);
        }
      })
      // ✅ Paranoico: cualquier cambio en jugadores => recargar lista completa
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gofish_players', filter: `room_code=eq.${roomCode}` }, () => {
        if (!mounted) return;
        console.log('🔔 [GoFish] Cambio en jugadores -> Recargando lista');
        fetchPlayers();
      })
      // ✅ Paranoico: cualquier cambio en sala => actualizar roomData y detectar playing
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gofish_rooms', filter: `room_code=eq.${roomCode}` }, (payload: any) => {
        if (!mounted) return;
        setRoomData(payload.new);
        // Refuerzo: re-fetch por consistencia (RLS/payload parcial)
        fetchRoomData();
        // Si el host cambió el estado a 'playing', avisamos al padre
        if (payload?.new?.game_phase === 'playing') {
           onGameStart();
        }
      })
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          // Track inicial de presence
          try {
            channel.track?.({ user_id: myId, is_host: isHostRef.current, view: viewRef.current });
          } catch {}
        }
      });

    channelRef.current = channel;

    return () => {
      mounted = false;
      subscribedRef.current = false;
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomCode, user?.id, onGameStart]);

  // Mantener presence actualizado (host/view) para que los late-joiners sigan al host automáticamente
  useEffect(() => {
    if (!channelRef.current) return;
    if (!subscribedRef.current) return;
    try {
      viewRef.current = view;
      isHostRef.current = isHost;
      channelRef.current.track?.({ user_id: myId, is_host: isHostRef.current, view: viewRef.current });
    } catch {}
  }, [myId, isHost, view]);

  // 🔍 DEBUG: Log del estado crítico para debugging
  useEffect(() => {
    console.log('🎣 [GoFish] Estado del componente (render):', {
      isHost,
      myId,
      hostId: roomData?.host_id,
      playersCount: players.length,
      allPaid,
      players: players.map(p => ({ user_id: p.user_id, username: p.username, has_paid: p.has_paid })),
      starting,
      roomCode
    });
  }, [isHost, myId, roomData?.host_id, players.length, allPaid, starting, roomCode]);

  const fetchRoomData = async () => {
    const { data } = await supabase.from('gofish_rooms').select('*').eq('room_code', roomCode).single();
    if (data) setRoomData(data);
    if (data?.game_phase === 'playing') onGameStart();
  };

  const fetchPlayers = async () => {
    // ✅ MANUAL JOIN PATTERN (3 pasos): gofish_players -> profiles -> merge JS
    try {
      const rc = String(roomCode ?? '').trim();
      if (!rc) {
        setPlayers([]);
        return;
      }

      // 1) Fetch 1: datos crudos de gofish_players
      const { data: rawPlayers, error: playersError } = await supabase
        .from('gofish_players')
        .select('*')
        .eq('room_code', rc);

      if (playersError) {
        console.error('[GoFish] fetchPlayers: error leyendo gofish_players', playersError);
        setPlayers([]);
        return;
      }

      const rows = Array.isArray(rawPlayers) ? rawPlayers : [];
      if (rows.length === 0) {
        setPlayers([]);
        return;
      }

      // 2) Fetch 2: traer perfiles de esos user_id (si falla, seguimos con fallback)
      const userIds = Array.from(
        new Set(
          rows
            .map((p: any) => String(p?.user_id ?? '').trim())
            .filter((id) => id.length > 0)
        )
      );

      let profMap = new Map<string, { username?: string; avatar_url?: string | null }>();

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        if (profilesError) {
          console.error('[GoFish] fetchPlayers: error leyendo profiles', profilesError);
        } else if (Array.isArray(profilesData)) {
          for (const r of profilesData) {
            const pid = String((r as any)?.id ?? '').trim();
            if (!pid) continue;
            profMap.set(pid, { username: (r as any)?.username, avatar_url: null });
          }
        }

        // Cache de perfiles para Realtime (evita re-fetch). Aunque no haya data, no rompemos.
        if (profMap.size > 0) {
          setProfilesById((prev) => {
            const next = { ...prev };
            for (const [id, v] of profMap.entries()) next[id] = v;
            return next;
          });
          profilesRef.current = (() => {
            const next = { ...(profilesRef.current || {}) };
            for (const [id, v] of profMap.entries()) next[id] = v;
            return next;
          })();
        }
      }

      // 3) Merge: combinar players + username (fallback "Forastero")
      const formatted = rows.map((p: any) => {
        const uid = String(p?.user_id ?? '').trim();
        const prof = uid ? profMap.get(uid) : undefined;
        return {
          ...p,
          user_id: uid,
          has_paid: !!p?.has_paid,
          username: prof?.username || 'Forastero',
          avatar_url: (profilesRef.current?.[uid]?.avatar_url ?? null)
        };
      });

      setPlayers(formatted);
    } catch (e) {
      console.error('[GoFish] fetchPlayers: excepción', e);
      setPlayers([]);
    }
  };

  const fetchMyBalance = async () => {
    const { data } = await supabase.from('profiles').select('global_balance').eq('id', user.id).single();
    if (data) setMyBalance(data.global_balance);
  };

  // 2. Lógica de Pago (Misma que Lotería/Dados)
  const handlePayEntry = async () => {
    if (!roomData?.id) return;
    setErrorMsg(null);
    setLoadingPay(true);
    const amount = entryFee > 0 ? entryFee : 50; // fallback visual
    try {
      // ✅ RPC con múltiples firmas (como Lotería/Dados) porque tu SQL puede usar nombres distintos
      const candidates = [String(roomData.id), String(roomCode)].filter(Boolean);

      let lastErr: any = null;
      let ok = false;

      const tryRpc = async (label: string, params: any) => {
        const { error } = await supabase.rpc('pay_game_entry', params as any);
        if (error) console.warn('[GoFish] pay_game_entry intento falló:', label, params, error);
        return error;
      };

      // Intento #1: firma "universal" (room_id_param)
      for (const roomIdParam of candidates) {
        const error = await tryRpc('universal(room_id_param)', {
          user_id_param: user.id,
          room_table_name: 'gofish_rooms',
          room_id_param: roomIdParam,
          amount
        });
        if (!error) { ok = true; lastErr = null; break; }
        lastErr = error;
      }

      // Intento #2: alt(p_room_code)
      if (!ok) {
        const error = await tryRpc('alt(p_room_code)', {
          user_id_param: user.id,
          room_table_name: 'gofish_rooms',
          p_room_code: roomCode,
          amount
        });
        if (!error) { ok = true; lastErr = null; }
        else lastErr = error;
      }

      // Intento #3: alt(p_*)
      if (!ok) {
        const error = await tryRpc('alt(p_*)', {
          p_user_id: user.id,
          p_room_code: roomCode,
          p_room_table_name: 'gofish_rooms',
          p_amount: amount
        });
        if (!error) { ok = true; lastErr = null; }
        else lastErr = error;
      }

      if (!ok) {
        const msg = (lastErr as any)?.message || 'No se pudo pagar la entrada (revisa consola).';
        throw new Error(msg);
      }

      // Marcamos pagado en la tabla de jugadores (como en Lotería)
      const { error: paidError } = await supabase
        .from('gofish_players')
        .update({ has_paid: true })
        .eq('room_code', roomCode)
        .eq('user_id', user.id);
      if (paidError) console.warn('No se pudo marcar has_paid:', paidError);

      // Refrescamos balance localmente para feedback inmediato
      setMyBalance(prev => prev - amount);
      // ✅ Optimistic UI (verde inmediato)
      setPlayers(prev => prev.map(p => String(p?.user_id ?? '').trim() === String(user?.id ?? '').trim()
        ? ({ ...p, has_paid: true })
        : p
      ));
      fetchPlayers();
    } catch (e: any) {
      console.error('[GoFish] Error al pagar:', e);
      setErrorMsg('Error al pagar: ' + (e?.message || 'Error desconocido'));
    } finally {
      setLoadingPay(false);
    }
  };

  // 3. Lógica de Iniciar (Solo Host)
  const handleStartGame = async () => {
    console.log('🎣 [GoFish] handleStartGame: CLICK DETECTADO');
    console.log('🎣 [GoFish] Estado actual:', {
      isHost,
      myId,
      hostId: roomData?.host_id,
      playersCount: players.length,
      players: players.map(p => ({ user_id: p.user_id, username: p.username, has_paid: p.has_paid })),
      allPaid,
      starting
    });

    // Validación 1: Verificar que soy el host
    if (!isHost) {
      console.warn('🎣 [GoFish] handleStartGame: BLOQUEADO - No soy el host', { myId, hostId: roomData?.host_id });
      setErrorMsg('Solo el host puede iniciar la partida.');
      return;
    }

    setErrorMsg(null);

    // Validación 2: Verificar que todos pagaron
    const unpaid = players.some(p => !p.has_paid);
    if (unpaid) {
      const unpaidList = players.filter(p => !p.has_paid).map(p => p.username || p.user_id);
      console.warn('🎣 [GoFish] handleStartGame: BLOQUEADO - Jugadores sin pagar:', unpaidList);
      setErrorMsg("¡Espera vaquero! Todos deben pagar la entrada antes de jugar.");
      return;
    }

    // Validación 3: Verificar mínimo de jugadores
    if (players.length < 2) {
      console.warn('🎣 [GoFish] handleStartGame: BLOQUEADO - Menos de 2 jugadores:', players.length);
      setErrorMsg('Necesitas al menos 2 jugadores para iniciar.');
      return;
    }

    // ✅ TODAS LAS VALIDACIONES PASARON - Proceder con el RPC
    console.log('🎣 [GoFish] handleStartGame: TODAS LAS VALIDACIONES OK - Llamando RPC start_gofish_game');
    setStarting(true);

    try {
      // Llamar al RPC start_gofish_game (como el usuario especificó)
      const { data, error } = await supabase.rpc('start_gofish_game', {
        p_room_code: roomCode
      });

      console.log('🎣 [GoFish] handleStartGame: Respuesta del RPC:', { data, error });

      if (error) {
        console.error('🎣 [GoFish] handleStartGame: ERROR en RPC:', error);
        setErrorMsg("Error al iniciar: " + (error?.message || 'Error desconocido'));
        // Fallback: intentar update directo si el RPC falla
        console.log('🎣 [GoFish] handleStartGame: Intentando fallback (update directo)');
        const { error: updateError } = await supabase
          .from('gofish_rooms')
          .update({ game_phase: 'playing' })
          .eq('room_code', roomCode);
        if (updateError) {
          console.error('🎣 [GoFish] handleStartGame: Fallback también falló:', updateError);
        } else {
          console.log('🎣 [GoFish] handleStartGame: Fallback exitoso');
        }
      } else if (data && data.success === false) {
        console.error('🎣 [GoFish] handleStartGame: RPC retornó success=false:', data);
        setErrorMsg(data.error || 'Error al iniciar el juego');
      } else {
        console.log('🎣 [GoFish] handleStartGame: ✅ ÉXITO - Juego iniciado');
        // El cambio de fase se propagará por realtime y onGameStart se llamará
      }
    } catch (e: any) {
      console.error('🎣 [GoFish] handleStartGame: EXCEPCIÓN:', e);
      setErrorMsg('Error inesperado: ' + (e?.message || 'Error desconocido'));
    } finally {
      setStarting(false);
    }
  };

  if (!roomData) return <div className="text-white text-center p-10 animate-pulse">Buscando la mesa...</div>;

  // Sincroniza vista: si ya empezó el juego, el padre se encarga. Si hay fee, sugerimos pagos.
  const canPay = (entryFee > 0 ? entryFee : 50);
  const hasEnough = myBalance >= canPay;

  return (
    <>
      {view === 'payments' ? (
        // ✅ PAGO: clon del póster WANTED (Lotería)
        <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] text-center z-10 w-full min-h-[100dvh] bg-[#2d1b15] relative overflow-y-auto">
          <WesternDecor variant="corners" className="opacity-30" />

          <button
            onClick={() => router.push('/gofish')}
            className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
          >
            🚪 Abandonar
          </button>

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
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#3e2723] shadow-md z-20 border border-[#5d4037]" />

            <div className="flex items-center justify-between mb-2">
              <button
                onClick={goLobby}
                className="text-[#5d4037] underline font-rye text-xs"
              >
                ← Sala de espera
              </button>
              <div className="text-[#5d4037] text-[10px] uppercase tracking-widest font-bold">
                Mesa {roomCode}
              </div>
            </div>

            <h2 className="font-rye text-4xl sm:text-5xl text-[#3e2723] mb-2 uppercase border-b-4 border-[#3e2723] pb-2 tracking-widest">
              SE BUSCA
            </h2>

            <div className="my-6">
              <p className="font-rye text-xl text-[#5d4037] mb-2">Entrada a la Mesa</p>
              <div className="text-6xl font-rye text-[#8b1a1a] animate-pulse">
                ${effectiveFee}
              </div>
              <p className="text-[#5d4037] text-[10px] uppercase tracking-widest mt-2 font-bold">
                Paga para entrar a jugar Go Fish
              </p>
            </div>

            <div className="mb-4 bg-[#3e2723]/10 border border-[#3e2723]/30 rounded p-3">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#3e2723]">Banco</div>
              <div className="font-rye text-2xl text-[#3e2723]">Banco: ${myBalance?.toLocaleString?.() ?? '...'}</div>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-red-900/30 border border-red-700 text-red-900 rounded p-3 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            {/* Estado de Pago Personal */}
            {!amIPaid ? (
              <div className="mb-6">
                <button
                  onClick={handlePayEntry}
                  disabled={loadingPay || !hasEnough}
                  className={`w-full font-rye text-2xl py-4 rounded border-2 shadow-lg uppercase tracking-wider transition-all ${
                    !hasEnough
                      ? 'bg-[#a1887f] text-[#d7ccc8] border-[#8d6e63] cursor-not-allowed grayscale'
                      : 'bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] border-[#ff6f00] animate-bounce'
                  }`}
                >
                  {loadingPay ? 'Procesando...' : !hasEnough ? 'Fondos insuficientes' : '💰 PAGAR AHORA'}
                </button>
              </div>
            ) : (
              <div className="bg-[#2e7d32] text-white font-rye text-xl py-3 rounded border-2 border-[#1b5e20] mb-6 shadow-inner flex items-center justify-center gap-2">
                <span>✅</span> PAGADO
              </div>
            )}

            {/* Estado de la Mesa */}
            <div className="bg-[#3e2723]/10 p-4 rounded border border-[#3e2723]/30">
              <h3 className="font-rye text-[#3e2723] text-sm mb-3 uppercase">Estado de la Mesa</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.map((p) => (
                  <div
                    key={p.user_id}
                    className={`px-2 py-1 rounded border text-xs font-bold flex items-center gap-1 ${
                      p.has_paid ? 'bg-[#2e7d32] text-white border-[#1b5e20]' : 'bg-[#c62828] text-white border-[#b71c1c] opacity-80'
                    }`}
                  >
                    {p.has_paid ? '✓' : '✗'} {p.username}
                  </div>
                ))}
              </div>
            </div>

            {/* Controles Host */}
            {isHost && (
              <div className="mt-6 pt-4 border-t-2 border-[#3e2723] border-dashed">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🎣 [GoFish] Botón clickeado - Estado del botón:', {
                      allPaid,
                      starting,
                      disabled: !allPaid || starting,
                      playersCount: players.length,
                      playersPaid: players.filter(p => p.has_paid).length
                    });
                    if (!allPaid || starting) {
                      console.warn('🎣 [GoFish] Botón está deshabilitado, no ejecutando handleStartGame');
                      return;
                    }
                    handleStartGame();
                  }}
                  disabled={!allPaid || starting}
                  className={`w-full font-rye text-xl py-3 rounded border-2 shadow-lg uppercase transition-all ${
                    allPaid && !starting
                      ? 'bg-[#3e2723] text-[#ffb300] border-[#5d4037] hover:scale-105 cursor-pointer'
                      : 'bg-[#a1887f] text-[#d7ccc8] border-[#8d6e63] cursor-not-allowed grayscale'
                  }`}
                >
                  {starting ? 'Iniciando...' : allPaid ? '🃏 REPARTIR CARTAS' : '⏳ Esperando Pagos...'}
                </button>
                {!allPaid && (
                  <p className="text-[10px] text-[#5d4037] mt-2 font-mono">
                    Todos deben pagar para iniciar. ({players.filter(p => p.has_paid).length}/{players.length} pagaron)
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        // ✅ LOBBY: clon del tablón (Dados/Lotería)
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full min-h-screen bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-[#2d1b15] relative overflow-hidden">
          <WesternDecor variant="corners" className="opacity-30" />

          <button
            onClick={() => router.push('/gofish')}
            className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
          >
            🚪 Abandonar
          </button>

          <div className="bg-[#3e2723] p-8 md:p-12 rounded-sm border-[8px] border-[#5d4037] shadow-[20px_20px_0px_rgba(0,0,0,0.5)] w-full max-w-lg relative animate-in zoom-in duration-300">
            {/* Clavos decorativos */}
            <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner" />
            <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner" />
            <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner" />
            <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner" />

            <h1 className="font-rye text-5xl md:text-6xl text-[#ffb300] mb-2 drop-shadow-[4px_4px_0px_#000]">
              GO FISH
            </h1>
            <p className="text-[#a1887f] uppercase tracking-[0.4em] text-xs mb-8 font-sans border-b border-[#5d4037] pb-4">
              Sala de Espera
            </p>

            <div className="mb-6 bg-[#2d1b15] border border-[#5d4037] rounded p-3 shadow-inner">
              <div className="text-[#a1887f] text-[10px] uppercase tracking-widest">Banco</div>
              <div className="font-rye text-[#ffb300] text-2xl">Banco: ${myBalance?.toLocaleString?.() ?? '...'}</div>
            </div>

            {/* CÓDIGO */}
            <div
              onClick={copyCode}
              className="cursor-pointer bg-[#1a100e] p-6 rounded border-2 border-[#ffb300]/30 mb-8 hover:bg-black transition group relative shadow-inner"
            >
              <p className="text-[#a1887f] text-[10px] uppercase tracking-widest mb-2 font-sans">Código de la Mesa</p>
              <h2 className="font-rye text-6xl md:text-7xl text-[#ffecb3] tracking-widest drop-shadow-lg group-hover:scale-110 transition-transform">
                {roomCode}
              </h2>
              <div className="absolute bottom-2 right-2 text-[#ffb300] text-xs opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                {copied ? '¡COPIADO!' : 'COPIAR'}
              </div>
            </div>

            {/* CONFIGURACIÓN DE APUESTA (Host Control) - Clon de Dados/Lotería */}
            <div className="bg-[#4e342e] p-4 rounded mb-6 border-2 border-[#6d4c41] shadow-lg">
              <div className="flex flex-col gap-2">
                <span className="text-[#d7ccc8] text-xs uppercase tracking-widest font-bold border-b border-[#8d6e63] pb-1">
                  Apuesta de Entrada
                </span>

                {isHost ? (
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <button
                      onClick={() => updateEntryFee(effectiveFee - 10)}
                      className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-xl"
                      title="Bajar apuesta (-10)"
                    >
                      -
                    </button>
                    <span className="font-rye text-4xl text-[#4caf50] min-w-[120px] text-center drop-shadow-md bg-black/20 rounded px-2">
                      $ {effectiveFee}
                    </span>
                    <button
                      onClick={() => updateEntryFee(effectiveFee + 10)}
                      className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-xl"
                      title="Subir apuesta (+10)"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div className="font-rye text-4xl text-[#4caf50] drop-shadow-md mt-2">
                    $ {effectiveFee}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-[#8d6e63]/40 flex items-center justify-between">
                <span className="text-[#d7ccc8] text-xs uppercase tracking-widest font-bold">Banco</span>
                <span className="font-rye text-lg text-[#81c784]">Banco: ${myBalance?.toLocaleString?.() ?? '...'}</span>
              </div>
            </div>

            {/* Jugadores */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-2 px-1">
                <span className="text-[#a1887f] text-xs uppercase tracking-widest">Jugadores ({players.length})</span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 bg-[#2d1b15]/50 p-2 rounded border border-[#5d4037]">
                {players.map((p) => (
                  <div
                    key={p.user_id}
                    className="flex justify-between items-center bg-[#2d1b15] px-4 py-3 rounded border border-[#4e342e] shadow-sm group hover:border-[#ffb300]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-[#3e2723] rounded-full flex items-center justify-center border border-[#5d4037] overflow-hidden">
                        {p.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">🎣</span>
                        )}
                      </div>
                      <span className="font-rye text-lg text-[#d7ccc8] truncate max-w-[160px]">
                        {p.username}
                      </span>
                      {String(roomData?.host_id ?? '').trim() === String(p.user_id ?? '').trim() && (
                        <span className="text-[10px] bg-[#ffb300] text-black px-1 rounded font-bold">HOST</span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] px-2 py-1 rounded border font-bold ${
                        p.has_paid ? 'bg-[#2e7d32] text-white border-[#1b5e20]' : 'bg-[#c62828]/60 text-white border-[#b71c1c]'
                      }`}
                    >
                      {p.has_paid ? 'LISTO' : 'PENDIENTE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            {/* Botón acción */}
            {isHost ? (
              <motion.button
                onClick={openPayments}
                disabled={players.length < 2}
                whileHover={{ scale: players.length < 2 ? 1 : 1.02 }}
                whileTap={{ scale: players.length < 2 ? 1 : 0.98 }}
                className="w-full bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye text-2xl py-5 rounded border-b-[6px] border-[#ff6f00] active:border-b-0 active:translate-y-1 transition-all shadow-xl uppercase tracking-wider flex flex-col items-center leading-none gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>ABRIR MESA DE PAGOS</span>
                <span className="text-[10px] font-sans font-bold opacity-70 tracking-[0.2em] font-normal">
                  Entrada: ${entryFee || 50}
                </span>
              </motion.button>
            ) : (
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-full bg-black/20 border-2 border-dashed border-[#5d4037] p-4 rounded text-[#a1887f] font-rye text-lg"
              >
                Esperando al Host...
              </motion.div>
            )}
          </div>
        </div>
      )}
    </>
  );
}