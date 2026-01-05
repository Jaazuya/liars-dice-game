'use client';

import { motion } from 'framer-motion';
import { WinPattern, PATTERN_NAMES, PATTERN_ICONS, PATTERN_POINTS } from '../utils/validation';

interface WinningPatternsProps {
  claimedAwards?: Record<string, boolean>;
  onClaim?: (pattern: WinPattern) => void;
}

const PATTERNS: WinPattern[] = ['linea', 'diagonal', 'cuadro', 'esquinas', 'centro', 'llenas'];

export const WinningPatterns = ({ claimedAwards = {}, onClaim }: WinningPatternsProps) => {
  
  const handleClaim = (pattern: WinPattern) => {
    if (onClaim && !claimedAwards[pattern]) {
      onClaim(pattern);
    }
  };

  return (
    <div className="bg-[#3e2723] border-[4px] border-[#5d4037] rounded-lg p-4 shadow-2xl w-full">
      <h2 className="text-xl font-rye font-bold text-[#ffb300] mb-3 text-center uppercase border-b-2 border-[#5d4037] pb-2">
        METAS
      </h2>

      {/* Grid: 2 columnas en móvil, 1 columna en desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3">
        {PATTERNS.map((pattern, index) => {
          const isClaimed = claimedAwards[pattern];
          
          return (
            <motion.button
              key={pattern}
              whileTap={!isClaimed ? { scale: 0.95 } : undefined}
              onClick={() => handleClaim(pattern)}
              disabled={isClaimed || !onClaim}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={`
                border rounded p-2 sm:p-3 shadow flex items-center gap-3 transition-all w-full text-left
                ${isClaimed 
                  ? 'bg-[#1a100e] border-[#3e2716] text-[#5d4037] cursor-not-allowed grayscale opacity-60' 
                  : 'bg-[#4e342e] border-[#6d4c41] hover:border-[#ffb300]/50 hover:bg-[#5d4037]'
                }
              `}
            >
              <div className={`
                text-2xl font-bold w-10 h-10 flex shrink-0 items-center justify-center rounded border
                ${isClaimed 
                  ? 'bg-[#000]/20 border-[#3e2716] text-[#5d4037]' 
                  : 'bg-[#3e2723] border-[#5d4037] text-[#ffb300]'
                }
              `}>
                <div className="text-[14px] leading-tight whitespace-pre-line text-center">
                  {PATTERN_ICONS[pattern]}
                </div>
              </div>
              
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className={`font-rye text-sm sm:text-base truncate ${isClaimed ? 'text-[#5d4037]' : 'text-[#d7ccc8]'}`}>
                  {PATTERN_NAMES[pattern]}
                </span>
                <span className={`text-[10px] font-mono ${isClaimed ? 'text-[#3e2716]' : 'text-[#a1887f]'}`}>
                  {isClaimed ? 'RECLAMADO' : `${PATTERN_POINTS[pattern]} pts`}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Texto decorativo inferior */}
      <div className="mt-3 pt-2 border-t border-[#5d4037] text-center">
        <p className="text-[#a1887f] text-[10px] font-rye italic">
          Toca una meta para reclamarla
        </p>
      </div>
    </div>
  );
};
