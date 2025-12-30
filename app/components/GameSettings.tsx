'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface GameSettingsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export const GameSettings = ({ 
  zoomLevel, 
  onZoomIn, 
  onZoomOut, 
  onResetZoom 
}: GameSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botón de Settings */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed top-4 left-4 z-50 w-12 h-12 bg-[#3e2723] text-[#ffb300] rounded-full border-2 border-[#5d4037] flex items-center justify-center text-2xl shadow-xl hover:bg-[#4e342e] transition-colors"
        title="Configuración"
      >
        ⚙️
      </motion.button>

      {/* Panel de Settings */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-[100]"
            />
            
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -20, y: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20, y: -20 }}
              transition={{ type: "spring", damping: 20 }}
              className="fixed top-16 left-4 z-[101] bg-[#3e2723] border-4 border-[#5d4037] rounded-lg shadow-2xl p-4 min-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Textura de madera */}
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] pointer-events-none rounded-lg"></div>
              
              {/* Clavos decorativos */}
              <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-black/40"></div>
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-black/40"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 border-b border-[#5d4037] pb-2">
                  <h3 className="font-rye text-[#ffb300] text-lg">CONFIGURACIÓN</h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-[#d7ccc8] hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>

                {/* Controles de Zoom */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[#d7ccc8] text-xs uppercase tracking-wider font-sans mb-2 block">
                      Zoom: {Math.round(zoomLevel * 100)}%
                    </label>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={onZoomOut}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-1 bg-[#2d1b15] text-[#ffb300] py-2 rounded border-2 border-[#5d4037] hover:bg-[#3e2723] transition-colors font-rye text-xl"
                      >
                        −
                      </motion.button>
                      <motion.button
                        onClick={onZoomIn}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="flex-1 bg-[#2d1b15] text-[#ffb300] py-2 rounded border-2 border-[#5d4037] hover:bg-[#3e2723] transition-colors font-rye text-xl"
                      >
                        +
                      </motion.button>
                    </div>
                    {zoomLevel !== 1 && (
                      <motion.button
                        onClick={onResetZoom}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full mt-2 bg-[#ffb300] text-[#3e2723] py-1.5 rounded border-2 border-[#ff6f00] hover:bg-[#ffca28] transition-colors font-rye text-sm"
                      >
                        Resetear
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

