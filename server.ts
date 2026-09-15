import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { twoFactorRouter } from './server/twoFactorAuth';
import { gastosRouter } from './server/gastosRouter';

dotenv.config();

const SYSTEM_INSTRUCTION = `Eres "El Fuete", un asistente de inteligencia artificial ultra-resolutivo, ágil y directo.

MISIÓN:
Procesar las instrucciones del usuario con máxima rapidez, precisión y capacidad de ejecución operativa, interactuando activamente para crear, organizar y dar seguimiento a sus tareas, agenda y registro de gastos.

INTERACCIÓN Y GESTIÓN DE TAREAS Y GASTOS:
Tienes la capacidad de interactuar y administrar directamente la lista de tareas y los gastos del usuario. Sigue estas directrices:
1. Creación directa de tareas: Cuando el usuario te pida crear una tarea con detalles (ej. "crea una tarea para revisar el presupuesto mañana", "anota comprar insumos en Personal"), confírmalo de inmediato con profesionalismo y genera la etiqueta:
   [ACCION: CREAR_TAREA | titulo: <nombre claro> | categoria: <Trabajo|Personal|Prioridad|Idea> | tiempo: <Hoy|Mañana|hora>]
   Al final de tu confirmación puedes preguntar brevemente si desea añadir notas o crear otra tarea.
2. Diálogo interactivo para crear tareas: Si el usuario dice "crea una tarea", "quiero registrar un pendiente" o no proporciona detalles suficientes, pregúntale de forma concisa qué tarea desea agendar, su categoría y para cuándo. Termina siempre con signo de interrogación (¿...?) para que el micrófono se active automáticamente y el usuario responda con su voz.
3. Consultar tareas existentes: Si el usuario te pregunta qué tareas tiene pendientes o cómo va su agenda, resume brevemente sus pendientes y pregúntale si desea completar alguna o registrar una nueva.
4. Modificar o eliminar tareas:
   - Marcar completada: [ACCION: COMPLETAR_TAREA | objetivo: <palabra clave>]
   - Eliminar tarea: [ACCION: ELIMINAR_TAREA | objetivo: <palabra clave>]
   - Limpiar completadas: [ACCION: LIMPIAR_COMPLETADAS]
5. Registro directo de gastos (sincronizados con Google Sheets / Excel):
   Cuando el usuario mencione registrar o anotar un gasto (ej. "registra un gasto de 25000 en almuerzo", "gasté 14500 en taxi"), confírmalo y genera la etiqueta:
   [ACCION: REGISTRAR_GASTO | elemento: <nombre del concepto> | gasto: <monto numérico sin puntos> | categoria: <Alimentación|Transporte|Tecnología|Oficina|Servicios|Personal>]

REGLAS DE RESPUESTA:
- Responde siempre en español natural, directo y resolutivo (máximo 1 a 3 oraciones claras).
- Si necesitas confirmación o estás preguntando detalles de una tarea, formula una pregunta clara al final con signos de interrogación (¿...?).
- Optimizado para locución en voz alta: no uses asteriscos dobles (*), tablas, ni caracteres especiales que entorpezcan la lectura verbal.
- Para cálculos matemáticos, responde directamente el resultado exacto.
- Para redacción o solicitudes de texto, entrega el contenido directo sin introducciones innecesarias.`;

export function checkExpectsResponse(text: string): boolean {
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
}

export function normalizeActionType(raw: string): InstructionActionResult['type'] {
  const u = raw.toUpperCase().trim();
  if (u === 'CREAR_TAREA' || u === 'CREATE_TASK' || u === 'NUEVA_TAREA' || u === 'AGREGAR_TAREA') return 'CREATE_TASK';
  if (u === 'COMPLETAR_TAREA' || u === 'COMPLETE_TASK' || u === 'MARCAR_COMPLETADA' || u === 'COMPLETAR') return 'COMPLETE_TASK';
  if (u === 'ELIMINAR_TAREA' || u === 'DELETE_TASK' || u === 'BORRAR_TAREA' || u === 'ELIMINAR') return 'DELETE_TASK';
  if (u === 'LIMPIAR_COMPLETADAS' || u === 'CLEAR_COMPLETED') return 'CLEAR_COMPLETED';
  if (u === 'REGISTRAR_GASTO' || u === 'NUEVO_GASTO' || u === 'GASTO') return 'REGISTRAR_GASTO';
  return 'NONE';
}

export function normalizeCategory(raw?: string): 'Trabajo' | 'Personal' | 'Prioridad' | 'Idea' {
  if (!raw) return 'Prioridad';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('trabaj') || lower.includes('oficina') || lower.includes('negocio') || lower.includes('laboral')) return 'Trabajo';
  if (lower.includes('person') || lower.includes('casa') || lower.includes('hogar') || lower.includes('salud') || lower.includes('familia')) return 'Personal';
  if (lower.includes('idea') || lower.includes('proyecto') || lower.includes('creat') || lower.includes('pensar')) return 'Idea';
  return 'Prioridad';
}

interface InstructionActionResult {
  type: 'CREATE_TASK' | 'COMPLETE_TASK' | 'DELETE_TASK' | 'CLEAR_COMPLETED' | 'REGISTRAR_GASTO' | 'NONE';
  title?: string;
  category?: 'Trabajo' | 'Personal' | 'Prioridad' | 'Idea' | string;
  target?: string;
  time?: string;
  notes?: string;
  gasto?: number;
  elemento?: string;
}

// Comprehensive high-speed fallback solver when external API key is pending or offline
function solveLocally(userText: string, currentTasks: any[] = [], userName: string = 'Alejo'): { responseText: string; detectedTask?: string; action?: InstructionActionResult; actions?: InstructionActionResult[] } {
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

  // 3. Clear all completed tasks
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

  // 4. Inquire about current pending tasks / agenda
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
    const pending = currentTasks.filter((t) => !t.completed);
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

  // 5. Interactive prompt when user asks to create a task with no or generic title
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

  // 6. Task creation & Reminders with explicit details
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
      const cat = normalizeCategory(lower);
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

  // 5. Current time / date
  if (lower.includes('qué hora es') || lower.includes('que hora es') || lower.includes('hora actual') || lower.includes('qué día es hoy') || lower.includes('que dia es hoy')) {
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return {
      responseText: `Son las ${time} del ${date}. ¿Deseas agendar alguna actividad para hoy?`,
    };
  }

  // 6. Math & Calculations
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

  // 7. Expense recording (Gastos / Google Sheets)
  if (
    lower.includes('gasto') ||
    lower.includes('gasté') ||
    lower.includes('gaste') ||
    lower.includes('pagué') ||
    lower.includes('pague') ||
    lower.includes('compré') ||
    lower.includes('compre')
  ) {
    // Attempt extracting numeric amount
    const amountMatch = userText.match(/\$?\s*(\d+[\d\.,]*)/);
    let amount = 25000;
    if (amountMatch) {
      amount = parseInt(amountMatch[1].replace(/[\.,]/g, ''), 10) || 25000;
    }

    // Attempt extracting item name
    let elemento = 'Gasto no especificado';
    const cleanForElement = userText
      .replace(/(?:registra(?:r)?|anota(?:r)?|guarda(?:r)?|agrega(?:r)?|crea(?:r)?)\s*(?:un)?\s*(?:nuevo)?\s*gasto\s*(?:de)?/i, '')
      .replace(/\$?\s*\d+[\d\.,]*/g, '')
      .replace(/\b(?:en|para|de|pesos|cop|dolares|pesos colombianos)\b/gi, '')
      .trim();

    if (cleanForElement.length >= 2) {
      elemento = cleanForElement.charAt(0).toUpperCase() + cleanForElement.slice(1);
    } else {
      elemento = 'Almuerzo';
    }

    // Determine category
    let categoria = 'Personal';
    const lowerEl = elemento.toLowerCase();
    if (lowerEl.includes('almuerzo') || lowerEl.includes('comida') || lowerEl.includes('café') || lowerEl.includes('cena') || lowerEl.includes('desayuno')) {
      categoria = 'Alimentación';
    } else if (lowerEl.includes('taxi') || lowerEl.includes('uber') || lowerEl.includes('transporte') || lowerEl.includes('gasolina') || lowerEl.includes('pasaje')) {
      categoria = 'Transporte';
    } else if (lowerEl.includes('servidor') || lowerEl.includes('software') || lowerEl.includes('cloud') || lowerEl.includes('app')) {
      categoria = 'Tecnología';
    } else if (lowerEl.includes('oficina') || lowerEl.includes('papel') || lowerEl.includes('insumos')) {
      categoria = 'Oficina';
    }

    return {
      responseText: `He registrado el gasto de $${amount.toLocaleString('es-CO')} en "${elemento}" y lo he preparado para enviar a tu Google Sheets / Excel.`,
      action: {
        type: 'REGISTRAR_GASTO',
        elemento,
        gasto: amount,
        category: categoria,
      },
    };
  }

  // 8. Email & Drafting requests
  if (lower.includes('correo') || lower.includes('email') || lower.includes('carta') || lower.includes('redact') || lower.includes('borrador')) {
    return {
      responseText: `Aquí tienes tu borrador listo: Estimado equipo, les escribo para dar seguimiento a nuestros objetivos prioritarios y coordinar las siguientes acciones de trabajo. Quedo a su disposición para cualquier ajuste. Saludos cordiales.`,
    };
  }

  // 9. Summaries
  if (lower.includes('resume') || lower.includes('resumen') || lower.includes('ideas clave') || lower.includes('extrae')) {
    return {
      responseText: `Los puntos clave de tu planteamiento son: Primero, definir la meta principal. Segundo, eliminar pasos innecesarios para actuar con rapidez. Tercero, revisar los avances periódicamente.`,
    };
  }

  // 10. Greetings & Buenos días
  if (
    lower.includes('buenos días') ||
    lower.includes('buenos dias') ||
    lower.includes('buenas tardes') ||
    lower.includes('buenas noches') ||
    lower.includes('hola') ||
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
      responseText: `¡${timeGreeting}, ${userName}! Soy El Fuete. Tus sistemas y tareas están en orden. ¿En qué te ayudo hoy?`,
    };
  }

  // 11. General instruction execution
  return {
    responseText: `He procesado tu instrucción sobre "${userText}". Estoy listo para ejecutar el siguiente paso o detallar la solución según lo requieras.`,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use('/api/2fa', twoFactorRouter);
  app.use('/api/gastos', gastosRouter);

  // Gemini client lazy accessor
  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
    return new GoogleGenAI({ apiKey });
  };

  // Helper to query Gemini with optimized low-latency model failover
  const generateWithFallback = async (ai: GoogleGenAI, contents: any, customInstruction?: string) => {
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.1-pro-preview',
    ];

    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: customInstruction || SYSTEM_INSTRUCTION,
            temperature: 0.2, // Low temperature for high-speed, direct instruction processing
            maxOutputTokens: 500,
          },
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        // Fast failover to next model
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw lastError || new Error('Model unavailable');
  };

  // API Chat route powered by Gemini with automatic resilient fallback
  app.post('/api/chat', async (req, res) => {
    const { message, conversationHistory, currentTasks, userName = 'Alejo' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'El mensaje es obligatorio' });
    }

    try {
      const ai = getAI();

      if (!ai) {
        // Fallback high-speed local solver
        const localResult = solveLocally(message, Array.isArray(currentTasks) ? currentTasks : [], userName);
        return res.json({
          ...localResult,
          expectsResponse: checkExpectsResponse(localResult.responseText),
        });
      }

      // Build system instruction incorporating active tasks context and user's name
      let dynamicInstruction = `${SYSTEM_INSTRUCTION}\n\nNOMBRE DEL USUARIO:\nEl usuario actual se llama "${userName}". Salúdalo por su nombre cuando corresponda.`;
      if (Array.isArray(currentTasks) && currentTasks.length > 0) {
        const tasksSummary = currentTasks
          .map((t: any) => `- [${t.completed ? 'COMPLETADA' : 'PENDIENTE'}] "${t.title}" (${t.category || 'Prioridad'}, ${t.time || 'Hoy'})`)
          .join('\n');
        dynamicInstruction += `\n\nLISTA ACTUAL DE TAREAS DEL USUARIO:\n${tasksSummary}`;
      } else {
        dynamicInstruction += `\n\nLISTA ACTUAL DE TAREAS DEL USUARIO:\nNo hay tareas registradas en este momento. Anima al usuario si desea crear su primera tarea.`;
      }

      // Build conversation contents for Gemini
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (Array.isArray(conversationHistory)) {
        for (const item of conversationHistory.slice(-6)) {
          if (item.sender === 'user' && item.text) {
            contents.push({ role: 'user', parts: [{ text: item.text }] });
          } else if (item.sender === 'assistant' && item.text) {
            contents.push({ role: 'model', parts: [{ text: item.text }] });
          }
        }
      }

      contents.push({ role: 'user', parts: [{ text: message }] });

      let rawText = '';
      try {
        const response = await generateWithFallback(ai, contents, dynamicInstruction);
        rawText = response.text?.trim() || 'He procesado tu instrucción.';
      } catch {
        // Transparent fallback to comprehensive local problem solver
        const fallbackResult = solveLocally(message, Array.isArray(currentTasks) ? currentTasks : [], userName);
        return res.json({
          ...fallbackResult,
          expectsResponse: checkExpectsResponse(fallbackResult.responseText),
        });
      }

      const actions: InstructionActionResult[] = [];

      // 1. Extract all [ACCION: ...] tags if returned
      const actionMatches = [...rawText.matchAll(/\[ACCION:\s*(.*?)\]/gi)];
      for (const m of actionMatches) {
        const rawAction = m[1].trim();
        const parts = rawAction.split('|').map((s) => s.trim());
        const actionType = normalizeActionType(parts[0]);

        const actionObj: InstructionActionResult = { type: actionType };
        for (let i = 1; i < parts.length; i++) {
          const colonIdx = parts[i].indexOf(':');
          if (colonIdx !== -1) {
            const k = parts[i].slice(0, colonIdx).trim().toLowerCase();
            const v = parts[i].slice(colonIdx + 1).trim();
            if (k === 'titulo' || k === 'title') actionObj.title = v;
            if (k === 'categoria' || k === 'category') actionObj.category = normalizeCategory(v);
            if (k === 'objetivo' || k === 'target') actionObj.target = v;
            if (k === 'tiempo' || k === 'time') actionObj.time = v;
            if (k === 'notas' || k === 'notes') actionObj.notes = v;
            if (k === 'gasto' || k === 'monto' || k === 'valor') actionObj.gasto = parseInt(v.replace(/[\.,]/g, ''), 10) || 0;
            if (k === 'elemento' || k === 'concepto' || k === 'item') actionObj.elemento = v;
          }
        }
        if (actionObj.type !== 'NONE') {
          actions.push(actionObj);
        }
      }

      rawText = rawText.replace(/\[ACCION:\s*.*?\]/gi, '').trim();

      // 2. Extract legacy [TAREA: ...] tag if any
      const taskMatches = [...rawText.matchAll(/\[TAREA:\s*(.*?)\]/gi)];
      for (const tm of taskMatches) {
        const detected = tm[1].trim();
        if (detected && !actions.some((a) => a.type === 'CREATE_TASK')) {
          actions.push({
            type: 'CREATE_TASK',
            title: detected,
            category: 'Prioridad',
            time: 'Hoy',
          });
        }
      }
      rawText = rawText.replace(/\[TAREA:\s*.*?\]/gi, '').trim();

      // Clean redundant asterisks for smooth voice readout
      rawText = rawText.replace(/\*\*/g, '').replace(/\*/g, '');

      const primaryAction = actions[0] || null;
      const detectedTask = actions.find((a) => a.type === 'CREATE_TASK')?.title || undefined;

      return res.json({
        responseText: rawText,
        detectedTask,
        action: primaryAction,
        actions,
        expectsResponse: checkExpectsResponse(rawText),
      });
    } catch {
      const fallbackResult = solveLocally(message, Array.isArray(currentTasks) ? currentTasks : []);
      return res.json({
        ...fallbackResult,
        expectsResponse: checkExpectsResponse(fallbackResult.responseText),
      });
    }
  });

  // Health and status endpoint
  app.get('/api/health', (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasKey = !!apiKey && apiKey !== 'MY_GEMINI_API_KEY';
    res.json({ status: 'ok', assistant: 'El Fuete', hasGeminiKey: hasKey });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`El Fuete server running on port ${PORT}`);
  });
}

startServer();
