'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WinPattern, PATTERN_NAMES } from '../utils/validation';

const ALL_PATTERNS: WinPattern[] = ['linea', 'diagonal', 'cuadro', 'esquinas', 'centro', 'llenas'];

export type LoteriaSpeedPreset = 'lento' | 'normal' | 'rapido';

export interface LoteriaSettingsValue {
  speedMs: number;
  enabledPatterns: WinPattern[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: LoteriaSettingsValue) => Promise<void> | void;
  isHost: boolean;
  initialSpeedMs: number;
  initialEnabledPatterns?: WinPattern[] | null;
}

export const LoteriaSettingsModal = ({
  isOpen,
  onClose,
  onSave,
  isHost,
  initialSpeedMs,
  initialEnabledPatterns
}: Props) => {
  const [speedMs, setSpeedMs] = useState<number>(initialSpeedMs);
  const [enabled, setEnabled] = useState<WinPattern[]>(
    Array.isArray(initialEnabledPatterns) && initialEnabledPatterns.length > 0
      ? initialEnabledPatterns
      : ALL_PATTERNS
  );

  useEffect(() => {
    if (!isOpen) return;
    setSpeedMs(initialSpeedMs);
    setEnabled(
      Array.isArray(initialEnabledPatterns) && initialEnabledPatterns.length > 0
        ? initialEnabledPatterns
        : ALL_PATTERNS
    );
  }, [isOpen, initialSpeedMs, initialEnabledPatterns]);

  const toggle = (p: WinPattern) => {
    setEnabled(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const preset = (ms: number) => setSpeedMs(ms);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="bg-[#3e2723] border-[6px] border-[#ffb300] rounded-lg shadow-2xl max-w-md w-full p-6 relative wood-texture"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-rye font-bold text-[#ffb300] mb-4 text-center uppercase">
              ⚙️ Ajustes
            </h2>
            {!isHost && (
              <p className="text-center text-[#a1887f] text-[11px] font-mono mb-4">
                Solo el host puede cambiar y guardar estos ajustes.
              </p>
            )}

            <div className="bg-[#2d1b15] border-2 border-[#5d4037] rounded p-4 mb-4">
              <div className="text-[#a1887f] text-xs uppercase tracking-widest font-bold mb-2">
                Velocidad de la Baraja
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => isHost && preset(8000)}
                  disabled={!isHost}
                  className={`px-3 py-2 rounded border-2 font-rye text-sm transition-all ${
                    speedMs >= 7000 ? 'bg-[#ffb300] text-[#3e2723] border-[#ff6f00]' : 'bg-[#4e342e] text-[#d7ccc8] border-[#6d4c41]'
                  } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  🐢 Lento
                </button>
                <button
                  onClick={() => isHost && preset(5000)}
                  disabled={!isHost}
                  className={`px-3 py-2 rounded border-2 font-rye text-sm transition-all ${
                    speedMs >= 4000 && speedMs < 7000 ? 'bg-[#ffb300] text-[#3e2723] border-[#ff6f00]' : 'bg-[#4e342e] text-[#d7ccc8] border-[#6d4c41]'
                  } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  🐇 Normal
                </button>
                <button
                  onClick={() => isHost && preset(3000)}
                  disabled={!isHost}
                  className={`px-3 py-2 rounded border-2 font-rye text-sm transition-all ${
                    speedMs < 4000 ? 'bg-[#ffb300] text-[#3e2723] border-[#ff6f00]' : 'bg-[#4e342e] text-[#d7ccc8] border-[#6d4c41]'
                  } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  ⚡ Rápido
                </button>
              </div>
            </div>

            <div className="bg-[#2d1b15] border-2 border-[#5d4037] rounded p-4">
              <div className="text-[#a1887f] text-xs uppercase tracking-widest font-bold mb-2">
                Metas habilitadas
              </div>
              <div className="space-y-2">
                {ALL_PATTERNS.map((p) => {
                  const checked = enabled.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => isHost && toggle(p)}
                      disabled={!isHost}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded border-2 text-left transition-all ${
                        checked ? 'bg-[#4caf50]/20 border-[#4caf50] text-[#d7ccc8]' : 'bg-[#4e342e] border-[#6d4c41] text-[#d7ccc8]/80'
                      } ${!isHost ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="font-rye">{PATTERN_NAMES[p]}</span>
                      <span className="font-mono text-xs">{checked ? 'ON' : 'OFF'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[#a1887f] text-[10px] mt-3 font-mono">
                Tip: desactiva metas para partidas más rápidas.
              </p>
            </div>

            <div className="mt-5">
              {isHost ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onClose}
                    className="bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-colors uppercase text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => onSave({ speedMs, enabledPatterns: enabled })}
                    className="bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-3 rounded border-2 border-[#ff6f00] transition-colors uppercase text-sm"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-colors uppercase text-sm"
                >
                  Cerrar
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


