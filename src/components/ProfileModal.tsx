import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playTacticalClick, playConfirmTone, playEmergencyTone } from '../utils/soundEffects';
import { UserProfile } from '../types';
import { TwoFactorSection } from './TwoFactorSection';
import { ShieldCheck, Lock, AlertCircle, RefreshCw, LogOut, Clock } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onShowToast?: (msg: string) => void;
  onLogout?: () => void;
  timeoutMinutes?: number;
  onChangeTimeoutMinutes?: (minutes: number) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onShowToast,
  onLogout,
  timeoutMinutes = 60,
  onChangeTimeoutMinutes,
}) => {
  const [tone, setTone] = useState<'conciso' | 'formal' | 'creativo'>('formal');
  const [proactiveMode, setProactiveMode] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [userNameInput, setUserNameInput] = useState(user.name);
  const [userEmailInput, setUserEmailInput] = useState(user.email || '');

  // 2FA Verification modal for critical actions (e.g. changing name or email when 2FA is active)
  const [showCriticalPrompt, setShowCriticalPrompt] = useState(false);
  const [criticalToken, setCriticalToken] = useState('');
  const [isVerifyingCritical, setIsVerifyingCritical] = useState(false);
  const [criticalError, setCriticalError] = useState<string | null>(null);

  const handleToneChange = (newTone: 'conciso' | 'formal' | 'creativo') => {
    playConfirmTone();
    setTone(newTone);
  };

  const handle2FAStatusChange = (enabled: boolean, enabledAt?: string) => {
    onUpdateUser({
      twoFactorEnabled: enabled,
      twoFactorEnabledAt: enabledAt,
    });
  };

  const performDirectSave = () => {
    playConfirmTone();
    if (userNameInput.trim()) {
      onUpdateUser({
        name: userNameInput.trim(),
        email: userEmailInput.trim(),
      });
    }
    onClose();
  };

  const handleSave = () => {
    const hasNameOrEmailChanged =
      userNameInput.trim() !== user.name ||
      userEmailInput.trim() !== (user.email || '');

    // Critical Action Check: If 2FA is active and user changed their identity info, verify with TOTP
    if (user.twoFactorEnabled && hasNameOrEmailChanged) {
      setShowCriticalPrompt(true);
      setCriticalToken('');
      setCriticalError(null);
      return;
    }

    performDirectSave();
  };

  const handleConfirmCriticalAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = criticalToken.replace(/\s+/g, '');
    if (cleanToken.length !== 6) {
      setCriticalError('Ingresa los 6 dígitos de tu aplicación autenticadora.');
      return;
    }

    setIsVerifyingCritical(true);
    setCriticalError(null);

    try {
      const res = await fetch('/api/2fa/verify-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.email || user.name || 'alejo',
          token: cleanToken,
          actionName: 'Actualizar nombre o correo del perfil',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.valid) {
        playEmergencyTone();
        setCriticalError(data.error || 'Código 2FA incorrecto o expirado.');
        return;
      }

      // Action successfully authorized
      setShowCriticalPrompt(false);
      performDirectSave();
      if (onShowToast) {
        onShowToast('Cambio de perfil autorizado con 2FA.');
      }
    } catch {
      playEmergencyTone();
      setCriticalError('Error al validar con el servidor.');
    } finally {
      setIsVerifyingCritical(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            key="profile-modal-card"
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-[#0a0a0a] border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-[#121212] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-[20px]">tune</span>
                <span className="font-mono text-[10px] text-white uppercase tracking-wider font-bold">
                  AJUSTES DEL ASISTENTE // EL FUETE
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
                aria-label="Cerrar ajustes"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </motion.button>
            </div>

            {/* Scrollable Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-bold text-white">Configuración de Asistencia Personal</h3>
                <p className="font-mono text-[11px] text-zinc-400 mt-0.5">
                  Personaliza el comportamiento, seguridad y respuestas de El Fuete
                </p>
              </div>

              {/* User Profile Variable Section */}
              <div className="w-full flex flex-col space-y-2.5 p-3 rounded-xl bg-[#141414] border border-white/10 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase text-zinc-300 font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-white">person</span>
                    Usuario activo
                  </span>
                  <div className="flex items-center gap-1.5">
                    {user.twoFactorEnabled && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] font-mono text-emerald-400 border border-emerald-500/30">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        2FA
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-zinc-300 border border-white/15">
                      {user.role || 'Usuario'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-400">Nombre del usuario</label>
                  <input
                    type="text"
                    value={userNameInput}
                    onChange={(e) => setUserNameInput(e.target.value)}
                    placeholder="Tu nombre (ej. Alejo)"
                    className="w-full px-3 py-1.5 rounded-lg bg-black border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-zinc-400">Correo electrónico</label>
                  <input
                    type="email"
                    value={userEmailInput}
                    onChange={(e) => setUserEmailInput(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-1.5 rounded-lg bg-black border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              {/* 2FA / TOTP Security Section */}
              <TwoFactorSection
                user={user}
                onStatusChange={handle2FAStatusChange}
                onShowToast={onShowToast}
              />

              {/* AI Assistant Preferences */}
              <div className="w-full flex flex-col space-y-3 text-left">
                <div className="flex flex-col space-y-1.5">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                    Tono de respuesta
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#141414] border border-white/10 rounded-xl font-mono text-xs">
                    {(['formal', 'conciso', 'creativo'] as const).map((t) => (
                      <motion.button
                        key={t}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => handleToneChange(t)}
                        className={`py-1.5 rounded-lg capitalize transition-colors ${
                          tone === t ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {t}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-white font-medium">Modo Proactivo</span>
                    <span className="text-[10px] text-zinc-500">Sugerir tareas y optimizaciones</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playConfirmTone();
                      setProactiveMode(!proactiveMode);
                    }}
                    className={`w-10 h-5 rounded-full transition-colors duration-300 relative flex items-center px-0.5 ${
                      proactiveMode ? 'bg-white' : 'bg-zinc-700'
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                      className={`w-4 h-4 rounded-full ${
                        proactiveMode ? 'ml-auto bg-black' : 'mr-auto bg-white'
                      }`}
                    />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-white font-medium">Efectos de Sonido Táctiles</span>
                    <span className="text-[10px] text-zinc-500">Confirmación acústica en acciones</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playConfirmTone();
                      setSoundEnabled(!soundEnabled);
                    }}
                    className={`w-10 h-5 rounded-full transition-colors duration-300 relative flex items-center px-0.5 ${
                      soundEnabled ? 'bg-white' : 'bg-zinc-700'
                    }`}
                  >
                    <motion.div
                      layout
                      transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                      className={`w-4 h-4 rounded-full ${
                        soundEnabled ? 'ml-auto bg-black' : 'mr-auto bg-white'
                      }`}
                    />
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-white font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      Cierre Automático por Inactividad
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Cierra la sesión automáticamente para proteger tu cuenta
                    </span>
                  </div>
                  {onChangeTimeoutMinutes && (
                    <select
                      value={timeoutMinutes}
                      onChange={(e) => {
                        playTacticalClick();
                        onChangeTimeoutMinutes(Number(e.target.value));
                      }}
                      className="px-2 py-1 rounded-lg bg-black border border-white/20 text-xs font-mono text-white focus:outline-none focus:border-white transition-colors cursor-pointer"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={60}>1 hora (defecto)</option>
                      <option value={120}>2 horas</option>
                      <option value={240}>4 horas</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Save Settings Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono text-xs uppercase font-bold transition-colors shadow-sm mt-2"
                type="button"
              >
                Guardar Ajustes
              </motion.button>

              {/* Logout Option */}
              {onLogout && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      playTacticalClick();
                      onClose();
                      onLogout();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-800/30 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Cerrar Sesión Activa
                  </button>
                </div>
              )}
            </div>

            {/* Critical Action Verification Dialog (When editing profile info with 2FA enabled) */}
            <AnimatePresence>
              {showCriticalPrompt && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
                >
                  <motion.div
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    className="w-full max-w-sm rounded-xl bg-[#141414] border border-emerald-500/40 p-4 space-y-3 text-left shadow-2xl"
                  >
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Lock className="w-4 h-4" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">
                        Verificación 2FA Requerida
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Tienes la protección 2FA activa. Introduce el código de 6 dígitos de tu aplicación autenticadora para autorizar el cambio de nombre o correo.
                    </p>

                    <form onSubmit={handleConfirmCriticalAction} className="space-y-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={criticalToken}
                        onChange={(e) => {
                          setCriticalToken(e.target.value.replace(/[^0-9]/g, ''));
                          if (criticalError) setCriticalError(null);
                        }}
                        placeholder="000 000"
                        className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-center font-mono text-lg tracking-[0.3em] font-bold text-white focus:outline-none focus:border-emerald-400"
                        autoFocus
                      />

                      {criticalError && (
                        <div className="flex items-center gap-1.5 p-2 rounded bg-red-950/40 border border-red-800/50 text-red-300 text-[11px]">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span>{criticalError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            playTacticalClick();
                            setShowCriticalPrompt(false);
                          }}
                          className="py-2 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-300 font-mono text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={criticalToken.length !== 6 || isVerifyingCritical}
                          className="py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5"
                        >
                          {isVerifyingCritical ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            'Autorizar'
                          )}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
