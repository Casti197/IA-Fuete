import { GastoItem } from '../types';

export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz_vjjGyz-ZlLWrkqvlRvba_S22ybiDsSC2pnszfMwHCwrl2kJ_fxrob2oaQf258zjGOQ/exec';

export const INITIAL_GASTOS: GastoItem[] = [
  {
    id: 'gasto-1',
    fecha: '15/09/2026',
    hora: '15:54',
    registro: '001',
    gasto: 25000,
    elemento: 'Almuerzo',
    categoria: 'Alimentación',
    estadoEnvio: 'enviado',
    enviadoAt: '15/09/2026 15:55',
  },
  {
    id: 'gasto-2',
    fecha: '15/09/2026',
    hora: '11:20',
    registro: '002',
    gasto: 14500,
    elemento: 'Transporte Taxi reunión',
    categoria: 'Transporte',
    estadoEnvio: 'enviado',
    enviadoAt: '15/09/2026 11:21',
  },
  {
    id: 'gasto-3',
    fecha: '15/09/2026',
    hora: '09:15',
    registro: '003',
    gasto: 8200,
    elemento: 'Café de especialidad y snack',
    categoria: 'Alimentación',
    estadoEnvio: 'pendiente',
  },
  {
    id: 'gasto-4',
    fecha: '14/09/2026',
    hora: '18:30',
    registro: '004',
    gasto: 65000,
    elemento: 'Suscripción Servidor Cloud',
    categoria: 'Tecnología',
    estadoEnvio: 'enviado',
    enviadoAt: '14/09/2026 18:31',
  },
  {
    id: 'gasto-5',
    fecha: '14/09/2026',
    hora: '14:10',
    registro: '005',
    gasto: 42000,
    elemento: 'Papelería y material de oficina',
    categoria: 'Oficina',
    estadoEnvio: 'pendiente',
  },
  {
    id: 'gasto-6',
    fecha: '13/09/2026',
    hora: '16:45',
    registro: '006',
    gasto: 35000,
    elemento: 'Combustible vehículo',
    categoria: 'Transporte',
    estadoEnvio: 'enviado',
    enviadoAt: '13/09/2026 16:46',
  },
];

export const MOCK_TEMPLATES = [
  { elemento: 'Almuerzo ejecutivo', gasto: 28000, categoria: 'Alimentación' as const },
  { elemento: 'Transporte Uber / Taxi', gasto: 16500, categoria: 'Transporte' as const },
  { elemento: 'Cafetería y refrigerio', gasto: 9500, categoria: 'Alimentación' as const },
  { elemento: 'Recarga saldo móvil', gasto: 20000, categoria: 'Servicios' as const },
  { elemento: 'Insumos de oficina', gasto: 34000, categoria: 'Oficina' as const },
  { elemento: 'Herramientas de software', gasto: 48000, categoria: 'Tecnología' as const },
  { elemento: 'Cena de trabajo', gasto: 52000, categoria: 'Alimentación' as const },
  { elemento: 'Parqueadero y peajes', gasto: 12000, categoria: 'Transporte' as const },
];

export function getNextRegistroNumber(existing: GastoItem[]): string {
  if (existing.length === 0) return '001';
  const numericValues = existing
    .map((g) => parseInt(g.registro, 10))
    .filter((n) => !isNaN(n));
  const max = numericValues.length > 0 ? Math.max(...numericValues) : existing.length;
  return String(max + 1).padStart(3, '0');
}

export function getCurrentDateFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getCurrentTimeFormatted(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}
