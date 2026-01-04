'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface GameSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gameType: 'DICE' | 'LOTERIA') => void;
}

export const GameSelectorModal = ({ isOpen, onClose, onSelect }: GameSelectorModalProps) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 20 }}
          className="bg-[#3e2723] border-[6px] border-[#ffb300] rounded-lg shadow-2xl max-w-md w-full p-8 relative wood-texture"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Clavos decorativos */}
          <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
          <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>

          <h2 className="text-3xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase">
            ¿A qué jugaremos, forastero?
          </h2>

          <div className="space-y-4">
            {/* Opción A: Dados Mentirosos */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onSelect('DICE');
                onClose();
              }}
              className="w-full bg-[#4e342e] hover:bg-[#5d4037] border-2 border-[#6d4c41] hover:border-[#ffb300] rounded-lg p-6 transition-all shadow-lg"
            >
              <div className="flex flex-col items-center gap-3">
                <span className="text-5xl">🎲</span>
                <span className="text-xl font-rye font-bold text-[#ffb300] uppercase">
                  Dados Mentirosos
                </span>
                <p className="text-sm text-[#d7ccc8]">
                  El clásico juego de apuestas y bluffs
                </p>
              </div>
            </motion.button>

            {/* Opción B: Lotería Mexicana */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onSelect('LOTERIA');
                onClose();
              }}
              className="w-full bg-[#4e342e] hover:bg-[#5d4037] border-2 border-[#6d4c41] hover:border-[#ffb300] rounded-lg p-6 transition-all shadow-lg"
            >
              <div className="flex flex-col items-center gap-3">
                <span className="text-5xl">🃏</span>
                <span className="text-xl font-rye font-bold text-[#ffb300] uppercase">
                  Lotería Mexicana
                </span>
                <p className="text-sm text-[#d7ccc8]">
                  El tradicional juego de cartas
                </p>
              </div>
            </motion.button>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full bg-[#5d4037] hover:bg-[#6d4c41] text-[#d7ccc8] font-rye font-bold py-3 rounded border-2 border-[#8d6e63] transition-colors uppercase text-sm"
          >
            Cancelar
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

