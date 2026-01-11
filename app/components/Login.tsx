'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { WesternDecor } from './WesternDecor';

export default function Login() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#1a0f0d] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
      <WesternDecor variant="full" className="opacity-30" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center"
      >
        <h1 className="text-6xl font-rye font-bold text-[#ffb300] mb-4 drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)]">
          LIAR'S DICE
        </h1>
        <p className="text-[#d7ccc8] text-xl mb-8 uppercase tracking-widest">El Saloon te espera</p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/login')}
          className="bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-6 px-12 rounded-lg border-4 border-[#ff6f00] shadow-[0_0_30px_rgba(255,179,0,0.5)] text-2xl uppercase tracking-wider transition-all"
        >
          ENTRAR AL SALOON
        </motion.button>
      </motion.div>
    </main>
  );
}

