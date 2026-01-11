'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './components/Login';
import MainMenu from './components/MainMenu';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Mientras Next.js carga, mostramos un fondo neutro
  if (!mounted) {
    return <div className="min-h-screen bg-[#0f0f0f]" />;
  }

  // 2. Si ya cargó pero está validando la sesión, un spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-[#D4AF37] font-rye animate-pulse">Revisando credenciales...</div>
      </div>
    );
  }

  // 3. SI NO HAY USUARIO -> MOSTRAR LOGIN SÍ O SÍ
  if (!user) {
    return <Login />;
  }

  // 4. SI HAY USUARIO -> AL MENÚ
  return <MainMenu />;
}