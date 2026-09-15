import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  QrCode,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import { playTacticalClick, playConfirmTone, playEmergencyTone } from '../utils/soundEffects';
import { UserProfile } from '../types';

interface TwoFactorSectionProps {
  user: UserProfile;
  onStatusChange: (enabled: boolean, enabledAt?: string) => void;
  onShowToast?: (msg: string) => void;
}

export const TwoFactorSection: React.FC<TwoFactorSectionProps> = ({
  user,
  onStatusChange,
  onShowToast,
}) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(!!user.twoFactorEnabled);
  const [enabledAt, setEnabledAt] = useState<string | undefined>(user.twoFactorEnabledAt);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Setup state
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secretBase32, setSecretBase32] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Test code state (when enabled)
  const [isTestingCode, setIsTestingCode] = useState(false);
  const [testToken, setTestToken] = useState('');
  const [isVerifyingTest, setIsVerifyingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Disable state (when enabled)
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [isSubmittingDisable, setIsSubmittingDisable] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const userId = user.email || user.name || 'alejo';

  // Fetch current 2FA status from backend on mount
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        setIsLoadingStatus(true);
        const res = await fetch(`/api/2fa/status?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setIsEnabled(!!data.enabled);
            setEnabledAt(data.enabledAt || undefined);
            onStatusChange(!!data.enabled, data.enabledAt || undefined);
          }
        }
      } catch (err) {
        console.warn('Error fetching 2FA status:', err);
      } finally {
        if (isMounted) setIsLoadingStatus(false);
      }
    };

    checkStatus();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Start setup flow: call backend to generate TOTP secret & QR code
  const handleStartSetup = async () => {
    playTacticalClick();
    setIsSettingUp(true);
    setIsGenerating(true);
    setSetupError(null);
    setSetupToken('');

    try {
      const res = await fetch('/api/2fa/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          userEmail: user.email || `${user.name.toLowerCase()}@elfuete.ai`,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al generar la configuración TOTP.');
      }

      const data = await res.json();
      setQrCode(data.qrCode);
      setSecretBase32(data.secretBase32);
      playConfirmTone();
    } catch (err: any) {
      playEmergencyTone();
      setSetupError(err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Cancel setup
  const handleCancelSetup = () => {
    playTacticalClick();
    setIsSettingUp(false);
    setQrCode(null);
    setSecretBase32(null);
    setSetupToken('');
    setSetupError(null);
  };

  // Copy secret key
  const handleCopySecret = () => {
    if (!secretBase32) return;
    playTacticalClick();
    navigator.clipboard.writeText(secretBase32).then(() => {
      setCopiedKey(true);
      if (onShowToast) onShowToast('Clave secreta copiada al portapapeles');
      setTimeout(() => setCopiedKey(false), 2500);
    });
  };

  // Submit token to verify and officially activate 2FA
  const handleVerifyAndActivate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = setupToken.replace(/\s+/g, '');
    if (cleanToken.length !== 6) {
      setSetupError('Ingresa los 6 dígitos numéricos de tu app');
      return;
    }

    setIsVerifyingSetup(true);
    setSetupError(null);

    try {
      const res = await fetch('/api/2fa/verify-and-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          token: cleanToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        playEmergencyTone();
        setSetupError(data.error || 'Código incorrecto. Intenta nuevamente.');
        return;
      }

      // Success
      playConfirmTone();
      setIsEnabled(true);
      const nowIso = new Date().toISOString();
      setEnabledAt(nowIso);
      onStatusChange(true, nowIso);
      setIsSettingUp(false);
      setQrCode(null);
      setSecretBase32(null);
      setSetupToken('');
      if (onShowToast) onShowToast('¡Autenticación de dos factores activada con éxito!');
    } catch (err: any) {
      playEmergencyTone();
      setSetupError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsVerifyingSetup(false);
    }
  };

  // Test current code
  const handleVerifyTestAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = testToken.replace(/\s+/g, '');
    if (cleanToken.length !== 6) {
      setTestFeedback({ success: false, message: 'Ingresa un código de 6 dígitos.' });
      return;
    }

    setIsVerifyingTest(true);
    setTestFeedback(null);

    try {
      const res = await fetch('/api/2fa/verify-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          token: cleanToken,
          actionName: 'Prueba de sincronización',
        }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        playConfirmTone();
        setTestFeedback({ success: true, message: '¡Código válido! Tu autenticador está sincronizado.' });
      } else {
        playEmergencyTone();
        setTestFeedback({ success: false, message: data.error || 'Código incorrecto o expirado.' });
      }
    } catch {
      playEmergencyTone();
      setTestFeedback({ success: false, message: 'Error al contactar con el servidor.' });
    } finally {
      setIsVerifyingTest(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = disableToken.replace(/\s+/g, '');
    if (cleanToken.length !== 6) {
      setDisableError('Ingresa el código actual de 6 dígitos para confirmar la desactivación.');
      return;
    }

    setIsSubmittingDisable(true);
    setDisableError(null);

    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          token: cleanToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        playEmergencyTone();
        setDisableError(data.error || 'Código incorrecto. No se pudo desactivar.');
        return;
      }

      playConfirmTone();
      setIsEnabled(false);
      setEnabledAt(undefined);
      onStatusChange(false, undefined);
      setIsDisabling(false);
      setDisableToken('');
      if (onShowToast) onShowToast('Autenticación de dos factores desactivada.');
    } catch (err: any) {
      playEmergencyTone();
      setDisableError(err.message || 'Error de conexión.');
    } finally {
      setIsSubmittingDisable(false);
    }
  };

  return (
    <div className="w-full flex flex-col p-3.5 rounded-xl bg-[#141414] border border-white/10 text-left space-y-3">
      {/* Header and status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-zinc-400" />
          )}
          <span className="text-[11px] font-mono uppercase text-zinc-200 font-semibold tracking-wide">
            Autenticación 2FA // TOTP
          </span>
        </div>

        {isLoadingStatus ? (
          <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-400">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
            Verificando
          </span>
        ) : isEnabled ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ACTIVO
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 font-mono text-[9px]">
            INACTIVO
          </span>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {isEnabled
          ? 'Tu cuenta está protegida con verificación TOTP en tiempo real compatible con Google Authenticator y Microsoft Authenticator.'
          : 'Añade una capa de protección criptográfica a tu perfil mediante tokens temporales de 6 dígitos.'}
      </p>

      {/* Case 1: 2FA is NOT enabled and NOT in setup mode */}
      {!isEnabled && !isSettingUp && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={handleStartSetup}
          className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-mono text-xs flex items-center justify-center gap-2 transition-colors font-medium"
        >
          <QrCode className="w-3.5 h-3.5 text-white" />
          Activar Autenticador (Google / Microsoft)
        </motion.button>
      )}

      {/* Case 2: 2FA Setup Flow (Generating / Showing QR / Verifying token) */}
      <AnimatePresence>
        {!isEnabled && isSettingUp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3 pt-2 border-t border-white/10 overflow-hidden"
          >
            {isGenerating ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
                <span className="font-mono text-xs text-zinc-400">
                  Generando clave criptográfica y código QR...
                </span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-300 font-semibold uppercase block">
                    Paso 1: Escanea el código con tu aplicación
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Abre <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> y escanea:
                  </p>
                </div>

                {/* QR Code display */}
                {qrCode && (
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-zinc-300 shadow-inner">
                    <img
                      src={qrCode}
                      alt="Código QR Autenticador TOTP"
                      className="w-44 h-44 object-contain"
                    />
                    <span className="text-[9px] font-mono text-zinc-700 mt-1 font-semibold uppercase tracking-wider">
                      El Fuete // TOTP 6 DÍGITOS
                    </span>
                  </div>
                )}

                {/* Manual Secret Key */}
                {secretBase32 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-zinc-400 uppercase">
                      ¿No puedes escanear? Clave secreta manual:
                    </span>
                    <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black border border-white/20">
                      <KeyRound className="w-3.5 h-3.5 text-zinc-400 ml-1 shrink-0" />
                      <span className="font-mono text-[11px] text-zinc-200 tracking-wider flex-1 select-all break-all">
                        {secretBase32}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-mono text-[10px] flex items-center gap-1 transition-colors shrink-0"
                        title="Copiar clave"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedKey ? '¡Listo!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Token Verification Input */}
                <form onSubmit={handleVerifyAndActivate} className="space-y-2 pt-1">
                  <label className="text-[10px] font-mono text-zinc-300 font-semibold uppercase block">
                    Paso 2: Ingresa el código de 6 dígitos generado
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={setupToken}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSetupToken(val);
                        if (setupError) setSetupError(null);
                      }}
                      placeholder="000 000"
                      className="flex-1 px-3 py-2 rounded-lg bg-black border border-white/20 text-center font-mono text-base tracking-[0.3em] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
                      autoFocus
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={setupToken.length !== 6 || isVerifyingSetup}
                      className="px-4 py-2 rounded-lg bg-white text-black font-mono text-xs font-bold uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isVerifyingSetup ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Verificar
                    </motion.button>
                  </div>

                  {setupError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-1.5 p-2 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-[11px]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <span>{setupError}</span>
                    </motion.div>
                  )}
                </form>

                {/* Cancel button */}
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  className="w-full py-1 text-center font-mono text-[10px] text-zinc-400 hover:text-white transition-colors"
                >
                  Cancelar configuración
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Case 3: 2FA is ENABLED -> Show Status, Test Code & Deactivation Options */}
      {isEnabled && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          {enabledAt && (
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span>Activado el:</span>
              <span className="text-zinc-200">
                {new Date(enabledAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Action toggle buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                playTacticalClick();
                setIsTestingCode(!isTestingCode);
                setIsDisabling(false);
                setTestFeedback(null);
                setTestToken('');
              }}
              className={`py-1.5 px-2 rounded-lg font-mono text-[10px] border transition-colors flex items-center justify-center gap-1.5 ${
                isTestingCode
                  ? 'bg-white text-black border-white font-bold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
              }`}
            >
              <Lock className="w-3 h-3" />
              Probar Código
            </button>

            <button
              type="button"
              onClick={() => {
                playTacticalClick();
                setIsDisabling(!isDisabling);
                setIsTestingCode(false);
                setDisableError(null);
                setDisableToken('');
              }}
              className={`py-1.5 px-2 rounded-lg font-mono text-[10px] border transition-colors flex items-center justify-center gap-1.5 ${
                isDisabling
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                  : 'bg-white/5 hover:bg-red-950/20 border-white/10 hover:border-red-900/30 text-zinc-400 hover:text-red-400'
              }`}
            >
              <Unlock className="w-3 h-3" />
              Desactivar 2FA
            </button>
          </div>

          {/* Subview: Test TOTP Code */}
          <AnimatePresence>
            {isTestingCode && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleVerifyTestAction}
                className="p-2.5 rounded-lg bg-black/60 border border-white/15 space-y-2 overflow-hidden"
              >
                <label className="text-[10px] font-mono text-zinc-300 block">
                  Introduce el código actual de tu aplicación para probarlo:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={testToken}
                    onChange={(e) => setTestToken(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="flex-1 px-3 py-1.5 rounded-md bg-[#141414] border border-white/20 text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:border-white"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={testToken.length !== 6 || isVerifyingTest}
                    className="px-3 py-1.5 rounded-md bg-white text-black font-mono text-xs font-semibold disabled:opacity-40"
                  >
                    {isVerifyingTest ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Verificar'}
                  </button>
                </div>
                {testFeedback && (
                  <div
                    className={`p-2 rounded font-mono text-[10px] flex items-center gap-1.5 ${
                      testFeedback.success
                        ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300'
                        : 'bg-red-950/40 border border-red-800/40 text-red-300'
                    }`}
                  >
                    {testFeedback.success ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                    )}
                    <span>{testFeedback.message}</span>
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          {/* Subview: Disable 2FA with current code confirmation */}
          <AnimatePresence>
            {isDisabling && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleDisable2FA}
                className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/40 space-y-2 overflow-hidden"
              >
                <div className="flex items-start gap-1.5 text-[10px] text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span>
                    Por seguridad, introduce el código de 6 dígitos actual de tu autenticador para desactivar el 2FA:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={disableToken}
                    onChange={(e) => setDisableToken(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000000"
                    className="flex-1 px-3 py-1.5 rounded-md bg-black border border-red-900/50 text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={disableToken.length !== 6 || isSubmittingDisable}
                    className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold disabled:opacity-40"
                  >
                    {isSubmittingDisable ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                  </button>
                </div>
                {disableError && (
                  <p className="text-[10px] font-mono text-red-400">{disableError}</p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
