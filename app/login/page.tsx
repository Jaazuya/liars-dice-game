'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { motion } from 'framer-motion';
import { WesternDecor } from '@/app/components/WesternDecor';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert('Completa todos los campos, forastero.');
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      alert(error.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      setIsLoading(false);
    } else {
      router.push('/');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      alert('Completa todos los campos, forastero.');
      return;
    }

    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, username);

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        alert('Este usuario ya existe, compañero. Intenta iniciar sesión.');
      } else {
        alert(error.message || 'Error al registrarse. Intenta de nuevo.');
      }
      setIsLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen bg-[#1a0f0d] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Fondo con textura de madera */}
      <div className="absolute inset-0 opacity-15 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
      
      {/* Decoración western de fondo */}
      <WesternDecor variant="full" className="opacity-25" />
      
      {/* Efecto de polvo */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Cartel tipo Wanted */}
        <div className="bg-[#3e2723] border-[6px] border-[#ffb300] rounded-lg shadow-[0_0_30px_rgba(255,179,0,0.3)] p-8 relative wood-texture">
          {/* Efecto de papel arrugado */}
          <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] rounded-lg paper-texture"></div>
          
          {/* Título */}
          <div className="text-center mb-8 relative z-10">
            <h1 className="text-5xl font-rye font-bold text-[#ffb300] mb-2 drop-shadow-[3px_3px_0px_rgba(0,0,0,0.8)]">
              WANTED
            </h1>
            <p className="text-[#d7ccc8] text-sm uppercase tracking-widest">El Saloon te espera</p>
          </div>

          {/* Pestañas */}
          <div className="flex gap-2 mb-6 relative z-10">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 px-4 border-2 font-rye font-bold transition-all ${
                activeTab === 'login'
                  ? 'bg-[#ffb300] border-[#ff6f00] text-[#3e2723] shadow-lg'
                  : 'bg-[#1a0f0d] border-[#5d4037] text-[#d7ccc8] hover:border-[#8d6e63]'
              }`}
            >
              INICIAR SESIÓN
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-3 px-4 border-2 font-rye font-bold transition-all ${
                activeTab === 'register'
                  ? 'bg-[#ffb300] border-[#ff6f00] text-[#3e2723] shadow-lg'
                  : 'bg-[#1a0f0d] border-[#5d4037] text-[#d7ccc8] hover:border-[#8d6e63]'
              }`}
            >
              REGISTRO
            </button>
          </div>

          {/* Formulario de Login */}
          {activeTab === 'login' && (
            <motion.form
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin}
              className="relative z-10"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-[#d7ccc8] text-sm uppercase tracking-wider mb-2 font-rye">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none focus:ring-2 focus:ring-[#ffb300]/50"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-[#d7ccc8] text-sm uppercase tracking-wider mb-2 font-rye">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none focus:ring-2 focus:ring-[#ffb300]/50"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 rounded border-2 border-[#ff6f00] shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 text-lg"
                >
                  {isLoading ? 'ENTRANDO...' : 'ENTRAR AL SALOON'}
                </button>
              </div>
            </motion.form>
          )}

          {/* Formulario de Registro */}
          {activeTab === 'register' && (
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegister}
              className="relative z-10"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-[#d7ccc8] text-sm uppercase tracking-wider mb-2 font-rye">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Tu nombre de forastero"
                    className="w-full bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none focus:ring-2 focus:ring-[#ffb300]/50"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-[#d7ccc8] text-sm uppercase tracking-wider mb-2 font-rye">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none focus:ring-2 focus:ring-[#ffb300]/50"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-[#d7ccc8] text-sm uppercase tracking-wider mb-2 font-rye">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-[#1a0f0d] border-2 border-[#5d4037] text-[#d7ccc8] p-3 rounded focus:border-[#ffb300] focus:outline-none focus:ring-2 focus:ring-[#ffb300]/50"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#ffb300] hover:bg-[#ff6f00] text-[#3e2723] font-rye font-bold py-4 rounded border-2 border-[#ff6f00] shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 text-lg"
                >
                  {isLoading ? 'REGISTRANDO...' : 'UNIRSE AL SALOON'}
                </button>
              </div>
            </motion.form>
          )}
        </div>
      </motion.div>
    </main>
  );
}

