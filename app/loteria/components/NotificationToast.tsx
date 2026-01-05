import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface NotificationToastProps {
  notification: { message: string; type: 'success' | 'error' } | null;
  onClose: () => void;
}

export const NotificationToast = ({ notification, onClose }: NotificationToastProps) => {
  // Auto-close handled by parent usually, but we can enforce it here too or just rely on parent resetting state.
  // The requirement says "desaparecer sola o manualmente". 
  // Parent (useLoteriaGame) resets it after 5s. 
  // We just need manual close here.

  if (!notification) return null;

  return (
    <AnimatePresence>
      {notification && (
        <>
          {/* Backdrop invisible para cerrar al clickear cualquier parte */}
          <div className="fixed inset-0 z-[99]" onClick={onClose} />
          
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div className={`
              px-6 py-3 rounded-lg shadow-2xl border-2 flex items-center gap-3 pointer-events-auto cursor-pointer
              ${notification.type === 'success' 
                ? 'bg-[#1b5e20] border-[#4caf50] text-white' 
                : 'bg-[#b71c1c] border-[#ff5252] text-white'
              }
            `}
            onClick={onClose}
            >
              <span className="text-2xl">
                {notification.type === 'success' ? '🎉' : '⚠️'}
              </span>
              <span className="font-rye text-lg drop-shadow-md">
                {notification.message}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
