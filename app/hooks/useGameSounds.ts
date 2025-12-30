import useSound from 'use-sound';

// Configuración de sonidos
// Los sonidos deben estar en public/sounds/
// Si los archivos no existen, use-sound simplemente no reproducirá nada (sin errores)
const SOUNDS = {
  diceShake: '/sounds/dice-shake.mp3', // Sonido de barajar dados en el vaso
  betPlaced: '/sounds/bet-placed.mp3', // Sonido al hacer una apuesta
  liar: '/sounds/liar.mp3', // Sonido al acusar de mentiroso
  buttonClick: '/sounds/button-click.mp3', // Sonido de click en botones
  win: '/sounds/win.mp3', // Sonido de victoria
  lose: '/sounds/lose.mp3', // Sonido de derrota
};

// Nombres alternativos comunes para los sonidos (por si los archivos tienen otros nombres)
const ALTERNATIVE_SOUNDS = {
  diceShake: ['/sounds/dice-cup.mp3', '/sounds/shake.mp3', '/sounds/dice-roll.mp3'],
  betPlaced: ['/sounds/bet.mp3', '/sounds/chip.mp3', '/sounds/coin.mp3'],
  liar: ['/sounds/accuse.mp3', '/sounds/call.mp3'],
  buttonClick: ['/sounds/click.mp3', '/sounds/tap.mp3'],
  win: ['/sounds/victory.mp3', '/sounds/success.mp3'],
  lose: ['/sounds/fail.mp3', '/sounds/error.mp3'],
};

export const useGameSounds = (enabled: boolean = true) => {
  // Sonidos con configuración
  const [playDiceShake, { stop: stopDiceShake }] = useSound(
    SOUNDS.diceShake,
    { 
      volume: 0.5,
      interrupt: true,
      soundEnabled: enabled 
    }
  );

  const [playBetPlaced] = useSound(SOUNDS.betPlaced, { 
    volume: 0.4,
    soundEnabled: enabled 
  });

  const [playLiar] = useSound(SOUNDS.liar, { 
    volume: 0.6,
    soundEnabled: enabled 
  });

  const [playButtonClick] = useSound(SOUNDS.buttonClick, { 
    volume: 0.3,
    soundEnabled: enabled 
  });

  const [playWin] = useSound(SOUNDS.win, { 
    volume: 0.7,
    soundEnabled: enabled 
  });

  const [playLose] = useSound(SOUNDS.lose, { 
    volume: 0.5,
    soundEnabled: enabled 
  });

  return {
    playDiceShake,
    stopDiceShake,
    playBetPlaced,
    playLiar,
    playButtonClick,
    playWin,
    playLose,
  };
};

