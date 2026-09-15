export type AppTab = 'asistente' | 'gastos';

export interface GastoItem {
  id: string;
  fecha: string;      // Formato DD/MM/YYYY (ej. "15/09/2026")
  hora: string;       // Formato HH:mm (ej. "15:54")
  registro: string;   // Formato correlativo (ej. "001", "002")
  gasto: number;      // Monto numérico (ej. 25000)
  elemento: string;   // Concepto / ítem (ej. "Almuerzo")
  categoria?: 'Alimentación' | 'Transporte' | 'Tecnología' | 'Oficina' | 'Servicios' | 'Personal' | 'Otro';
  estadoEnvio?: 'pendiente' | 'enviado' | 'error';
  enviadoAt?: string;
  errorMsg?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  category?: 'general' | 'task' | 'draft' | 'summary';
  expectsResponse?: boolean;
  createdTask?: AssistantTask;
  action?: AssistantInstructionAction;
  createdGasto?: GastoItem;
}

export interface AssistantTask {
  id: string;
  title: string;
  category: 'Trabajo' | 'Personal' | 'Prioridad' | 'Idea';
  completed: boolean;
  time: string;
  notes?: string;
}

export interface UserProfile {
  name: string;
  email?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  twoFactorEnabledAt?: string;
}

export interface AssistantInstructionAction {
  type: 'CREATE_TASK' | 'COMPLETE_TASK' | 'DELETE_TASK' | 'CLEAR_COMPLETED' | 'REGISTRAR_GASTO' | 'NONE';
  title?: string;
  category?: 'Trabajo' | 'Personal' | 'Prioridad' | 'Idea' | string;
  target?: string;
  time?: string;
  notes?: string;
  gasto?: number;
  elemento?: string;
}

export interface AITool {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  actionPrompt: string;
  description: string;
}

export interface DetailData {
  title: string;
  category: string;
  status: string;
  description: string;
  meta: { label: string; value: string }[];
  actions?: { label: string; primary?: boolean; onClick?: () => void }[];
}
