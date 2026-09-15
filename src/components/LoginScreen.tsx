import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Shield,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Lock,
  User,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Clock,
} from 'lucide-react';
import { playTacticalClick, playConfirmTone, playEmergencyTone } from '../utils/soundEffects';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  defaultUsername?: string;
  expiredSessionNotice?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  defaultUsername = 'Alejo',
  expiredSessionNotice = null,
}) => {
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials');
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('fuete2026');
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [detected2FA, setDetected2FA] = useState(false);

  // Submit credentials (Step 1)
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg('Por favor ingresa un nombre de usuario o correo.');
      return;
    }

    playTacticalClick();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/2fa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.requires2FA) {
        // User has 2FA enabled! Move to Step 2
        playConfirmTone();
        setDetected2FA(true);
        setStep('totp');
        setTotpCode('');
        setErrorMsg(null);
      } else if (res.ok && data.success) {
        // Direct login without 2FA
        playConfirmTone();
        onLoginSuccess(data.user);
      } else {
        playEmergencyTone();
        setErrorMsg(data.error || 'No se pudo iniciar sesión.');
      }
    } catch {
      playEmergencyTone();
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit TOTP Code (Step 2)
  const handleSubmitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = totpCode.replace(/\s+/g, '');
    if (cleanToken.length !== 6) {
      setErrorMsg('El código de verificación debe tener 6 dígitos numéricos.');
      return;
    }

    playTacticalClick();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/2fa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          totpToken: cleanToken,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        playConfirmTone();
        onLoginSuccess(data.user);
      } else {
        playEmergencyTone();
        setErrorMsg(data.error || 'Código 2FA incorrecto o expirado.');
      }
    } catch {
      playEmergencyTone();
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#050505] text-white relative overflow-hidden selection:bg-white selection:text-black">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md rounded-2xl bg-[#0c0c0c] border border-white/15 p-6 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.8)] relative z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center font-bold text-2xl tracking-tighter shadow-lg shadow-white/10">
              ⚡
            </div>
            {detected2FA && step === 'totp' && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-black border-2 border-[#0c0c0c]"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </motion.span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <h1 className="font-mono text-base tracking-widest font-black uppercase text-white">
              EL FUETE // AI
            </h1>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-zinc-300 font-bold border border-white/20 uppercase">
              v2.4
            </span>
          </div>
          <p className="font-mono text-xs text-zinc-400 mt-1">
            Asistente Ejecutivo con Seguridad TOTP 2FA
          </p>
        </div>

        {expiredSessionNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 font-mono"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="leading-tight">{expiredSessionNotice}</span>
          </motion.div>
        )}

        {/* Form Container */}
        <AnimatePresence mode="wait">
          {step === 'credentials' ? (
            <motion.form
              key="credentials-step"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmitCredentials}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-300" />
                  Usuario o Correo
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Tu usuario (ej. Alejo)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-sans"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-300" />
                    Contraseña
                  </label>
                  <span className="text-[10px] font-mono text-zinc-500">Acceso local</span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-white/20 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors font-sans"
                />
              </div>

              {/* Quick Profile Selector pills */}
              <div className="pt-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1.5">
                  Accesos rápidos sugeridos:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Alejo', 'Directora Maria', 'Alex Tech'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        playTacticalClick();
                        setUsername(preset);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                        username.toLowerCase() === preset.toLowerCase()
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || !username.trim()}
                className="w-full py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Comprobando seguridad...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="totp-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmitTotp}
              className="space-y-4"
            >
              {/* 2FA Challenge Header */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-xs font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                    2FA Requerido // TOTP
                  </span>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Tu cuenta cuenta con protección de doble factor. Abre <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> e introduce el código temporal de 6 dígitos.
                  </p>
                </div>
              </div>

              {/* 6 Digit TOTP input */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-300 font-semibold flex items-center justify-between">
                  <span>Código de 6 dígitos</span>
                  <span className="text-zinc-500 text-[10px]">Expira en 30s</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setTotpCode(val);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="000 000"
                    className="w-full py-3 px-4 rounded-xl bg-black border border-white/20 text-center font-mono text-xl tracking-[0.35em] font-bold text-white placeholder-zinc-700 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all shadow-inner"
                    autoFocus
                  />
                  <KeyRound className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}

              <div className="space-y-2 pt-1">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading || totpCode.length !== 6}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Validando código...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verificar y Entrar
                    </>
                  )}
                </motion.button>

                <button
                  type="button"
                  onClick={() => {
                    playTacticalClick();
                    setStep('credentials');
                    setErrorMsg(null);
                  }}
                  className="w-full py-2 rounded-xl text-zinc-400 hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver a credenciales
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Security Note Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-zinc-400" />
            Criptografía HMAC-SHA1
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <Sparkles className="w-3 h-3 text-white" />
            El Fuete Guardian
          </span>
        </div>
      </motion.div>
    </div>
  );
};
