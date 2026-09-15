import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playTacticalClick, playConfirmTone } from '../utils/soundEffects';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [alerts, setAlerts] = useState<Array<{ id: string; time: string; type: string; title: string; desc: string }>>([
    {
      id: 'notif-1',
      time: 'Hace 10 min',
      type: 'Recordatorio',
      title: 'Planificación de la Tarde',
      desc: 'Tienes 2 tareas de prioridad programadas para hoy. Revisa el planificador de El Fuete.',
    },
    {
      id: 'notif-2',
      time: 'Hace 1 h',
      type: 'Asistente IA',
      title: 'Borrador Guardado',
      desc: 'El texto generado para el correo de confirmación está listo en tu historial.',
    },
  ]);

  const handleClearAll = () => {
    playConfirmTone();
    setAlerts([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="notif-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            key="notif-modal-card"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-[#0a0a0a] border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden"
          >
            <div className="p-4 bg-[#121212] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-[20px]">
                  notifications_active
                </span>
                <span className="font-mono text-[10px] text-white uppercase tracking-wider font-bold">
                  NOTIFICACIONES & RECORDATORIOS
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  playTacticalClick();
                  onClose();
                }}
                className="size-8 rounded-lg bg-[#1c1c1c] text-zinc-400 hover:text-white flex items-center justify-center border border-white/10"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </motion.button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {alerts.length === 0 ? (
                  <motion.div
                    key="empty-notif"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-8 flex flex-col items-center justify-center text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white mb-2">
                      <span className="material-symbols-outlined text-[22px]">check_circle</span>
                    </div>
                    <span className="text-xs font-semibold text-white">Todo al día</span>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-[240px]">
                      No tienes notificaciones pendientes. El Fuete te avisará cuando haya novedades o recordatorios.
                    </p>
                  </motion.div>
                ) : (
                  alerts.map((alert) => (
                    <motion.div
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="w-full text-left p-3 rounded-xl bg-[#141414] border border-white/10 space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-zinc-400">{alert.time}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-white/10 text-white border border-white/15">
                          {alert.type}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white">{alert.title}</h4>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{alert.desc}</p>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="p-3 border-t border-white/10 bg-[#121212] flex gap-2">
              {alerts.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-[#1c1c1c] hover:bg-[#282828] text-zinc-300 hover:text-white font-mono text-xs uppercase font-medium border border-white/10 transition-colors"
                  type="button"
                >
                  Borrar Todas
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  playTacticalClick();
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono text-xs uppercase font-bold transition-colors shadow-sm"
                type="button"
              >
                Entendido
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
