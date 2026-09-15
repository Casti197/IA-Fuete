import { AssistantMessage, AssistantTask, AITool, UserProfile } from '../types';

export const ASSET_URLS = {
  emblem: 'https://lh3.googleusercontent.com/aida/AEtjO1Wm4FyJlrDGhThtMkClF7k1cSjNCuYWgD4RKDXd1CQFNChanC5GkgS1JxFAJ-lS4ND0uYB8M-wGqLQwFa78Hx4D8udGSNFTvNl9F2PwRCVJwuPzyp3bTxkZLTzb5pwQ0FdmUm4fEckG-LIxkMXvBlqodG5SABpBqnqVkQ82JQQEvYr9moZhR57Xb0QhNdCtesKTcieEc0rVY3F71-TcQWQJwBrVi60F-G5E8uWDxRFdNzmOJw4q22tMe6Dn',
};

export const DEFAULT_USER: UserProfile = {
  name: 'Alejo',
  email: 'alejocastiblan2007@gmail.com',
  role: 'Comandante Operativo',
};

export const getGreetingByHour = (userName: string = DEFAULT_USER.name): { greeting: string; message: string } => {
  const currentHour = new Date().getHours();
  let timeGreeting = 'Buenos días';
  if (currentHour >= 12 && currentHour < 19) {
    timeGreeting = 'Buenas tardes';
  } else if (currentHour >= 19 || currentHour < 5) {
    timeGreeting = 'Buenas noches';
  }

  return {
    greeting: timeGreeting,
    message: `¡${timeGreeting}, ${userName}! Soy El Fuete, tu asistente de inteligencia artificial. Tu sistema operativo está listo y al 100%. ¿Qué tarea o instrucción deseas que ejecutemos hoy?`,
  };
};

export const INITIAL_MESSAGES: AssistantMessage[] = [
  {
    id: 'msg-1',
    sender: 'assistant',
    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    text: getGreetingByHour(DEFAULT_USER.name).message,
    category: 'general',
    expectsResponse: true,
  },
];

export const INITIAL_TASKS: AssistantTask[] = [
  {
    id: 'task-1',
    title: 'Revisar propuesta estratégica de la semana',
    category: 'Prioridad',
    completed: false,
    time: '11:00 AM',
    notes: 'Preparar puntos clave para la reunión de equipo.',
  },
  {
    id: 'task-2',
    title: 'Aprobar borrador de comunicado mensual',
    category: 'Trabajo',
    completed: false,
    time: '02:30 PM',
    notes: 'Revisar cifras y tono ejecutivo.',
  },
  {
    id: 'task-3',
    title: 'Planificar objetivos del próximo trimestre',
    category: 'Idea',
    completed: true,
    time: 'Ayer',
    notes: 'Consolidadas las 3 metas clave.',
  },
];

export const AI_TOOLS: AITool[] = [
  {
    id: 'problem_solving',
    title: 'Resolución de Problemas',
    subtitle: 'Lógica, dudas y cálculos',
    icon: 'smart_toy',
    actionPrompt: 'Ayúdame a resolver este problema paso a paso y darme la solución más eficiente.',
    description: 'Resuelve cualquier dilema lógico, matemático, operativo o conceptual con explicaciones claras.',
  },
  {
    id: 'drafting',
    title: 'Redactor Inteligente',
    subtitle: 'Correos, discursos y notas',
    icon: 'edit_note',
    actionPrompt: 'Redacta un correo formal para confirmar una reunión estratégica el próximo lunes a las 10:00 AM.',
    description: 'Genera borradores persuasivos, claros y adaptados al tono que requieras en segundos.',
  },
  {
    id: 'summarizer',
    title: 'Resumen & Síntesis',
    subtitle: 'Extrae lo esencial',
    icon: 'summarize',
    actionPrompt: 'Resume los puntos clave de una reunión de 1 hora sobre reducción de costos operativos.',
    description: 'Condensa textos largos, minutas y artículos en listas procesables y ejecutivas.',
  },
  {
    id: 'planner',
    title: 'Planificador de Tareas',
    subtitle: 'Organización de agenda',
    icon: 'calendar_today',
    actionPrompt: 'Organiza mi tarde en 3 bloques de alta concentración y 1 pausa activa.',
    description: 'Estructura tu día de forma óptima priorizando tareas de alto impacto.',
  },
  {
    id: 'advisor',
    title: 'Consultas & Análisis',
    subtitle: 'Respuestas estratégicas',
    icon: 'psychology',
    actionPrompt: 'Analiza pros y contras de adoptar un modelo de trabajo híbrido flexible.',
    description: 'Proporciona marcos de decisión estructurados y análisis crítico inmediato.',
  },
];

