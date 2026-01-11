'use client';

import { useEffect, useState } from "react";
import { motion } from 'framer-motion';
import { WesternDecor } from '@/app/components/WesternDecor';
import { supabase } from "@/app/lib/supabase";
import { LoteriaSettingsModal } from './LoteriaSettingsModal';
import { WinPattern } from '../utils/validation';

type Player = { user_id: string; name: string; is_host?: boolean };

interface LoteriaLobbyProps {
  code: string;
  players: Player[];
  myId?: string;
  isHost: boolean;
  onStart: () => void; // Legacy direct start
  onAbandon?: () => void;
  onUpdateFee?: (fee: number) => void; // NUEVO
  suggestedFee?: number;
  enabledPatterns?: WinPattern[] | null;
  gameSpeedMs?: number | null;
}

export const LoteriaLobby = ({ code, players, myId, isHost, onStart, onAbandon, onUpdateFee, suggestedFee = 50, enabledPatterns = null, gameSpeedMs = null }: LoteriaLobbyProps) => {
  const [copied, setCopied] = useState(false);
  const [feeInput, setFeeInput] = useState(suggestedFee); // Apuesta sugerida
  const [bank, setBank] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Apuesta personal (cada quien decide) - se guarda para usarse en la pantalla de Pago
  const storageKey = myId ? `loteria_bet_${myId}` : null;
  const [myBet, setMyBet] = useState<number>(() => {
    if (typeof window === 'undefined') return suggestedFee || 50;
    try {
      const raw = storageKey ? window.localStorage.getItem(storageKey) : null;
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : (suggestedFee || 50);
    } catch {
      return suggestedFee || 50;
    }
  });

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, String(myBet));
    } catch {}
  }, [storageKey, myBet]);

  useEffect(() => {
    // Si el host definió sugerencia desde afuera (props), mantenerlo sincronizado aunque ya no mostremos el control redundante.
    setFeeInput(suggestedFee);
  }, [suggestedFee]);

  const handleOpenTable = () => {
    if (onUpdateFee) {
        // Actualiza sugerencia y abre la fase de pago (entry_fee > 0)
        onUpdateFee(Math.max(10, feeInput));
    } else {
        onStart();
    }
  };

  const handleSaveSettings = async (value: { speedMs: number; enabledPatterns: WinPattern[] }) => {
    if (!isHost) return;
    setSettingsError(null);
    // Guardar en BD (si las columnas existen). Si no existen, mostramos el error para que agregues columnas.
    const { error } = await supabase
      .from('loteria_rooms')
      .update({ game_speed_ms: value.speedMs, enabled_patterns: value.enabledPatterns } as any)
      .eq('room_code', code);
    if (error) {
      setSettingsError(error.message || 'No se pudieron guardar ajustes.');
      return;
    }
    setShowSettings(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full min-h-screen bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-[#2d1b15] relative overflow-hidden">
      <WesternDecor variant="corners" className="opacity-30" />
      
      {/* Botón Abandonar (Esquina superior izquierda) */}
      {onAbandon && (
        <button
          onClick={onAbandon}
          className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
        >
          🚪 Abandonar
        </button>
      )}
      
      {/* TABLÓN PRINCIPAL DE MADERA */}
      <div className="bg-[#3e2723] p-8 md:p-12 rounded-sm border-[8px] border-[#5d4037] shadow-[20px_20px_0px_rgba(0,0,0,0.5)] w-full max-w-lg relative animate-in zoom-in duration-300">
        
        {/* Clavos decorativos */}
        <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
        <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
        <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>

        <h1 className="font-rye text-5xl md:text-6xl text-[#ffb300] mb-2 drop-shadow-[4px_4px_0px_#000]">LOTERÍA</h1>
        <p className="text-[#a1887f] uppercase tracking-[0.4em] text-xs mb-8 font-sans border-b border-[#5d4037] pb-4">Sala de Espera</p>

        <div className="mb-6 bg-[#2d1b15] border border-[#5d4037] rounded p-3 shadow-inner">
          <div className="text-[#a1887f] text-[10px] uppercase tracking-widest">Banco</div>
          <div className="font-rye text-[#ffb300] text-2xl">Banco: ${bank?.toLocaleString?.() ?? '...'}</div>
        </div>

        {/* CÓDIGO DE SALA */}
        <div 
          onClick={copyCode}
          className="cursor-pointer bg-[#1a100e] p-6 rounded border-2 border-[#ffb300]/30 mb-8 hover:bg-black transition group relative shadow-inner"
        >
          <p className="text-[#a1887f] text-[10px] uppercase tracking-widest mb-2 font-sans">Código de la Mesa</p>
          <h2 className="font-rye text-6xl md:text-7xl text-[#ffecb3] tracking-widest drop-shadow-lg group-hover:scale-110 transition-transform">{code}</h2>
          <div className="absolute bottom-2 right-2 text-[#ffb300] text-xs opacity-0 group-hover:opacity-100 transition-opacity font-bold">
            {copied ? '¡COPIADO!' : 'COPIAR'}
          </div>
        </div>

        {/* LISTA DE JUGADORES */}
        <div className="mb-8">
          <div className="flex justify-between items-end mb-2 px-1">
            <span className="text-[#a1887f] text-xs uppercase tracking-widest">Jugadores ({players.length})</span>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 bg-[#2d1b15]/50 p-2 rounded border border-[#5d4037]">
            {players.map((p) => (
              <div key={p.user_id} className="flex justify-between items-center bg-[#2d1b15] px-4 py-3 rounded border border-[#4e342e] shadow-sm group hover:border-[#ffb300]/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#3e2723] rounded-full flex items-center justify-center border border-[#5d4037]">🃏</div>
                  <span className="font-rye text-lg text-[#d7ccc8] truncate max-w-[120px]">{p.name}</span>
                  {p.is_host && <span className="text-[10px] bg-[#ffb300] text-black px-1 rounded font-bold">HOST</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* APUESTA (SUGERIDA) */}
        <div className="bg-[#4e342e] p-4 rounded mb-6 border-2 border-[#6d4c41] shadow-lg">
          <div className="flex flex-col gap-2">
            <span className="text-[#d7ccc8] text-xs uppercase tracking-widest font-bold border-b border-[#8d6e63] pb-2">
              TU APUESTA
            </span>

            {/* Apuesta personal */}
            <div className="mt-3 bg-[#2d1b15] border border-[#5d4037] rounded p-4 shadow-inner">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={() => setMyBet(v => Math.max(10, v - 10))}
                  className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-2xl"
                >
                  -
                </button>
                <div className="font-rye text-4xl sm:text-5xl text-[#4caf50] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] bg-black/20 rounded px-4 py-2 min-w-[170px] text-center">
                  $ {myBet}
                </div>
                <button
                  onClick={() => setMyBet(v => v + 10)}
                  className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-2xl"
                >
                  +
                </button>
              </div>
              {bank !== null && myBet > bank && (
                <p className="text-red-300 text-[10px] font-mono mt-1">
                  No alcanza tu banco para esa apuesta.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Botón Ajustes */}
        <motion.button
          onClick={() => setShowSettings(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-colors uppercase text-sm flex items-center justify-center gap-2 mb-4"
        >
          <span className="text-lg">⚙️</span>
          <span>Ajustes</span>
        </motion.button>

        {settingsError && (
          <div className="mb-4 bg-red-900/40 border border-red-700 text-red-200 rounded p-3 text-xs font-mono">
            {settingsError}
          </div>
        )}

        {/* BOTÓN DE ACCIÓN DEL HOST */}
        {isHost ? (
          <motion.button 
            onClick={handleOpenTable}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye text-2xl py-5 rounded border-b-[6px] border-[#ff6f00] active:border-b-0 active:translate-y-1 transition-all shadow-xl uppercase tracking-wider flex flex-col items-center leading-none gap-1"
          >
            <span>{feeInput > 0 ? 'ABRIR MESA DE PAGOS' : 'COMENZAR JUEGO'}</span>
            <span className="text-[10px] font-sans font-bold opacity-70 tracking-[0.2em] font-normal">
                {feeInput > 0 ? `Entrada: $${feeInput}` : 'Juego Libre'}
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

      {/* Modal Ajustes (visible para todos; solo host puede editar/guardar) */}
      <LoteriaSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        isHost={isHost}
        initialSpeedMs={gameSpeedMs || 5000}
        initialEnabledPatterns={enabledPatterns}
      />
    </div>
  );
};

