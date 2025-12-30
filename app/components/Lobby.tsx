'use client';
import { Player } from "@/app/types/game";
import { useState } from "react";
import { motion } from 'framer-motion';

export const Lobby = ({ code, players, isHost, entryFee, onUpdateFee, onStart, onKick, onAbandon, allowCheats, onToggleCheats }: any) => {
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full min-h-screen bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] bg-[#2d1b15]">
            {/* Botón Abandonar (Esquina superior izquierda) */}
            {onAbandon && (
                <button
                    onClick={onAbandon}
                    className="absolute top-4 left-4 bg-red-900/80 hover:bg-red-700 text-white font-rye px-4 py-2 rounded border-2 border-red-800 shadow-lg transition-all z-50"
                >
                    🚪 Abandonar
                </button>
            )}
            
            {/* TABLÓN PRINCIPAL DE MADERA */}
            <div className="bg-[#3e2723] p-8 md:p-12 rounded-sm border-[8px] border-[#5d4037] shadow-[20px_20px_0px_rgba(0,0,0,0.5)] w-full max-w-lg relative animate-in zoom-in duration-300">
                
                {/* Clavos decorativos */}
                <div className="absolute top-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
                <div className="absolute bottom-3 left-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>
                <div className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-[#1a100e] shadow-inner"></div>

                <h1 className="font-rye text-5xl md:text-6xl text-[#ffb300] mb-2 drop-shadow-[4px_4px_0px_#000]">SALOON</h1>
                <p className="text-[#a1887f] uppercase tracking-[0.4em] text-xs mb-8 font-sans border-b border-[#5d4037] pb-4">Sala de Espera</p>

                {/* CÓDIGO DE SALA */}
                <div 
                    onClick={copyCode}
                    className="cursor-pointer bg-[#1a100e] p-6 rounded border-2 border-[#ffb300]/30 mb-8 hover:bg-black transition group relative shadow-inner"
                >
                    <p className="text-[#a1887f] text-[10px] uppercase tracking-widest mb-2 font-sans">Código de la Mesa</p>
                    <h2 className="font-rye text-6xl md:text-7xl text-[#ffecb3] tracking-widest drop-shadow-lg group-hover:scale-110 transition-transform">{code}</h2>
                    <div className="absolute bottom-2 right-2 text-[#ffb300] text-xs opacity-0 group-hover:opacity-100 transition-opacity font-bold">COPIAR</div>
                </div>

                {/* CONFIGURACIÓN DE APUESTA (Host Control) */}
                <div className="bg-[#4e342e] p-4 rounded mb-6 border-2 border-[#6d4c41] shadow-lg">
                    <div className="flex flex-col gap-2">
                        <span className="text-[#d7ccc8] text-xs uppercase tracking-widest font-bold border-b border-[#8d6e63] pb-1">Apuesta de Entrada</span>
                        
                        {isHost ? (
                            <div className="flex items-center justify-center gap-4 mt-2">
                                <button onClick={() => onUpdateFee(entryFee - 50)} className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-xl">-</button>
                                <span className="font-rye text-4xl text-[#4caf50] min-w-[100px] text-center drop-shadow-md bg-black/20 rounded px-2">$ {entryFee}</span>
                                <button onClick={() => onUpdateFee(entryFee + 50)} className="w-10 h-10 rounded bg-[#3e2723] text-[#d7ccc8] font-rye border-2 border-[#8d6e63] hover:bg-[#ffb300] hover:text-black hover:border-[#ff6f00] transition-all text-xl">+</button>
                            </div>
                        ) : (
                            <div className="font-rye text-4xl text-[#4caf50] drop-shadow-md mt-2">$ {entryFee}</div>
                        )}
                    </div>
                </div>

                {/* CONFIGURACIÓN DE TRUCOS (Host Control) */}
                <div className="bg-[#4e342e] p-4 rounded mb-6 border-2 border-[#6d4c41] shadow-lg">
                    <div className="flex flex-col gap-2">
                        <span className="text-[#d7ccc8] text-xs uppercase tracking-widest font-bold border-b border-[#8d6e63] pb-1">🃏 Modo con Trucos</span>
                        
                        {isHost ? (
                            <div className="flex items-center justify-center gap-4 mt-2">
                                <span className="font-rye text-lg text-[#d7ccc8]">Desactivado</span>
                                <button 
                                    onClick={onToggleCheats}
                                    className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                                        allowCheats ? 'bg-[#4caf50]' : 'bg-[#5d4037]'
                                    }`}
                                >
                                    <span 
                                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-200 ${
                                            allowCheats ? 'translate-x-6' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                                <span className="font-rye text-lg text-[#d7ccc8]">Activado</span>
                            </div>
                        ) : (
                            <div className="font-rye text-lg text-[#d7ccc8] mt-2 text-center">
                                {allowCheats ? '🃏 Trucos: Activados' : '🃏 Trucos: Desactivados'}
                            </div>
                        )}
                    </div>
                </div>

                {/* LISTA DE JUGADORES (Con dinero y botón Kick) */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-2 px-1">
                        <span className="text-[#a1887f] text-xs uppercase tracking-widest">Forajidos ({players.length})</span>
                        <span className="text-[#a1887f] text-xs uppercase tracking-widest">Billetera</span>
                    </div>
                    
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 bg-[#2d1b15]/50 p-2 rounded border border-[#5d4037]">
                        {players.map((p: Player) => (
                            <div key={p.id} className="flex justify-between items-center bg-[#2d1b15] px-4 py-3 rounded border border-[#4e342e] shadow-sm group hover:border-[#ffb300]/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-[#3e2723] rounded-full flex items-center justify-center border border-[#5d4037]">🤠</div>
                                    <span className="font-rye text-lg text-[#d7ccc8] truncate max-w-[120px]">{p.name}</span>
                                    {p.is_host && <span className="text-[10px] bg-[#ffb300] text-black px-1 rounded font-bold">SHERIFF</span>}
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <span className={`font-rye text-lg ${p.money < entryFee ? "text-red-400 animate-pulse" : "text-[#81c784]"}`}>$ {p.money}</span>
                                    
                                    {/* BOTÓN EXPULSAR (Solo lo ve el Host) */}
                                    {isHost && !p.is_host && (
                                        <button 
                                            onClick={() => onKick(p.id)}
                                            className="opacity-0 group-hover:opacity-100 bg-red-900/80 hover:bg-red-600 text-white w-8 h-8 rounded flex items-center justify-center transition-all border border-red-800"
                                            title="Expulsar jugador (acción inmediata)"
                                        >
                                            💀
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* BOTÓN DE ACCIÓN DEL HOST */}
                {isHost ? (
                    <motion.button 
                        onClick={onStart}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-[#ffb300] hover:bg-[#ffca28] text-[#3e2723] font-rye text-2xl py-5 rounded border-b-[6px] border-[#ff6f00] active:border-b-0 active:translate-y-1 transition-all shadow-xl uppercase tracking-wider flex flex-col items-center leading-none gap-1"
                    >
                        <span>ABRIR LA MESA</span>
                        <span className="text-[10px] font-sans font-bold opacity-70 tracking-[0.2em] font-normal">INICIAR FASE DE APUESTAS</span>
                    </motion.button>
                ) : (
                    <motion.div 
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-full bg-black/20 border-2 border-dashed border-[#5d4037] p-4 rounded text-[#a1887f] font-rye text-lg"
                    >
                        Esperando al Sheriff...
                    </motion.div>
                )}
            </div>
        </div>
    );
};