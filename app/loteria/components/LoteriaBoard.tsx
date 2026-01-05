'use client';

import { LOTERIA_CARDS, getCardById } from '@/app/lib/loteriaData';
import { motion } from 'framer-motion';

interface LoteriaBoardProps {
  boardCards: number[];
  markedCards: number[];
  onCardClick: (cardId: number) => void;
}

export const LoteriaBoard = ({ boardCards, markedCards, onCardClick }: LoteriaBoardProps) => {
  return (
    // Contenedor flexible que permite scroll si es necesario
    <div className="w-full flex justify-center p-2">
      
      {/* Grid del Tablero: 
          - Móvil: 95% del ancho, altura automática (aspecto 4:5), sin restricciones de altura.
          - Desktop: Se ajusta a la altura disponible para no hacer scroll innecesario en pantallas grandes.
      */}
      <div className="relative grid grid-cols-4 grid-rows-4 gap-2 bg-white p-2 rounded-lg border-[3px] border-black shadow-xl
                      w-[95%] sm:w-auto sm:h-[85vh] aspect-[4/5]"
      >
        {boardCards.map((cardId, index) => {
          const card = getCardById(cardId);
          const isMarked = markedCards.includes(cardId);
          
          if (!card) return null;

          return (
            <motion.div
              key={cardId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative w-full h-full overflow-hidden rounded cursor-pointer group bg-[#1a100e] border-[1px] sm:border-2 border-black"
              onClick={() => onCardClick(cardId)}
            >
              <img
                src={card.img}
                alt={card.name}
                className="absolute inset-0 w-full h-full object-fill"
                style={{ imageRendering: 'crisp-edges' }}
              />
              
              {isMarked && (
                <motion.img
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  src="/assets/loteria/img/marker.png"
                  alt="Marcador"
                  className="absolute z-10 inset-0 m-auto w-[85%] h-[85%] object-contain drop-shadow-md pointer-events-none"
                />
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors z-20" />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
