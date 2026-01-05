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
    // Main Container (The Screen): locks the app to the screen size
    <div className="fixed inset-0 w-full h-[100dvh] bg-black/90 flex items-center justify-center overflow-hidden z-0 lg:static lg:bg-transparent lg:h-full lg:block">
      {/* 
         NOTA: He añadido 'lg:static...' para que en escritorio respete el layout de columnas 
         y no tape la baraja, pero en móvil sea full screen inmersivo como pediste.
         Si prefieres full screen SIEMPRE, quita las clases 'lg:'.
      */}
      
      {/* Grid Container (The Board Wrapper): defines shape */}
      <div className="w-full max-w-md h-full max-h-[95vh] aspect-[3/5] p-2 mx-auto flex flex-col justify-center">
        
        {/* The Grid (The Parent): 16 equal cells */}
        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full bg-white p-2 rounded-lg border-[3px] border-black">
          {boardCards.map((cardId, index) => {
            const card = getCardById(cardId);
            const isMarked = markedCards.includes(cardId);
            
            if (!card) return null;

            return (
              // Card Container (The Child div): fills the cell
              <motion.div
                key={cardId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="relative w-full h-full overflow-hidden rounded cursor-pointer group bg-[#1a100e] border-2 border-black"
                onClick={() => onCardClick(cardId)}
              >
                {/* The Image (The Grandchild img): stretches to fit exactly */}
                <img
                  src={card.img}
                  alt={card.name}
                  className="absolute inset-0 w-full h-full object-fill"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                
                {/* Marcador (Marker) */}
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

                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors z-20" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
