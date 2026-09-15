import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playTacticalClick } from '../utils/soundEffects';

export interface DetailData {
  title: string;
  category: string;
  status: string;
  statusColor?: string;
  description: string;
  meta: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; primary?: boolean; onClick?: () => void }>;
}

interface DetailModalProps {
  data: DetailData | null;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ data, onClose }) => {
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          key="detail-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            key="detail-modal-card"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-[#0a0a0a] border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-[#121212] border-b border-white/10 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                  {data.category}
                </span>
                <h3 className="text-base font-bold text-white">{data.title}</h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  playTacticalClick();
                  onClose();
                }}
                className="size-8 rounded-lg bg-[#1c1c1c] text-zinc-400 hover:text-white flex items-center justify-center border border-white/10"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-black border border-white/10 flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-mono">ESTADO DE LA HERRAMIENTA</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/20">
                  {data.status}
                </span>
              </div>

              <p className="text-xs text-zinc-200 leading-relaxed font-sans">{data.description}</p>

              <div className="grid grid-cols-2 gap-2">
                {data.meta.map((m, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-[#141414] border border-white/10 font-mono text-[11px]"
                  >
                    <span className="text-zinc-500 block text-[10px]">{m.label}</span>
                    <span className="text-white font-semibold">{m.value}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex gap-2">
                {data.actions && data.actions.length > 0 ? (
                  data.actions.map((act, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        playTacticalClick();
                        if (act.onClick) act.onClick();
                        onClose();
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-mono text-xs uppercase font-bold transition-all ${
                        act.primary
                          ? 'bg-white hover:bg-zinc-200 text-black shadow-md shadow-white/10'
                          : 'bg-[#1c1c1c] hover:bg-[#282828] text-zinc-300 border border-white/10'
                      }`}
                    >
                      {act.label}
                    </motion.button>
                  ))
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      playTacticalClick();
                      onClose();
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-white font-mono text-xs uppercase border border-white/10"
                  >
                    Cerrar
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
