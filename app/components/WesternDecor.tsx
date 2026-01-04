'use client';

interface WesternDecorProps {
  variant?: 'full' | 'minimal' | 'corners';
  className?: string;
}

export const WesternDecor = ({ variant = 'full', className = '' }: WesternDecorProps) => {
  // Componente vacío - solo mantiene el contenedor para compatibilidad
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`} />
  );
};

