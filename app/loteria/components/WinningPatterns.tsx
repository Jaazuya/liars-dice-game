'use client';

import { motion } from 'framer-motion';

export const WinningPatterns = () => {
  const patterns = [
    { icon: '━', name: 'Línea Horizontal' },
    { icon: '┏┓\n┗┛', name: '4 Esquinas' },
    { icon: '▦', name: 'Llenar Tabla' },
    { icon: '━', name: 'Línea Vertical' },
    { icon: '┏┓\n┗┛', name: 'Diagonal' },
    { icon: '▦', name: 'Tablero Lleno' },
  ];

  return (
    <div className="bg-[#3e2723] border-[6px] border-[#5d4037] rounded-lg shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] p-6 h-full relative">
      {/* Clavos decorativos */}
      <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
      <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#1a100e] shadow-inner"></div>

      {/* Título */}
      <h2 className="text-2xl font-rye font-bold text-[#ffb300] mb-6 text-center uppercase drop-shadow-[2px_2px_0px_rgba(0,0,0,0.8)] border-b-2 border-[#5d4037] pb-3">
        METAS
      </h2>

      {/* Lista de patrones */}
      <div className="space-y-4">
        {patterns.map((pattern, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-[#4e342e] border-2 border-[#6d4c41] rounded p-4 shadow-md hover:border-[#ffb300]/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-[#ffb300] w-12 h-12 flex items-center justify-center bg-[#3e2723] rounded border border-[#5d4037]">
                {pattern.icon.length > 1 ? (
                  <div className="text-xs leading-tight">{pattern.icon}</div>
                ) : (
                  pattern.icon
                )}
              </div>
              <span className="font-rye text-lg text-[#d7ccc8] flex-1">
                {pattern.name}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Texto decorativo inferior */}
      <div className="mt-6 pt-4 border-t-2 border-[#5d4037] text-center">
        <p className="text-[#a1887f] text-xs font-rye italic">
          Completa un patrón para ganar
        </p>
      </div>
    </div>
  );
};

