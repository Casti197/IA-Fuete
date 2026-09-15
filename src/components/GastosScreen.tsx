import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GastoItem, UserProfile } from '../types';
import {
  DEFAULT_APPS_SCRIPT_URL,
  MOCK_TEMPLATES,
  getNextRegistroNumber,
  getCurrentDateFormatted,
  getCurrentTimeFormatted,
  formatCurrency,
} from '../data/mockGastos';
import { playTacticalClick, playConfirmTone, playEmergencyTone } from '../utils/soundEffects';
import {
  Receipt,
  Plus,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Settings,
  FileSpreadsheet,
} from 'lucide-react';

interface GastosScreenProps {
  user: UserProfile;
  gastos: GastoItem[];
  onAddGasto: (gasto: Omit<GastoItem, 'id'>) => Promise<void> | void;
  onSendGastoToExcel: (gasto: GastoItem) => Promise<boolean>;
  onSendAllPending: () => Promise<void>;
  onDeleteGasto: (id: string) => void;
  onShowToast: (msg: string) => void;
  webhookUrl: string;
  onChangeWebhookUrl: (url: string) => void;
}

export const GastosScreen: React.FC<GastosScreenProps> = ({
  user,
  gastos,
  onAddGasto,
  onSendGastoToExcel,
  onSendAllPending,
  onDeleteGasto,
  onShowToast,
  webhookUrl,
  onChangeWebhookUrl,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'synced'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  // Form states
  const [formElemento, setFormElemento] = useState('');
  const [formMonto, setFormMonto] = useState<string>('25000');
  const [formCategoria, setFormCategoria] = useState<GastoItem['categoria']>('Alimentación');
  const [formFecha, setFormFecha] = useState(getCurrentDateFormatted());
  const [formHora, setFormHora] = useState(getCurrentTimeFormatted());
  const [autoSendToExcel, setAutoSendToExcel] = useState(true);

  // Stats calculations
  const totalAmount = gastos.reduce((acc, g) => acc + (Number(g.gasto) || 0), 0);
  const syncedCount = gastos.filter((g) => g.estadoEnvio === 'enviado').length;
  const pendingCount = gastos.filter((g) => g.estadoEnvio !== 'enviado').length;

  const filteredGastos = gastos.filter((g) => {
    if (filter === 'pending') return g.estadoEnvio !== 'enviado';
    if (filter === 'synced') return g.estadoEnvio === 'enviado';
    return true;
  });

  const handleOpenAdd = () => {
    playTacticalClick();
    setFormFecha(getCurrentDateFormatted());
    setFormHora(getCurrentTimeFormatted());
    setIsAdding(!isAdding);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formElemento.trim()) {
      playEmergencyTone();
      onShowToast('Ingresa el concepto del gasto');
      return;
    }

    const numericAmount = parseInt(formMonto.replace(/[\.,]/g, ''), 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      playEmergencyTone();
      onShowToast('Ingresa un monto válido mayor a cero');
      return;
    }

    playConfirmTone();
    const nextRegistro = getNextRegistroNumber(gastos);

    const newGastoData: Omit<GastoItem, 'id'> = {
      fecha: formFecha.trim() || getCurrentDateFormatted(),
      hora: formHora.trim() || getCurrentTimeFormatted(),
      registro: nextRegistro,
      gasto: numericAmount,
      elemento: formElemento.trim(),
      categoria: formCategoria,
      estadoEnvio: 'pendiente',
    };

    setIsAdding(false);
    setFormElemento('');
    setFormMonto('25000');

    await onAddGasto(newGastoData);

    if (autoSendToExcel) {
      // Find the item or let App.tsx handle immediate sync
      onShowToast(`Gasto "${newGastoData.elemento}" creado y enviando a Google Sheets...`);
    } else {
      onShowToast(`Gasto #${nextRegistro} registrado localmente.`);
    }
  };

  const handleGenerateMockGasto = async () => {
    playConfirmTone();
    const template = MOCK_TEMPLATES[Math.floor(Math.random() * MOCK_TEMPLATES.length)];
    const nextRegistro = getNextRegistroNumber(gastos);

    const mockItem: Omit<GastoItem, 'id'> = {
      fecha: getCurrentDateFormatted(),
      hora: getCurrentTimeFormatted(),
      registro: nextRegistro,
      gasto: template.gasto,
      elemento: template.elemento,
      categoria: template.categoria,
      estadoEnvio: 'pendiente',
    };

    await onAddGasto(mockItem);
    onShowToast(`Gasto mock generado: #${nextRegistro} - ${template.elemento}`);
  };

  const handleSendSingle = async (item: GastoItem) => {
    playTacticalClick();
    setSendingIds((prev) => new Set(prev).add(item.id));
    const success = await onSendGastoToExcel(item);
    setSendingIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });

    if (success) {
      playConfirmTone();
      onShowToast(`Gasto #${item.registro} guardado en Google Sheets.`);
    } else {
      playEmergencyTone();
      onShowToast(`Error al enviar gasto #${item.registro}.`);
    }
  };

  const handleSendAll = async () => {
    if (pendingCount === 0) {
      onShowToast('No hay gastos pendientes de sincronización.');
      return;
    }
    playConfirmTone();
    setIsSendingAll(true);
    await onSendAllPending();
    setIsSendingAll(false);
  };

  const handleTestWebhook = async () => {
    playTacticalClick();
    setIsTestingUrl(true);
    try {
      const response = await fetch('/api/gastos/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          gasto: {
            fecha: getCurrentDateFormatted(),
            hora: getCurrentTimeFormatted(),
            registro: 'TEST',
            gasto: 1000,
            elemento: 'Test de Conexión El Fuete',
          },
        }),
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        playConfirmTone();
        onShowToast('Conexión exitosa con Google Apps Script!');
      } else {
        playEmergencyTone();
        onShowToast(`Aviso: ${data.error || 'Respuesta no esperada del script'}`);
      }
    } catch (err: any) {
      playEmergencyTone();
      onShowToast(`Error de conexión: ${err.message}`);
    } finally {
      setIsTestingUrl(false);
    }
  };

  return (
    <div className="flex flex-col px-4 pt-3 pb-12 space-y-4 w-full">
      {/* Header Banner Finanzas */}
      <div className="p-4 rounded-2xl bg-[#121212] border border-white/10 shadow-sm relative overflow-hidden">
        {/* Subtle glow accent */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  Control de Gastos
                </span>
                <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
                  Registro y Excel Sync
                </h1>
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              playTacticalClick();
              setShowConfig(!showConfig);
            }}
            title="Ajustes de Google Sheets"
            className="p-2 rounded-xl bg-[#1a1a1a] border border-white/10 hover:border-white/25 text-zinc-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Total Metric Card */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-baseline justify-between">
          <div>
            <span className="text-[11px] font-mono text-zinc-400 block">Total Acumulado</span>
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {formatCurrency(totalAmount)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 block">Registros</span>
            <span className="text-xs font-mono font-bold text-zinc-300">
              <span className="text-emerald-400 font-bold">{syncedCount}</span> / {gastos.length} en Excel
            </span>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="mt-3 flex items-center justify-between p-2 rounded-xl bg-[#0a0a0a] border border-white/10 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-zinc-300 text-[11px] font-medium truncate max-w-[200px]">
              Google Sheets: En Línea
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">Apps Script Exec</span>
        </div>
      </div>

      {/* Webhook Configuration Drawer */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-3.5 rounded-xl bg-[#141414] border border-white/20 space-y-3 text-xs overflow-hidden shadow-lg"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                URL de Google Apps Script (Excel)
              </span>
              <button
                onClick={() => onChangeWebhookUrl(DEFAULT_APPS_SCRIPT_URL)}
                className="text-[10px] font-mono text-zinc-400 hover:text-white underline"
              >
                Restablecer URL
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Esta URL recibe las peticiones POST con los campos: <code className="text-white">fecha</code>,{' '}
              <code className="text-white">hora</code>, <code className="text-white">registro</code>,{' '}
              <code className="text-white">gasto</code> y <code className="text-white">elemento</code>.
            </p>

            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => onChangeWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-white font-mono text-[11px] focus:outline-none focus:border-white truncate"
              placeholder="https://script.google.com/macros/s/.../exec"
            />

            <div className="flex items-center justify-between pt-1">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestingUrl}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs flex items-center gap-1.5 transition-colors"
              >
                {isTestingUrl ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Probar Conexión
                  </>
                )}
              </motion.button>
              <button
                onClick={() => setShowConfig(false)}
                className="text-zinc-400 hover:text-white font-mono text-xs"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleOpenAdd}
          className="py-2.5 px-3 rounded-xl bg-white text-black font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{isAdding ? 'Cerrar Formulario' : 'Nuevo Gasto'}</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleGenerateMockGasto}
          className="py-2.5 px-3 rounded-xl bg-[#181818] hover:bg-[#222222] border border-white/15 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Gasto Mock Rápido</span>
        </motion.button>
      </div>

      {/* Add Gasto Form Drawer */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onSubmit={handleCreateSubmit}
            className="p-4 rounded-2xl bg-[#141414] border border-white/20 space-y-3 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Registrar Nuevo Gasto
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Reg #{getNextRegistroNumber(gastos)}
              </span>
            </div>

            {/* Elemento / Concepto */}
            <div>
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                Elemento / Concepto
              </label>
              <input
                type="text"
                value={formElemento}
                onChange={(e) => setFormElemento(e.target.value)}
                placeholder="Ej. Almuerzo ejecutivo, Taxi aeropuerto, Licencia Figma..."
                className="w-full px-3 py-2 rounded-xl bg-black border border-white/20 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                autoFocus
              />
            </div>

            {/* Gasto (Monto) y Categoría */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Monto ($ COP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value)}
                    placeholder="25000"
                    step="100"
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Categoría
                </label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value as GastoItem['categoria'])}
                  className="w-full px-2.5 py-2 rounded-xl bg-black border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-white transition-colors"
                >
                  <option value="Alimentación">Alimentación</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Tecnología">Tecnología</option>
                  <option value="Oficina">Oficina</option>
                  <option value="Servicios">Servicios</option>
                  <option value="Personal">Personal</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Fecha (DD/MM/YYYY)
                </label>
                <input
                  type="text"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-400 block mb-1">
                  Hora (HH:mm)
                </label>
                <input
                  type="text"
                  value={formHora}
                  onChange={(e) => setFormHora(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-white"
                />
              </div>
            </div>

            {/* Auto send toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/60 border border-white/10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-white font-mono">Enviar a Google Sheets al guardar</span>
              </div>
              <input
                type="checkbox"
                checked={autoSendToExcel}
                onChange={(e) => setAutoSendToExcel(e.target.checked)}
                className="w-4 h-4 accent-white rounded cursor-pointer"
              />
            </div>

            {/* Submit & Cancel */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 rounded-xl bg-[#242424] text-zinc-300 hover:text-white text-xs font-mono"
              >
                Cancelar
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="submit"
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-mono font-bold hover:bg-zinc-200 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Guardar Gasto</span>
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filter Tabs & Batch Sync */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 p-1 rounded-xl bg-[#141414] border border-white/10 text-xs font-mono flex-1">
          <button
            type="button"
            onClick={() => {
              playTacticalClick();
              setFilter('all');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({gastos.length})
          </button>
          <button
            type="button"
            onClick={() => {
              playTacticalClick();
              setFilter('pending');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              filter === 'pending'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => {
              playTacticalClick();
              setFilter('synced');
            }}
            className={`flex-1 py-1.5 rounded-lg transition-colors ${
              filter === 'synced'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Excel ({syncedCount})
          </button>
        </div>

        {pendingCount > 0 && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={handleSendAll}
            disabled={isSendingAll}
            title="Sincronizar todos los pendientes con Google Sheets"
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSendingAll ? 'animate-spin' : ''}`} />
            <span>Sincronizar ({pendingCount})</span>
          </motion.button>
        )}
      </div>

      {/* List of Gastos */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredGastos.length === 0 ? (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="p-8 rounded-2xl bg-[#121212] border border-white/10 flex flex-col items-center justify-center text-center space-y-2 shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">Sin gastos en esta lista</h3>
              <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed">
                {filter === 'pending'
                  ? 'Todos tus gastos están sincronizados con la hoja de Google Sheets.'
                  : 'Registra tu primer gasto o genera datos mock para probar la conexión con Excel.'}
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={handleGenerateMockGasto}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-white text-black font-mono text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar Gasto Mock</span>
              </motion.button>
            </motion.div>
          ) : (
            filteredGastos.map((item) => {
              const isSending = sendingIds.has(item.id);
              const isSynced = item.estadoEnvio === 'enviado';

              return (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 350 }}
                  className={`p-3.5 rounded-2xl bg-[#121212] border transition-all ${
                    isSynced
                      ? 'border-white/10'
                      : 'border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.05)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white font-mono text-[10px] font-bold">
                          #{item.registro}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {item.elemento}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300 font-mono text-[9px] uppercase">
                          {item.categoria || 'General'}
                        </span>
                        <span className="text-zinc-500 font-mono text-[10px] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {item.fecha} {item.hora}
                        </span>
                      </div>

                      {/* Status pill */}
                      <div className="mt-2 flex items-center gap-1.5">
                        {isSynced ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Sincronizado con Excel
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Pendiente de envío
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-mono font-bold text-white tracking-tight">
                        {formatCurrency(item.gasto)}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {!isSynced && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            type="button"
                            onClick={() => handleSendSingle(item)}
                            disabled={isSending}
                            title="Enviar a Google Sheets"
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            {isSending ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>{isSending ? 'Enviando...' : 'Enviar'}</span>
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.15, color: '#f87171' }}
                          whileTap={{ scale: 0.9 }}
                          type="button"
                          onClick={() => {
                            playTacticalClick();
                            onDeleteGasto(item.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info Box */}
      <div className="p-3.5 rounded-xl bg-[#0f0f0f] border border-white/10 text-zinc-400 text-xs font-mono space-y-1">
        <div className="flex items-center gap-1.5 text-white font-semibold">
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>Integración Google Sheets Activa</span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Cada gasto enviado se añade automáticamente como una nueva fila en tu hoja de cálculo mediante Google Apps Script.
        </p>
      </div>
    </div>
  );
};
