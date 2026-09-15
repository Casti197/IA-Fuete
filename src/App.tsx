/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantMessage, AssistantTask, DetailData, AssistantInstructionAction, UserProfile, AppTab, GastoItem } from './types';
import { INITIAL_MESSAGES, INITIAL_TASKS, DEFAULT_USER } from './data/mockData';
import { TopHeader } from './components/TopHeader';
import { DashboardScreen } from './components/DashboardScreen';
import { GastosScreen } from './components/GastosScreen';
import { DetailModal } from './components/DetailModal';
import { ProfileModal } from './components/ProfileModal';
import { NotificationsModal } from './components/NotificationsModal';
import { LoginScreen } from './components/LoginScreen';
import { playConfirmTone, playTacticalClick } from './utils/soundEffects';
import {
  DEFAULT_APPS_SCRIPT_URL,
  INITIAL_GASTOS,
  getNextRegistroNumber,
  getCurrentDateFormatted,
  getCurrentTimeFormatted,
} from './data/mockGastos';

// Helper to detect if message awaits a response
export const checkExpectsResponse = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.includes('?') || trimmed.includes('¿')) return true;
  const lower = trimmed.toLowerCase();
  const expectationPhrases = [
    /\b(dime|cuéntame|cuentame|avísame|avisame|confírmame|confirmame|respóndeme|respondeme)\b/i,
    /\b(te escucho|estoy listo para escucharte|adelante, habla)\b/i,
    /\b(esperando tu respuesta|espero tu respuesta|espero tu confirmación|espero tu confirmacion)\b/i,
    /\b(indícame|indicame|aclárame|aclarame|hazme saber)\b/i,
    /\b(qué opinas|que opinas|te parece|estás de acuerdo|estas de acuerdo)\b/i,
    /\b(deseas|quieres|te gustaría|te gustaria)\b/i,
    /\b(cuál es tu|cual es tu|cuál prefieres|cual prefieres)\b/i,
    /\b(en qué te ayudo|en que te ayudo|en qué puedo|en que puedo)\b/i,
  ];
  return expectationPhrases.some((p) => p.test(lower));
};

export default function App() {
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('el_fuete_user');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_USER;
  });
  const [messages, setMessages] = useState<AssistantMessage[]>(INITIAL_MESSAGES);
  const [tasks, setTasks] = useState<AssistantTask[]>(INITIAL_TASKS);

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem('el_fuete_user', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    showToast(`Perfil de usuario actualizado: ${updated.name || user.name}`);
  };

  // Auth session state (Login with 2FA support and auto-expiration)
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('el_fuete_session_timeout');
      return stored ? Number(stored) : 60; // 60 minutes default (1 hour)
    } catch {
      return 60;
    }
  });

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const sessionRaw = localStorage.getItem('el_fuete_session');
      if (!sessionRaw) return false;
      const parsed = JSON.parse(sessionRaw);
      const lastActive = parsed.lastActive ? new Date(parsed.lastActive).getTime() : new Date(parsed.loggedAt).getTime();
      const timeoutMs = (Number(localStorage.getItem('el_fuete_session_timeout')) || 60) * 60 * 1000;
      if (Date.now() - lastActive > timeoutMs) {
        localStorage.removeItem('el_fuete_session');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  // Track user activity to refresh lastActive and auto-logout if expired
  useEffect(() => {
    if (!isAuthenticated) return;

    // Refresh last active timestamp
    const updateActivity = () => {
      try {
        const sessionRaw = localStorage.getItem('el_fuete_session');
        if (sessionRaw) {
          const parsed = JSON.parse(sessionRaw);
          parsed.lastActive = new Date().toISOString();
          localStorage.setItem('el_fuete_session', JSON.stringify(parsed));
        }
      } catch {
        // ignore
      }
    };

    // Check expiration periodically (every 10 seconds)
    const checkSessionInterval = setInterval(() => {
      try {
        const sessionRaw = localStorage.getItem('el_fuete_session');
        if (!sessionRaw) {
          setIsAuthenticated(false);
          return;
        }
        const parsed = JSON.parse(sessionRaw);
        const lastActiveTime = parsed.lastActive
          ? new Date(parsed.lastActive).getTime()
          : new Date(parsed.loggedAt).getTime();
        const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

        if (Date.now() - lastActiveTime >= timeoutMs) {
          localStorage.removeItem('el_fuete_session');
          setIsAuthenticated(false);
          setSessionExpiredNotice(
            `Tu sesión expiró tras ${sessionTimeoutMinutes} min de inactividad por seguridad.`
          );
        }
      } catch {
        // ignore
      }
    }, 10000);

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleUserInteraction = () => {
      updateActivity();
    };

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleUserInteraction, { passive: true })
    );

    return () => {
      clearInterval(checkSessionInterval);
      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, handleUserInteraction)
      );
    };
  }, [isAuthenticated, sessionTimeoutMinutes]);

  const handleChangeTimeoutMinutes = (mins: number) => {
    setSessionTimeoutMinutes(mins);
    try {
      localStorage.setItem('el_fuete_session_timeout', mins.toString());
    } catch {
      // ignore
    }
    showToast(`Cierre automático ajustado a ${mins} minutos.`);
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    const now = new Date().toISOString();
    setUser((prev) => {
      const next = { ...prev, ...loggedInUser };
      try {
        localStorage.setItem('el_fuete_user', JSON.stringify(next));
        localStorage.setItem(
          'el_fuete_session',
          JSON.stringify({
            userId: loggedInUser.email || loggedInUser.name,
            loggedAt: now,
            lastActive: now,
          })
        );
      } catch {
        // ignore
      }
      return next;
    });
    setSessionExpiredNotice(null);
    setIsAuthenticated(true);
    showToast(`Bienvenido a El Fuete, ${loggedInUser.name}`);
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('el_fuete_session');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setSessionExpiredNotice(null);
    showToast('Sesión finalizada.');
  };

  // Navigation and Gastos (Google Apps Script) state
  const [currentTab, setCurrentTab] = useState<AppTab>('asistente');
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('el_fuete_gastos_url');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return DEFAULT_APPS_SCRIPT_URL;
  });

  const [gastos, setGastos] = useState<GastoItem[]>(() => {
    try {
      const saved = localStorage.getItem('el_fuete_gastos');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_GASTOS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('el_fuete_gastos', JSON.stringify(gastos));
    } catch {
      // ignore
    }
  }, [gastos]);

  const handleChangeWebhookUrl = (newUrl: string) => {
    setWebhookUrl(newUrl);
    try {
      localStorage.setItem('el_fuete_gastos_url', newUrl);
    } catch {
      // ignore
    }
  };

  const handleSendGastoToExcel = async (item: GastoItem): Promise<boolean> => {
    try {
      const response = await fetch('/api/gastos/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          gasto: {
            fecha: item.fecha,
            hora: item.hora,
            registro: item.registro,
            gasto: Number(item.gasto) || 0,
            elemento: item.elemento,
          },
        }),
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        setGastos((prev) =>
          prev.map((g) =>
            g.id === item.id
              ? {
                  ...g,
                  estadoEnvio: 'enviado',
                  enviadoAt: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                }
              : g
          )
        );
        return true;
      } else {
        setGastos((prev) =>
          prev.map((g) => (g.id === item.id ? { ...g, estadoEnvio: 'error' } : g))
        );
        return false;
      }
    } catch {
      setGastos((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, estadoEnvio: 'error' } : g))
      );
      return false;
    }
  };

  const handleAddGasto = async (newGastoData: Omit<GastoItem, 'id'>) => {
    const newItem: GastoItem = {
      ...newGastoData,
      id: `gasto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    setGastos((prev) => [newItem, ...prev]);

    // Send to Google Sheets
    await handleSendGastoToExcel(newItem);
  };

  const handleSendAllPending = async () => {
    const pending = gastos.filter((g) => g.estadoEnvio !== 'enviado');
    if (pending.length === 0) return;

    let successCount = 0;
    for (const item of pending) {
      const ok = await handleSendGastoToExcel(item);
      if (ok) successCount++;
    }

    showToast(`Sincronizados ${successCount} de ${pending.length} gastos con Google Sheets.`);
  };

  const handleDeleteGasto = (id: string) => {
    setGastos((prev) => prev.filter((g) => g.id !== id));
    showToast('Gasto eliminado.');
  };

  // Modals state
  const [voiceTriggerCount, setVoiceTriggerCount] = useState(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const [activeDetail, setActiveDetail] = useState<DetailData | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleOpenVoice = () => {
    setVoiceTriggerCount((prev) => prev + 1);
  };

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const generateAIResponse = (userText: string): { responseText: string; detectedTask?: string; action?: AssistantInstructionAction } => {
    const lower = userText.toLowerCase().trim();

    // 1. Mark task completed
    if (
      lower.includes('completa la tarea') ||
      lower.includes('marcar como completada') ||
      lower.includes('marca como completada') ||
      lower.includes('completar tarea') ||
      lower.includes('ya completé') ||
      lower.includes('ya termine') ||
      lower.includes('ya hice') ||
      lower.includes('marcar tarea')
    ) {
      const target = userText
        .replace(/^(completa la tarea de|completa la tarea|marcar como completada la tarea de|marca como completada la tarea de|marca como completada|ya completé la tarea de|ya hice la tarea de|ya termine la tarea de|marcar tarea)\s*/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      return {
        responseText: target ? `He marcado como completada la tarea "${target}". Excelente avance.` : `He marcado la tarea indicada como completada.`,
        action: { type: 'COMPLETE_TASK', target },
      };
    }

    // 2. Delete task
    if (
      lower.includes('elimina la tarea') ||
      lower.includes('borra la tarea') ||
      lower.includes('quitar la tarea') ||
      lower.includes('eliminar tarea') ||
      lower.includes('borrar tarea')
    ) {
      const target = userText
        .replace(/^(elimina la tarea de|borra la tarea de|quitar la tarea de|eliminar la tarea de|borra la tarea|elimina la tarea)\s*/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      return {
        responseText: target ? `He eliminado la tarea "${target}" de tu lista.` : `He eliminado la tarea seleccionada.`,
        action: { type: 'DELETE_TASK', target },
      };
    }

    // 3. Clear completed tasks
    if (
      lower.includes('limpia las tareas completadas') ||
      lower.includes('borra las tareas completadas') ||
      lower.includes('limpiar completadas') ||
      lower.includes('borrar completadas')
    ) {
      return {
        responseText: `He limpiado todas las tareas completadas para mantener tu agenda despejada.`,
        action: { type: 'CLEAR_COMPLETED' },
      };
    }

    // 4. Inquire about current pending tasks
    if (
      lower.includes('qué tareas tengo') ||
      lower.includes('que tareas tengo') ||
      lower.includes('cuáles son mis tareas') ||
      lower.includes('cuales son mis tareas') ||
      lower.includes('mis tareas pendientes') ||
      lower.includes('tareas pendientes') ||
      lower.includes('ver mis tareas') ||
      lower.includes('muestra mis tareas')
    ) {
      const pending = tasks.filter((t) => !t.completed);
      if (pending.length === 0) {
        return {
          responseText: `No tienes tareas pendientes registradas en este momento. ¿Deseas crear una nueva tarea para hoy?`,
        };
      }
      const listNames = pending.slice(0, 3).map((t) => `"${t.title}" (${t.category})`).join(', ');
      const moreCount = pending.length > 3 ? ` y ${pending.length - 3} más` : '';
      return {
        responseText: `Tienes ${pending.length} tareas pendientes: ${listNames}${moreCount}. ¿Deseas que complete alguna o creamos una nueva?`,
      };
    }

    // 5. Interactive prompt when user asks to create a task without naming it
    const isGenericCreateRequest =
      lower === 'crea una tarea' ||
      lower === 'crear una tarea' ||
      lower === 'crear tarea' ||
      lower === 'quiero crear una tarea' ||
      lower === 'nueva tarea' ||
      lower === 'anota una tarea' ||
      lower === 'anotar tarea' ||
      lower === 'agrega una tarea' ||
      lower === 'ayúdame a crear una tarea';

    if (isGenericCreateRequest) {
      return {
        responseText: `¡Listo para registrarla! Dime qué tarea deseas crear, para cuándo la necesitas y en qué categoría (Trabajo, Personal, Prioridad o Idea).`,
      };
    }

    // 6. Task management & Reminders with details
    if (
      lower.startsWith('recuérdame') ||
      lower.startsWith('recuerdame') ||
      lower.includes('crea una tarea') ||
      lower.includes('crear tarea') ||
      lower.includes('añade la tarea') ||
      lower.includes('agrega la tarea') ||
      lower.includes('nueva tarea') ||
      lower.includes('anota en mi agenda') ||
      lower.includes('anota que') ||
      lower.includes('anotar que') ||
      lower.includes('anota') ||
      lower.includes('tengo que')
    ) {
      const cleanTitle = userText
        .replace(/^(recuérdame|recuerdame|por favor recuérdame|crea una tarea para|crea una tarea de|crear tarea de|crear tarea|añade la tarea de|añade la tarea|agrega la tarea de|agrega la tarea|nueva tarea de|nueva tarea|tengo que|anota en mi agenda que|anota en mi agenda|anota que|anotar que|anota)\s*/i, '')
        .replace(/[.!?]+$/, '')
        .trim();

      if (cleanTitle.length >= 2) {
        const taskName = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
        let cat: AssistantTask['category'] = 'Prioridad';
        if (lower.includes('reunión') || lower.includes('informe') || lower.includes('correo') || lower.includes('cliente') || lower.includes('proyecto') || lower.includes('trabaj')) {
          cat = 'Trabajo';
        } else if (lower.includes('comprar') || lower.includes('médico') || lower.includes('gym') || lower.includes('casa') || lower.includes('familia') || lower.includes('person')) {
          cat = 'Personal';
        } else if (lower.includes('idea') || lower.includes('pensar') || lower.includes('diseñar')) {
          cat = 'Idea';
        }

        let scheduledTime = 'Hoy';
        if (lower.includes('mañana')) scheduledTime = 'Mañana';
        else if (lower.includes('tarde')) scheduledTime = 'Esta tarde';
        else if (lower.includes('noche')) scheduledTime = 'Esta noche';
        else if (lower.includes('semana')) scheduledTime = 'Esta semana';

        return {
          responseText: `He registrado tu tarea: "${taskName}" en ${cat} para ${scheduledTime}. ¿Deseas agregar notas o alguna otra tarea?`,
          detectedTask: taskName,
          action: { type: 'CREATE_TASK', title: taskName, category: cat, time: scheduledTime },
        };
      }
    }

    // 7. Current time / date
    if (lower.includes('qué hora es') || lower.includes('que hora es') || lower.includes('hora actual') || lower.includes('qué día es hoy') || lower.includes('que dia es hoy')) {
      const now = new Date();
      const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const date = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      return {
        responseText: `Son las ${time} del ${date}. ¿Deseas agendar alguna actividad para hoy?`,
      };
    }

    // 8. Math and arithmetic
    const mathMatch = lower.match(/(?:cuánto es|cuanto es|calcula|calculame|resolver|operación|resultado de)\s*([\d\s\+\-\*\/\.\(\)\^x%]+)/i) ||
                      userText.match(/^([\d\s\+\-\*\/\.\(\)\^x%]+)$/);
    if (mathMatch) {
      try {
        const expr = mathMatch[1].replace(/x/g, '*').replace(/%/g, '/100');
        if (/^[0-9+\-*/().\s]+$/.test(expr)) {
          // eslint-disable-next-line no-eval
          const result = Function(`'use strict'; return (${expr})`)();
          return {
            responseText: `El resultado es: ${result}.`,
          };
        }
      } catch {
        // continue
      }
    }

    // 9. Drafting and emails
    if (lower.includes('correo') || lower.includes('email') || lower.includes('redact') || lower.includes('carta') || lower.includes('escribe') || lower.includes('borrador')) {
      return {
        responseText: `Aquí tienes tu borrador listo: Estimado equipo, les escribo para coordinar nuestras prioridades estratégicas y dar seguimiento a las acciones acordadas. ¿Deseas hacer algún cambio?`,
      };
    }

    // 10. Summaries & extraction of key ideas
    if (lower.includes('resume') || lower.includes('resumen') || lower.includes('ideas clave') || lower.includes('extrae') || lower.includes('síntesis')) {
      return {
        responseText: `Puntos fundamentales: Primero, definir la meta principal. Segundo, eliminar fricciones y pasos innecesarios. Tercero, revisar avances de forma consistente.`,
      };
    }

    // 11. Greetings & Buenos días
    if (
      lower.includes('hola') ||
      lower.includes('buenos días') ||
      lower.includes('buenos dias') ||
      lower.includes('buenas tardes') ||
      lower.includes('buenas noches') ||
      lower.startsWith('saludos')
    ) {
      const currentHour = new Date().getHours();
      let timeGreeting = 'Buenos días';
      if (currentHour >= 12 && currentHour < 19) {
        timeGreeting = 'Buenas tardes';
      } else if (currentHour >= 19 || currentHour < 5) {
        timeGreeting = 'Buenas noches';
      }
      return {
        responseText: `¡${timeGreeting}, ${user.name}! Soy El Fuete. Tus órdenes y tareas están al día. ¿En qué te ayudo hoy?`,
      };
    }

    // 12. General instruction execution
    return {
      responseText: `He procesado tu instrucción sobre "${userText}". ¿Cuál es el siguiente paso que deseas ejecutar?`,
    };
  };

  const normalizeActType = (raw?: string): AssistantInstructionAction['type'] => {
    if (!raw) return 'NONE';
    const u = raw.toUpperCase().trim();
    if (u === 'CREATE_TASK' || u === 'CREAR_TAREA' || u === 'NUEVA_TAREA' || u === 'AGREGAR_TAREA') return 'CREATE_TASK';
    if (u === 'COMPLETE_TASK' || u === 'COMPLETAR_TAREA' || u === 'MARCAR_COMPLETADA' || u === 'COMPLETAR') return 'COMPLETE_TASK';
    if (u === 'DELETE_TASK' || u === 'ELIMINAR_TAREA' || u === 'BORRAR_TAREA' || u === 'ELIMINAR') return 'DELETE_TASK';
    if (u === 'CLEAR_COMPLETED' || u === 'LIMPIAR_COMPLETADAS') return 'CLEAR_COMPLETED';
    return 'NONE';
  };

  const executeActions = (
    actionOrList?: AssistantInstructionAction | AssistantInstructionAction[] | null,
    detectedTask?: string | null
  ): AssistantTask | undefined => {
    const actions: AssistantInstructionAction[] = Array.isArray(actionOrList)
      ? actionOrList
      : actionOrList
      ? [actionOrList]
      : [];

    if (actions.length === 0 && detectedTask) {
      actions.push({ type: 'CREATE_TASK', title: detectedTask, category: 'Prioridad', time: 'Hoy' });
    }

    let createdTask: AssistantTask | undefined = undefined;

    for (const act of actions) {
      const actType = normalizeActType(act.type);

      if (actType === 'CREATE_TASK') {
        const taskTitle = act.title || detectedTask;
        if (taskTitle) {
          const newTask: AssistantTask = {
            id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: taskTitle,
            category: (['Trabajo', 'Personal', 'Prioridad', 'Idea'].includes(act.category as any)
              ? (act.category as 'Trabajo' | 'Personal' | 'Prioridad' | 'Idea')
              : 'Prioridad'),
            completed: false,
            time: act.time || 'Hoy',
            notes: act.notes || 'Registrada por interacción con El Fuete.',
          };
          createdTask = newTask;
          setTasks((prev) => [newTask, ...prev]);
          showToast(`Tarea registrada: "${taskTitle}"`);
          playConfirmTone();
        }
      } else if (actType === 'COMPLETE_TASK') {
        const target = (act.target || '').toLowerCase().trim();
        setTasks((prev) => {
          let found = false;
          const updated = prev.map((t) => {
            if (!found && (!target || t.title.toLowerCase().includes(target))) {
              found = true;
              return { ...t, completed: true };
            }
            return t;
          });
          if (found) {
            showToast(`Tarea completada: "${target || 'seleccionada'}"`);
            playConfirmTone();
          }
          return updated;
        });
      } else if (actType === 'DELETE_TASK') {
        const target = (act.target || '').toLowerCase().trim();
        setTasks((prev) => {
          let deletedTitle = '';
          const filtered = prev.filter((t) => {
            if (!deletedTitle && (!target || t.title.toLowerCase().includes(target))) {
              deletedTitle = t.title;
              return false;
            }
            return true;
          });
          if (deletedTitle) {
            showToast(`Tarea eliminada: "${deletedTitle}"`);
          }
          return filtered;
        });
      } else if (actType === 'CLEAR_COMPLETED') {
        setTasks((prev) => {
          const remaining = prev.filter((t) => !t.completed);
          showToast('Tareas completadas eliminadas');
          return remaining;
        });
      } else if (actType === 'REGISTRAR_GASTO') {
        const elemento = act.elemento || 'Gasto no especificado';
        const gastoAmount = act.gasto || 25000;
        const nextRegistro = getNextRegistroNumber(gastos);
        const newGastoItem: GastoItem = {
          id: `gasto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          fecha: getCurrentDateFormatted(),
          hora: getCurrentTimeFormatted(),
          registro: nextRegistro,
          gasto: gastoAmount,
          elemento,
          categoria: (act.category as any) || 'Alimentación',
          estadoEnvio: 'pendiente',
        };
        setGastos((prev) => [newGastoItem, ...prev]);
        showToast(`Gasto #${nextRegistro} registrado: "${elemento}"`);
        playConfirmTone();
        handleSendGastoToExcel(newGastoItem);
      }
    }

    return createdTask;
  };

  const handleSendMessage = async (text: string) => {
    if (isProcessingMessage) return;
    setIsProcessingMessage(true);

    try {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const userMsg: AssistantMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text: text,
        time: timeStr,
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            userName: user.name,
            conversationHistory: messages.slice(-6),
            currentTasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              category: t.category,
              completed: t.completed,
              time: t.time,
            })),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const createdTask = executeActions(data.actions || data.action, data.detectedTask);

          const assistantMsg: AssistantMessage = {
            id: `msg-${Date.now() + 1}`,
            sender: 'assistant',
            text: data.responseText,
            time: timeStr,
            expectsResponse: data.expectsResponse ?? checkExpectsResponse(data.responseText),
            createdTask,
            action: data.action || (Array.isArray(data.actions) ? data.actions[0] : undefined),
          };

          setMessages((prev) => [...prev, assistantMsg]);
          return;
        }
      } catch {
        // Fallback in case backend server is unreachable
      }

      // Local resolution fallback with instant execution
      const localResult = generateAIResponse(text);
      const createdTask = executeActions(localResult.action, localResult.detectedTask);

      const assistantMsg: AssistantMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: localResult.responseText,
        time: timeStr,
        expectsResponse: checkExpectsResponse(localResult.responseText),
        createdTask,
        action: localResult.action,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsProcessingMessage(false);
    }
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleAddTask = (
    title: string,
    category: AssistantTask['category'],
    notes?: string
  ) => {
    const newTask: AssistantTask = {
      id: `task-${Date.now()}`,
      title,
      category,
      completed: false,
      time: 'Hoy',
      notes: notes || undefined,
    };
    setTasks((prev) => [newTask, ...prev]);
    showToast(`Tarea guardada: "${title}"`);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showToast('Tarea eliminada.');
  };

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        defaultUsername={user.name || 'Alejo'}
        expiredSessionNotice={sessionExpiredNotice}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans antialiased flex flex-col justify-center items-center">
      {/* Mobile Container Frame: sleek modern assistant device layout */}
      <div className="w-full max-w-[440px] min-h-screen bg-[#0a0a0a] border-x border-white/10 shadow-2xl relative flex flex-col overflow-x-hidden">
        {/* Top Header (Oculto al hablar con la IA) */}
        <AnimatePresence>
          {!isVoiceActive && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <TopHeader
                user={user}
                onOpenNotifications={() => setNotificationsOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onLogout={handleLogout}
                currentTab={currentTab}
                onSelectTab={setCurrentTab}
                pendingGastosCount={gastos.filter((g) => g.estadoEnvio !== 'enviado').length}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area: Dashboard (Asistente) or Gastos (Excel Sync) */}
        <main className="flex-1 w-full relative flex flex-col">
          {currentTab === 'asistente' ? (
            <DashboardScreen
              user={user}
              messages={messages}
              tasks={tasks}
              onSendMessage={handleSendMessage}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
              onOpenVoice={handleOpenVoice}
              onOpenDetail={(detail) => setActiveDetail(detail)}
              voiceTriggerCount={voiceTriggerCount}
              isVoiceActive={isVoiceActive}
              onVoiceActiveChange={setIsVoiceActive}
              isProcessing={isProcessingMessage}
            />
          ) : (
            <GastosScreen
              user={user}
              gastos={gastos}
              onAddGasto={handleAddGasto}
              onSendGastoToExcel={handleSendGastoToExcel}
              onSendAllPending={handleSendAllPending}
              onDeleteGasto={handleDeleteGasto}
              onShowToast={showToast}
              webhookUrl={webhookUrl}
              onChangeWebhookUrl={handleChangeWebhookUrl}
            />
          )}
        </main>

        {/* Toast Overlay */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.94 }}
              transition={{ type: 'spring', damping: 22, stiffness: 350 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-[380px] w-full px-4 pointer-events-none"
            >
              <div className="bg-[#141414]/95 border border-white/25 text-white px-4 py-2.5 rounded-xl shadow-[0_0_24px_rgba(255,255,255,0.15)] backdrop-blur-md flex items-center gap-2.5 font-mono text-xs">
                <span className="material-symbols-outlined text-white text-[18px]">check_circle</span>
                <span className="leading-tight">{toastMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detail Modal */}
        <DetailModal
          data={activeDetail}
          onClose={() => setActiveDetail(null)}
        />

        {/* Assistant Settings Modal */}
        <ProfileModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          user={user}
          onUpdateUser={handleUpdateUser}
          onShowToast={showToast}
          onLogout={handleLogout}
          timeoutMinutes={sessionTimeoutMinutes}
          onChangeTimeoutMinutes={handleChangeTimeoutMinutes}
        />

        {/* Notifications Modal */}
        <NotificationsModal
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
        />
      </div>
    </div>
  );
}
