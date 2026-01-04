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
    <div className="bg-[#3e2723] border-[4px] border-[#5d4037] rounded-lg p-6 shadow-2xl w-full">
      <h2 className="text-2xl font-rye font-bold text-[#ffb300] mb-4 text-center uppercase">
        Mi Tablero
      </h2>
      
      {/* Grid 4x4 con cartas en formato vertical (3:5) - Portrait */}
      <div className="grid grid-cols-4 gap-3">
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
              className="relative cursor-pointer group"
              onClick={() => onCardClick(cardId)}
              style={{ aspectRatio: '3/5' }}
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-[#5d4037] shadow-lg hover:border-[#ffb300] transition-all bg-[#1a100e]">
                <img
                  src={card.img}
                  alt={card.name}
                  className="w-full h-full"
                  style={{ 
                    imageRendering: 'crisp-edges',
                    objectFit: 'fill'
                  }}
                />
                
                {/* Frijol (marca) */}
                {isMarked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#8b4513] border-4 border-[#654321] shadow-lg flex items-center justify-center">
                      <span className="text-2xl">🫘</span>
                    </div>
                  </motion.div>
                )}

                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
              
              {/* Nombre de la carta (opcional, pequeño) */}
              <p className="text-[8px] text-[#d7ccc8] text-center mt-1 truncate font-rye">
                {card.name}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
