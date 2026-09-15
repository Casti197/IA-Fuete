import React, { useState, useEffect } from 'react';
import { playTacticalClick, playVoiceActivate } from '../utils/soundEffects';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand?: (cmd: string) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([
    'El Fuete · Asistente de Voz conectado y listo.',
    'Hola. Puedes hablarme o escribirme para pedirme redacciones, tareas, resúmenes o consultas.',
  ]);

  useEffect(() => {
    if (isOpen) {
      playVoiceActivate();
      setIsListening(true);
    } else {
      setIsListening(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSpeakOrSubmit = (promptText?: string) => {
    const query = promptText || inputText;
    if (!query.trim()) return;

    playTacticalClick();
    setIsProcessing(true);
    setTranscript((prev) => [...prev, `› Tú: "${query}"`]);
    setInputText('');

    setTimeout(() => {
      let response = 'He recibido tu solicitud y la he procesado de inmediato.';
      const lower = query.toLowerCase();

      if (lower.includes('tarea') || lower.includes('recordar') || lower.includes('pendiente')) {
        response =
          'Entendido. He registrado la tarea en tu lista de pendientes para que no se te pase ningún detalle.';
      } else if (lower.includes('correo') || lower.includes('redact') || lower.includes('mensaje')) {
        response =
          'Aquí tienes una estructura recomendada: Estimado equipo, espero que se encuentren bien. Les escribo para coordinar los próximos pasos del proyecto y definir prioridades. Quedo atento a su confirmación.';
      } else if (lower.includes('organizar') || lower.includes('tiempo') || lower.includes('agenda')) {
        response =
          'Te sugiero dedicar la mañana a tareas que requieran alta concentración (bloques de 50 minutos) y dejar las comunicaciones y reuniones breves para la tarde.';
      } else if (lower.includes('resumen') || lower.includes('sintet')) {
        response =
          'Puntos esenciales sintetizados: 1. Alinear objetivos prioritarios. 2. Reducir fricciones en flujos de trabajo. 3. Confirmar acuerdos antes del cierre de semana.';
      } else {
        response = `Comprendo tu solicitud: "${query}". El Fuete está a tu servicio para resolver dudas, sintetizar ideas y estructurar soluciones.`;
      }

      setTranscript((prev) => [...prev, `✦ El Fuete: ${response}`]);
      setIsProcessing(false);

      if (onExecuteCommand) {
        onExecuteCommand(query);
      }

      // Web Speech API Voice synthesis
      if ('speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(response);
          utterance.lang = 'es-ES';
          utterance.rate = 1.05;
          window.speechSynthesis.speak(utterance);
        } catch {
          // Ignore speech synthesis errors
        }
      }
    }, 850);
  };

  const quickPrompts = [
    '¿Qué pendientes tengo hoy?',
    'Redactar un correo de agradecimiento',
    'Consejos para organizar mi tiempo',
    'Añadir recordatorio importante',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0a0a0a] border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#121212]">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10">
              <span className="material-symbols-outlined text-white text-[18px] animate-pulse">
                smart_toy
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  EL FUETE // ASISTENTE DE VOZ
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-white border border-white/20">
                  EN LÍNEA
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Reconocimiento vocal & síntesis inteligente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#1c1c1c] text-zinc-400 hover:text-white flex items-center justify-center border border-white/10"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Central Waveform & Pulse Sphere */}
        <div className="p-5 flex flex-col items-center justify-center bg-black border-b border-white/10">
          <div className="relative my-2 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/25 flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shadow-[0_0_25px_rgba(255,255,255,0.2)]">
                <span className="material-symbols-outlined text-[32px] text-white">mic</span>
              </div>
            </div>
            {/* Concentric rings */}
            <div className="absolute -inset-4 rounded-full border border-white/15 pointer-events-none animate-ping opacity-40"></div>
          </div>

          {/* Dynamic Audio Bars */}
          <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-xs mt-2 px-3 py-1 rounded-lg bg-[#121212] border border-white/10">
            {[4, 8, 14, 22, 34, 42, 28, 38, 48, 32, 20, 14, 28, 40, 18, 10, 6].map(
              (height, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    isProcessing
                      ? 'bg-white animate-pulse'
                      : i % 2 === 0
                      ? 'bg-zinc-300'
                      : 'bg-zinc-600'
                  }`}
                  style={{
                    height: isProcessing ? `${Math.random() * 36 + 6}px` : `${height}px`,
                  }}
                />
              )
            )}
          </div>
          <span className="font-mono text-[10px] text-zinc-400 mt-2 tracking-wider">
            {isProcessing ? 'SINTETIZANDO RESPUESTA...' : 'ESCUCHANDO TU CONSULTA...'}
          </span>
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-xs font-mono max-h-52 bg-[#0a0a0a]">
          {transcript.map((line, idx) => {
            const isUser = line.startsWith('›');
            const isAssistant = line.startsWith('✦');
            return (
              <div
                key={idx}
                className={`p-2.5 rounded-lg leading-relaxed ${
                  isUser
                    ? 'bg-white/10 text-white border border-white/20 ml-6'
                    : isAssistant
                    ? 'bg-[#141414] text-white border border-white/15 mr-4 shadow-sm'
                    : 'text-zinc-400 bg-black/60'
                }`}
              >
                {line}
              </div>
            );
          })}
        </div>

        {/* Quick Voice Chips */}
        <div className="px-4 py-2 border-t border-white/10 bg-[#121212]/70 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSpeakOrSubmit(prompt)}
              className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#181818] text-zinc-300 hover:text-white hover:border-white/40 border border-white/10 transition-colors"
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Field */}
        <div className="p-4 border-t border-white/10 bg-[#121212]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSpeakOrSubmit();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Habla o escribe a El Fuete..."
              className="flex-1 bg-black border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors flex items-center gap-1 shadow-lg shadow-white/10"
            >
              <span>Enviar</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
