import React from 'react';
import { motion } from 'motion/react';
import { playTacticalClick } from '../utils/soundEffects';
import { UserProfile, AppTab } from '../types';
import { Bot, Receipt } from 'lucide-react';

interface TopHeaderProps {
  user: UserProfile;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
  currentTab?: AppTab;
  onSelectTab?: (tab: AppTab) => void;
  pendingGastosCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  onOpenNotifications,
  onOpenSettings,
  onLogout,
  currentTab = 'asistente',
  onSelectTab,
  pendingGastosCount = 0,
}) => {
  const handleClick = (action: () => void) => {
    playTacticalClick();
    action();
  };

  return (
    <header className="sticky top-0 inset-x-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.6)] border-b border-white/10 px-4 py-2.5">
      <div className="h-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-bold tracking-tight">
                El Fuete
              </span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white font-mono text-[9px] font-semibold uppercase tracking-wider">
                ASISTENTE IA
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="font-mono text-[10px] text-zinc-300 tracking-wider uppercase font-medium">
                SISTEMA EN LÍNEA
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* User badge */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleClick(onOpenSettings)}
            aria-label={`Usuario ${user.name}`}
            className="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full bg-[#141414] border border-white/15 hover:border-white/30 text-xs text-white transition-all shadow-sm"
          >
            <div className="relative">
              <span className="w-5 h-5 rounded-full bg-white text-black font-bold text-[10px] flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </span>
              {user.twoFactorEnabled && (
                <span
                  title="2FA Activo"
                  className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                />
              )}
            </div>
            <span className="font-medium text-[11px] max-w-[70px] truncate">{user.name}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleClick(onOpenNotifications)}
            aria-label="Notificaciones"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-[#141414] border border-white/10 hover:border-white/25 transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">notifications</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleClick(onOpenSettings)}
            aria-label="Ajustes del Asistente"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white bg-[#141414] border border-white/10 hover:border-white/25 transition-colors"
          >
            <span className="material-symbols-outlined text-[19px]">tune</span>
          </motion.button>

          {onLogout && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleClick(onLogout)}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 bg-[#141414] border border-white/10 hover:border-red-500/30 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Primary Navigation Switcher: Asistente vs Gastos */}
      {onSelectTab && (
        <nav aria-label="Módulos" className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleClick(() => onSelectTab('asistente'))}
            className={`flex-1 py-1.5 px-3 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              currentTab === 'asistente'
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#141414] border border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Asistente</span>
          </button>
          <button
            type="button"
            onClick={() => handleClick(() => onSelectTab('gastos'))}
            className={`flex-1 py-1.5 px-3 rounded-xl font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative ${
              currentTab === 'gastos'
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#141414] border border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Gastos</span>
            <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/30">
              Excel
            </span>
            {pendingGastosCount > 0 && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                  currentTab === 'gastos'
                    ? 'bg-black text-white'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {pendingGastosCount}
              </span>
            )}
          </button>
        </nav>
      )}
    </header>
  );
};
