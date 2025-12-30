'use client';
import { motion } from 'framer-motion';
import { useEffect, useState, useRef, useMemo } from 'react';

interface DiceCupProps {
  values: number[];
  isShaking?: boolean;
  onShakeComplete?: () => void;
}

// Emojis de dados como fallback
const diceEmojis = ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// Nombres posibles para la imagen del vaso
const cupImageNames = [
  '/dice/dice_cup.jpg',
  '/dice/dice_cup_diffuse.jpg',
  '/dice/dice_cup.png',
  '/dice/cup.jpg',
  '/dice/dice-cup.jpg'
];

// Componente para la imagen del vaso con fallback
const CupImage = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // Intentar cargar la primera imagen disponible
    const img = new window.Image();
    img.onerror = () => {
      if (currentImageIndex < cupImageNames.length - 1) {
        setCurrentImageIndex(currentImageIndex + 1);
      } else {
        setUseFallback(true);
      }
    };
    img.onload = () => setUseFallback(false);
    img.src = cupImageNames[currentImageIndex];
  }, [currentImageIndex]);

  if (useFallback) {
    return (
      <div className="absolute inset-0 bg-gradient-to-b from-amber-800 via-amber-700 to-amber-900 rounded-t-[60%] border-4 border-amber-950 shadow-[inset_0_0_30px_rgba(0,0,0,0.6),0_15px_40px_rgba(0,0,0,0.9)]">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[110%] h-8 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 rounded-full border-2 border-amber-800"></div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-gradient-to-b from-amber-900 to-amber-950 rounded-full border-2 border-amber-950"></div>
      </div>
    );
  }

  return (
    <img
      src={cupImageNames[currentImageIndex]}
      alt="Vaso de dados"
      className="w-full h-full object-contain drop-shadow-2xl"
      onError={() => {
        if (currentImageIndex < cupImageNames.length - 1) {
          setCurrentImageIndex(currentImageIndex + 1);
        } else {
          setUseFallback(true);
        }
      }}
    />
  );
};

// Componente para un dado individual con imagen o emoji
const DiceImage = ({ value, isShaking, index }: { value: number; isShaking: boolean; index: number }) => {
  const [useImage, setUseImage] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // Intentar cargar la imagen
    const img = new window.Image();
    img.onerror = () => setImageError(true);
    img.onload = () => setImageError(false);
    img.src = `/dice/dice-${value}.png`;
  }, [value]);

  return (
    <motion.div
      initial={false}
      animate={{
        rotate: isShaking ? [0, 360, 720, 1080] : 0,
        scale: isShaking ? [1, 1.2, 0.9, 1.1, 1] : 1,
        x: isShaking ? [0, Math.random() * 20 - 10, Math.random() * 20 - 10, 0] : 0,
        y: isShaking ? [0, Math.random() * 15 - 7, Math.random() * 15 - 7, 0] : 0,
      }}
      transition={{
        duration: isShaking ? 0.2 : 0.3,
        repeat: isShaking ? Infinity : 0,
        ease: "linear",
        delay: index * 0.05
      }}
      className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center"
      style={{ zIndex: 10 + index }}
    >
      {!imageError && useImage ? (
        <img
          src={`/dice/dice-${value}.png`}
          alt={`Dado ${value}`}
          className="w-full h-full object-contain drop-shadow-lg"
          onError={() => {
            setImageError(true);
            setUseImage(false);
          }}
        />
      ) : (
        <span className="text-3xl sm:text-4xl md:text-5xl drop-shadow-lg">
          {diceEmojis[value] || '?'}
        </span>
      )}
    </motion.div>
  );
};

export const DiceCup = ({ values, isShaking = false, onShakeComplete }: DiceCupProps) => {
  const [displayValues, setDisplayValues] = useState(values);
  const prevValuesRef = useRef<string>('');
  const isShakingRef = useRef(false);
  
  const valuesString = useMemo(() => JSON.stringify(values), [values]);

  useEffect(() => {
    if (valuesString !== prevValuesRef.current && !isShaking) {
      setDisplayValues(values);
      prevValuesRef.current = valuesString;
    }
  }, [valuesString, isShaking]);

  useEffect(() => {
    if (isShaking && !isShakingRef.current) {
      isShakingRef.current = true;
      const interval = setInterval(() => {
        setDisplayValues(prev => prev.map(() => Math.floor(Math.random() * 6) + 1));
      }, 100);
      
      const timeout = setTimeout(() => {
        setDisplayValues(values);
        clearInterval(interval);
        isShakingRef.current = false;
        prevValuesRef.current = valuesString;
        onShakeComplete?.();
      }, 1500);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        isShakingRef.current = false;
      };
    } else if (!isShaking) {
      isShakingRef.current = false;
    }
  }, [isShaking, valuesString, onShakeComplete]);

  if (values.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32">
        <span className="text-red-500 font-rye text-xl animate-pulse">💀 ELIMINADO 💀</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center relative w-full py-1 sm:py-2">
      {/* VASO CON IMAGEN (más pequeño, arriba) */}
      <motion.div
        animate={{
          rotate: isShaking ? [0, -8, 8, -5, 5, -3, 3, 0] : 0,
          y: isShaking ? [0, -8, 8, -5, 5, -3, 3, 0] : 0,
          scale: isShaking ? [1, 1.05, 0.98, 1.02, 1] : 1,
        }}
        transition={{
          duration: 0.12,
          repeat: isShaking ? Infinity : 0,
          ease: "linear"
        }}
        className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 mb-1 sm:mb-2"
        style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
      >
        <div className="relative w-full h-full">
          <CupImage />
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 sm:h-2 bg-black/40 rounded-full blur-md"></div>
      </motion.div>

      {/* DADOS EN FILA (debajo del vaso, sin mucho espacio) */}
      <div className="flex justify-center items-center gap-1 sm:gap-1.5 md:gap-2 flex-wrap max-w-full px-1">
        {displayValues.map((val, i) => (
          <DiceImage 
            key={`dice-${i}-${isShaking}`} 
            value={val} 
            isShaking={isShaking}
            index={i}
          />
        ))}
      </div>

      {/* Partículas de "ruido" cuando se baraja */}
      {isShaking && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-amber-400/30 rounded-full"
              initial={{
                x: '50%',
                y: '50%',
                scale: 0
              }}
              animate={{
                x: `${50 + (Math.random() * 40 - 20)}%`,
                y: `${50 + (Math.random() * 40 - 20)}%`,
                scale: [0, 1, 0],
                opacity: [0, 0.5, 0]
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

