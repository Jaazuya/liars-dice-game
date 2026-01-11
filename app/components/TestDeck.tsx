'use client';

import React from 'react';

export default function TestDeck() {
  // Probamos algunas cartas para ver si los SVGs cargan bien
  // Asegúrate de que los nombres coincidan con tus archivos en public/cards/
  const testCards = ['SA', 'H10', 'DK', 'C3']; 

  return (
    <div className="p-6 bg-black bg-opacity-30 rounded-xl flex flex-col items-center gap-4 border border-blue-400/30">
      <h2 className="text-yellow-400 text-lg font-bold uppercase tracking-widest">
        Verificación de Baraja
      </h2>
      
      <div className="flex gap-4 flex-wrap justify-center">
        {testCards.map((cardId) => (
          <div key={cardId} className="flex flex-col items-center group">
            <div className="relative transition-transform transform group-hover:-translate-y-2 duration-300">
                {/* Sombra suave */}
                <div className="absolute inset-0 bg-black blur-md opacity-50 rounded-lg translate-y-2"></div>
                
                {/* LA CARTA REAL */}
                <img 
                  src={`/cards/${cardId}.svg`} 
                  alt={cardId} 
                  className="w-20 h-auto rounded-lg relative z-10"
                  onError={(e) => {
                      // Si falla, ponemos un borde rojo para avisar
                      e.currentTarget.style.border = '2px solid red';
                  }}
                />
            </div>
            <span className="text-blue-200 text-xs mt-2 font-mono">{cardId}</span>
          </div>
        ))}
        
        {/* El Reverso con tu marca */}
        <div className="flex flex-col items-center group">
            <div className="relative transition-transform transform group-hover:-translate-y-2 duration-300">
                <div className="absolute inset-0 bg-black blur-md opacity-50 rounded-lg translate-y-2"></div>
                <img 
                  src="/cards/BACK.svg" 
                  alt="Reverso" 
                  className="w-20 h-auto rounded-lg relative z-10"
                />
            </div>
            <span className="text-yellow-500 text-xs mt-2 font-mono">BACK</span>
        </div>
      </div>
    </div>
  );
}