'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface GameNotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export const GameNotification = ({ 
  message, 
  type = 'info', 
  onClose, 
  duration = 4000 
}: GameNotificationProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: {
      bg: 'bg-[#2e7d32]',
      border: 'border-[#1b5e20]',
      text: 'text-[#a5d6a7]',
      icon: '✅'
    },
    error: {
      bg: 'bg-[#b71c1c]',
      border: 'border-[#7f0000]',
      text: 'text-[#ffcdd2]',
      icon: '❌'
    },
    warning: {
      bg: 'bg-[#f57c00]',
      border: 'border-[#e65100]',
      text: 'text-[#ffe0b2]',
      icon: '⚠️'
    },
    info: {
      bg: 'bg-[#0d47a1]',
      border: 'border-[#002171]',
      text: 'text-[#bbdefb]',
      icon: 'ℹ️'
    }
  };

  const style = typeStyles[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.8, rotate: -5 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, y: -50, scale: 0.8, rotate: 5 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[90%] sm:w-full"
      >
        <div className={`${style.bg} border-4 ${style.border} rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 sm:p-5 relative overflow-hidden`}>
          {/* Textura de papel */}
          <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] mix-blend-multiply pointer-events-none"></div>
          
          {/* Clavos decorativos estilo western */}
          <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-black/60 shadow-inner border border-black/80"></div>
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-black/60 shadow-inner border border-black/80"></div>
          <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-black/60 shadow-inner border border-black/80"></div>
          <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-black/60 shadow-inner border border-black/80"></div>
          
          {/* Borde decorativo superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
          
          <div className="relative z-10 flex items-start gap-3">
            <span className="text-3xl sm:text-4xl flex-shrink-0 mt-0.5">{style.icon}</span>
            <p className={`${style.text} font-rye text-base sm:text-lg md:text-xl flex-1 leading-tight`}>
              {message}
            </p>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.2, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className={`${style.text} hover:opacity-70 transition-opacity text-2xl sm:text-3xl font-bold flex-shrink-0`}
            >
              ×
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

