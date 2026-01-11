'use client';
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationData {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  loserId?: string;
}

interface WesternNotificationBannerProps {
  data: NotificationData | null;
  onClose: () => void;
}

export default function WesternNotificationBanner({ data, onClose }: WesternNotificationBannerProps) {
  
  // Auto-cierre de seguridad (por si el usuario se queda dormido)
  useEffect(() => {
    if (data) {
      // Damos más tiempo al mensaje final para que se lea bien antes de que decidas cerrarlo
      const isGameOver = data.message.includes("FIN DEL JUEGO");
      const time = isGameOver ? 15000 : 4000; 

      const timer = setTimeout(() => {
        onClose();
      }, time);
      return () => clearTimeout(timer);
    }
  }, [data, onClose]);

  if (!data) return null;

  return (
    <AnimatePresence>
      {/* 1. CAPA INVISIBLE DE DETECCIÓN (fixed inset-0)
         Cubre toda la pantalla. Si haces clic en CUALQUIER lado, ejecuta onClose.
      */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose} // 🔥 AQUÍ ESTÁ LA MAGIA: Clic en cualquier lado cierra.
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 cursor-pointer bg-black/10 backdrop-blur-[2px]"
        title="Haz clic en cualquier parte para cerrar"
      >
        
        {/* 2. EL CARTEL (Animación de entrada)
           Aunque hagas clic en el cartel mismo, el evento sube al padre y también cierra.
        */}
        <motion.div
          initial={{ y: -50, scale: 0.9 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: -50, opacity: 0 }}
          onClick={(e) => e.stopPropagation()} // Evita que el clic en el cartel cierre la notificación
          className={`
            relative max-w-lg w-[90%] p-6 rounded-lg border-[4px] shadow-2xl pointer-events-auto
            ${data.type === 'error' 
              ? 'bg-[#8B0000] border-[#2a0a0a] shadow-red-900/50' 
              : data.type === 'warning'
              ? 'bg-[#f57c00] border-[#e65100] shadow-orange-900/50'
              : 'bg-[#2E7D32] border-[#1a472a] shadow-green-900/50'}
          `}
        >
          {/* ❌ BOTÓN DE CERRAR (Esquina superior derecha) */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Evita que el clic se propague al padre
              onClose();
            }}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white font-bold border-2 border-white/40 transition-all z-50 hover:scale-110 active:scale-95 cursor-pointer shadow-lg"
            title="Cerrar notificación"
          >
            ✕
          </button>

          {/* Clavos decorativos */}
          <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-black/40 shadow-inner" />
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black/40 shadow-inner pointer-events-none" /> {/* Debajo del botón */}
          <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-black/40 shadow-inner" />
          <div className="absolute bottom-3 right-3 w-2 h-2 rounded-full bg-black/40 shadow-inner" />

          {/* Contenido */}
          <div className="text-center space-y-2">
            <div className="text-5xl drop-shadow-md mb-2">
              {data.type === 'error' ? '☠️' : data.type === 'warning' ? '⚠️' : '🤠'}
            </div>

            <h3 className="font-rye text-3xl text-[#FFD700] tracking-widest drop-shadow-md">
              {data.type === 'error' ? '¡MALDICIÓN!' : data.type === 'warning' ? '¡ATENCIÓN!' : '¡NOTICIAS!'}
            </h3>
            
            <p className="font-serif text-white text-xl font-bold leading-relaxed drop-shadow-md">
              {data.message}
            </p>
            
            <p className="text-xs text-white/50 mt-4 uppercase tracking-widest">
              (Toca la pantalla para cerrar)
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
