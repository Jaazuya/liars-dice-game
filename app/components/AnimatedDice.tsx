'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, useMemo } from 'react';

interface AnimatedDiceProps {
  values: number[];
  getEmoji: (n: number) => string;
  isShaking?: boolean;
  onShakeComplete?: () => void;
}

export const AnimatedDice = ({ values, getEmoji, isShaking = false, onShakeComplete }: AnimatedDiceProps) => {
  const [displayValues, setDisplayValues] = useState(values);
  const prevValuesRef = useRef<string>('');
  const isShakingRef = useRef(false);
  
  // Memoizar el string de valores para comparación
  const valuesString = useMemo(() => JSON.stringify(values), [values]);

  useEffect(() => {
    // Solo actualizar si los valores realmente cambiaron
    if (valuesString !== prevValuesRef.current && !isShaking) {
      setDisplayValues(values);
      prevValuesRef.current = valuesString;
    }
  }, [valuesString, isShaking]);

  useEffect(() => {
    if (isShaking && !isShakingRef.current) {
      // Iniciar el barajado
      isShakingRef.current = true;
      const interval = setInterval(() => {
        setDisplayValues(prev => prev.map(() => Math.floor(Math.random() * 6) + 1));
      }, 100);
      
      // Después de 1.5 segundos, mostrar los valores reales
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
      <span className="text-red-500 font-rye text-xl animate-pulse">💀 ELIMINADO 💀</span>
    );
  }

  return (
    <div className="flex justify-center gap-2 h-12 items-center mb-2">
      {displayValues.map((val, i) => (
        <motion.span
          key={`dice-${i}`}
          initial={false}
          animate={{ 
            opacity: 1, 
            scale: isShaking ? [1, 1.3, 0.9, 1.2, 1] : 1,
            rotate: isShaking ? [0, 180, 360, 540, 720] : 0,
            y: isShaking ? [0, -15, 5, -10, 0] : 0,
            x: isShaking ? [0, 15, -15, 12, -12, 0] : 0,
          }}
          transition={{
            duration: isShaking ? 0.15 : 0.3,
            repeat: isShaking ? Infinity : 0,
            ease: isShaking ? "linear" : "easeOut",
            delay: i * 0.05
          }}
          className="text-5xl md:text-6xl drop-shadow-[4px_4px_0px_rgba(0,0,0,0.5)] cursor-default filter brightness-90"
        >
          {getEmoji(val)}
        </motion.span>
      ))}
    </div>
  );
};

