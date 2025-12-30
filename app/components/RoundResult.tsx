'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface RoundResultProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  autoCloseDelay?: number;
}

export const RoundResult = ({ message, type = 'info', onClose, autoCloseDelay = 5000 }: RoundResultProps) => {
  // Cerrar automáticamente después del delay
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [onClose, autoCloseDelay]);
  const typeStyles = {
    success: {
      bg: 'from-[#2e7d32] to-[#1b5e20]',
      border: 'border-[#1b5e20]',
      text: 'text-[#a5d6a7]',
      icon: '✅'
    },
    error: {
      bg: 'from-[#b71c1c] to-[#7f0000]',
      border: 'border-[#7f0000]',
      text: 'text-[#ffcdd2]',
      icon: '❌'
    },
    warning: {
      bg: 'from-[#f57c00] to-[#e65100]',
      border: 'border-[#e65100]',
      text: 'text-[#ffe0b2]',
      icon: '⚠️'
    },
    info: {
      bg: 'from-[#0d47a1] to-[#002171]',
      border: 'border-[#002171]',
      text: 'text-[#bbdefb]',
      icon: 'ℹ️'
    }
  };

  const style = typeStyles[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: -100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.5, y: -100 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 150 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ rotate: -5 }}
          animate={{ rotate: 0 }}
          transition={{ delay: 0.2, type: "spring" }}
          className={`bg-gradient-to-b ${style.bg} border-4 ${style.border} rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-6 sm:p-8 md:p-10 lg:p-12 max-w-[90%] sm:max-w-lg md:max-w-xl lg:max-w-2xl w-full relative overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Textura de papel */}
          <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none"></div>
          
          {/* Clavos decorativos estilo western */}
          <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-black/70 shadow-inner border-2 border-black/90"></div>
          <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-black/70 shadow-inner border-2 border-black/90"></div>
          <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-black/70 shadow-inner border-2 border-black/90"></div>
          <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-black/70 shadow-inner border-2 border-black/90"></div>
          
          {/* Borde decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center gap-4 sm:gap-6">
            <motion.span
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl"
            >
              {style.icon}
            </motion.span>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`${style.text} font-rye text-xl sm:text-2xl md:text-3xl lg:text-4xl leading-tight drop-shadow-[2px_2px_4px_rgba(0,0,0,0.8)]`}
            >
              {message}
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

