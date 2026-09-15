import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantMessage, AssistantTask, UserProfile } from '../types';
import { playTacticalClick, playConfirmTone, playVoiceActivate } from '../utils/soundEffects';

// Detect if assistant speech contains questions or prompts expecting a user response
const isExpectingResponse = (text: string): boolean => {
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

interface VoiceChatViewProps {
  user?: UserProfile;
  messages: AssistantMessage[];
  onSendMessage: (text: string) => void;
  onAddTask: (title: string, category: AssistantTask['category'], notes?: string) => void;
  onToggleTask?: (taskId: string) => void;
  voiceTriggerCount?: number;
  onVoiceActiveChange?: (isActive: boolean) => void;
  isProcessing?: boolean;
}

export const VoiceChatView: React.FC<VoiceChatViewProps> = ({
  user,
  messages,
  onSendMessage,
  onAddTask,
  onToggleTask,
  voiceTriggerCount = 0,
  onVoiceActiveChange,
  isProcessing: isParentProcessing = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [localIsProcessing, setLocalIsProcessing] = useState(false);
  const isProcessing = localIsProcessing || isParentProcessing;
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [lastSpokenQuery, setLastSpokenQuery] = useState('');
  const [currentSpeakingText, setCurrentSpeakingText] = useState('');
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [equalizerLevels, setEqualizerLevels] = useState<number[]>([20, 30, 20, 35, 20, 30, 20, 25, 20]);

  const isTalkingWithAI = isListening || isSpeakingResponse || isWaitingForResponse || isProcessing;

  useEffect(() => {
    onVoiceActiveChange?.(isTalkingWithAI);
  }, [isTalkingWithAI, onVoiceActiveChange]);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const speechTimeoutRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const autoListenTimerRef = useRef<any>(null);
  const autoListenTimeoutRef = useRef<any>(null);
  const userInterruptedSpeechRef = useRef<boolean>(false);
  const expectsResponseRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const transcriptRef = useRef<string>('');

  // Audio Context & Mic Visualizer refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cleanupAudioStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    setEqualizerLevels([20, 30, 20, 35, 20, 30, 20, 25, 20]);
  };

  const stopSpeaking = (interruptedByUser: boolean = false) => {
    if (interruptedByUser) {
      userInterruptedSpeechRef.current = true;
      expectsResponseRef.current = false;
      setIsWaitingForResponse(false);
      if (autoListenTimerRef.current) {
        clearTimeout(autoListenTimerRef.current);
        autoListenTimerRef.current = null;
      }
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
        autoListenTimeoutRef.current = null;
      }
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    setIsSpeakingResponse(false);
    setCurrentSpeakingText('');
  };

  const speakText = (text: string, expectsResponse?: boolean) => {
    stopSpeaking(false);
    userInterruptedSpeechRef.current = false;

    // Detect if this message expects a response
    const willExpect = expectsResponse ?? isExpectingResponse(text);
    expectsResponseRef.current = willExpect;

    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }

    // Clean symbols and brackets for natural, uninterrupted speech
    const cleanSpeech = text
      .replace(/\[.*?\]/g, '')
      .replace(/[*_#`~>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    setCurrentSpeakingText(text);

    const onSpeechFinished = () => {
      stopSpeaking(false);
      if (expectsResponseRef.current && !userInterruptedSpeechRef.current) {
        setIsWaitingForResponse(true);
        autoListenTimerRef.current = setTimeout(() => {
          if (!isListeningRef.current && !isProcessing) {
            startListening(true);
          }
        }, 380); // Smooth natural transition pause before activating mic
      }
    };

    if (!('speechSynthesis' in window)) {
      // Visual duration fallback if speech synthesis is blocked
      setIsSpeakingResponse(true);
      const estTime = Math.min(Math.max(cleanSpeech.length * 45, 1800), 6000);
      speechTimeoutRef.current = setTimeout(() => {
        setIsSpeakingResponse(false);
        speechTimeoutRef.current = null;
        setCurrentSpeakingText('');
        onSpeechFinished();
      }, estTime);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      utterance.lang = 'es-ES';
      utterance.rate = 1.08;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeakingResponse(true);
        // Safety timeout in case onend does not fire
        const estDurationMs = Math.min(Math.max(cleanSpeech.length * 60, 2200), 16000);
        speechTimeoutRef.current = setTimeout(() => {
          onSpeechFinished();
        }, estDurationMs);
      };

      utterance.onend = () => {
        onSpeechFinished();
      };

      utterance.onerror = () => {
        stopSpeaking(false);
      };

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeakingResponse(false);
      setCurrentSpeakingText('');
    }
  };

  const processVoiceQuery = async (query: string) => {
    if (!query.trim() || isProcessing) return;
    setLocalIsProcessing(true);
    setLastSpokenQuery(query.trim());
    playTacticalClick();

    try {
      await onSendMessage(query.trim());
    } finally {
      setLocalIsProcessing(false);
    }
  };

  const stopListeningAndSubmit = () => {
    if (isProcessing) return;
    isListeningRef.current = false;
    setIsListening(false);
    setIsWaitingForResponse(false);

    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    cleanupAudioStream();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const finalQuery = (transcriptRef.current || liveTranscript).trim();
    if (finalQuery && finalQuery !== 'Escuchando tu voz... Habla ahora') {
      processVoiceQuery(finalQuery);
    } else {
      setLiveTranscript('');
      transcriptRef.current = '';
    }
  };

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    setIsWaitingForResponse(false);

    if (autoListenTimeoutRef.current) {
      clearTimeout(autoListenTimeoutRef.current);
      autoListenTimeoutRef.current = null;
    }
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    cleanupAudioStream();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    setLiveTranscript('');
    transcriptRef.current = '';
  };

  const startListening = async (isAutoTriggered: boolean = false) => {
    if (isProcessing) return;
    playVoiceActivate();
    stopSpeaking(false);

    if (isAutoTriggered) {
      setIsWaitingForResponse(true);
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
      // If user stays silent for 9s after auto activation, close mic gracefully
      autoListenTimeoutRef.current = setTimeout(() => {
        if (
          isListeningRef.current &&
          (!transcriptRef.current || transcriptRef.current === 'Escuchando tu voz... Habla ahora')
        ) {
          stopListening();
        }
      }, 9000);
    } else {
      setIsWaitingForResponse(false);
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
        autoListenTimeoutRef.current = null;
      }
    }

    // Reset transcript states
    setLiveTranscript('');
    transcriptRef.current = '';
    setLastSpokenQuery('');
    setMicNotice(null);
    setIsListening(true);
    isListeningRef.current = true;

    // 1. Request real microphone access and connect audio frequency analyzer for equalizer
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateAudioVisualizer = () => {
            if (!analyserRef.current || !isListeningRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;

            setEqualizerLevels([
              Math.min(100, Math.max(15, (dataArray[0] || avg) * 0.7)),
              Math.min(100, Math.max(20, (dataArray[2] || avg) * 0.9)),
              Math.min(100, Math.max(25, (dataArray[4] || avg) * 1.15)),
              Math.min(100, Math.max(20, (dataArray[6] || avg) * 1.0)),
              Math.min(100, Math.max(30, (dataArray[8] || avg) * 1.25)),
              Math.min(100, Math.max(22, (dataArray[10] || avg) * 1.0)),
              Math.min(100, Math.max(25, (dataArray[12] || avg) * 1.1)),
              Math.min(100, Math.max(18, (dataArray[14] || avg) * 0.8)),
              Math.min(100, Math.max(15, (dataArray[16] || avg) * 0.6)),
            ]);

            animFrameRef.current = requestAnimationFrame(updateAudioVisualizer);
          };

          animFrameRef.current = requestAnimationFrame(updateAudioVisualizer);
        }
      } catch (err: any) {
        console.warn('Microphone access notice:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicNotice('Permiso de micrófono no concedido. Por favor autoriza el micrófono en tu navegador.');
        }
      }
    }

    // 2. Initialize Web Speech Recognition
    const windowWithSpeech = window as any;
    const SpeechRec =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch {
            // ignore
          }
        }

        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'es-ES';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          const fullSpoken = (final + interim).trim();
          if (fullSpoken) {
            // Cancel auto-listen silence timeout since user began speaking
            if (autoListenTimeoutRef.current) {
              clearTimeout(autoListenTimeoutRef.current);
              autoListenTimeoutRef.current = null;
            }

            setLiveTranscript(fullSpoken);
            transcriptRef.current = fullSpoken;

            // When the user pauses after speaking words, automatically submit promptly
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            silenceTimerRef.current = setTimeout(() => {
              if (
                isListeningRef.current &&
                transcriptRef.current &&
                transcriptRef.current !== 'Escuchando tu voz... Habla ahora'
              ) {
                stopListeningAndSubmit();
              }
            }, 1200);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed') {
            setMicNotice('Permiso de micrófono bloqueado. Haz clic en el candado de la URL para permitir el micrófono.');
            stopListening();
          }
        };

        recognition.onend = () => {
          if (isListeningRef.current) {
            if (
              transcriptRef.current &&
              transcriptRef.current !== 'Escuchando tu voz... Habla ahora'
            ) {
              stopListeningAndSubmit();
            } else {
              stopListening();
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.warn('Error launching speech recognition:', err);
      }
    } else {
      setMicNotice('Reconocimiento de voz nativo no soportado en este navegador. Puedes escribir con el teclado.');
      setShowManualInput(true);
    }
  };

  const toggleMic = () => {
    if (isProcessing) {
      return;
    }

    if (isSpeakingResponse) {
      stopSpeaking(true);
      return;
    }

    if (isListening) {
      stopListeningAndSubmit();
    } else {
      startListening(false);
    }
  };

  // External trigger (e.g. from bottom nav mic button)
  const prevTriggerCount = useRef(voiceTriggerCount);
  useEffect(() => {
    if (voiceTriggerCount > prevTriggerCount.current) {
      prevTriggerCount.current = voiceTriggerCount;
      if (!isListening && !isProcessing) {
        startListening(false);
      }
    }
  }, [voiceTriggerCount, isListening, isProcessing]);

  // Speak the latest assistant message automatically if it was just received
  const lastMessage = messages[messages.length - 1];
  const prevMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      lastMessage &&
      lastMessage.sender === 'assistant' &&
      lastMessage.id !== prevMsgIdRef.current
    ) {
      prevMsgIdRef.current = lastMessage.id;
      const expects = lastMessage.expectsResponse ?? isExpectingResponse(lastMessage.text);
      speakText(lastMessage.text, expects);
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lastMessage]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopSpeaking(true);
      cleanupAudioStream();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (autoListenTimerRef.current) {
        clearTimeout(autoListenTimerRef.current);
      }
      if (autoListenTimeoutRef.current) {
        clearTimeout(autoListenTimeoutRef.current);
      }
    };
  }, []);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing || !manualText.trim()) return;
    const query = manualText.trim();
    setManualText('');
    playTacticalClick();
    setLocalIsProcessing(true);
    setLastSpokenQuery(query);
    try {
      await onSendMessage(query);
    } finally {
      setLocalIsProcessing(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    playConfirmTone();
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className={`flex flex-col pb-2 animate-fade-in transition-all duration-500 ${
        isTalkingWithAI ? 'flex-1 justify-center' : 'space-y-4'
      }`}
    >
      {/* ========================================================================= */}
      {/* HERO VOICE CENTERPIECE: BOTÓN DIRECTO SIN MARCO NI TEXTO                  */}
      {/* ========================================================================= */}
      <motion.div
        layout
        transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
        className={`flex flex-col items-center justify-center text-center relative overflow-visible ${
          isTalkingWithAI ? 'min-h-[75vh] py-2 my-auto' : 'py-6 sm:py-10'
        }`}
      >
        {/* Dynamic Greeting with User Variable */}
        {!isTalkingWithAI && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col items-center select-none"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-zinc-300 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                {(() => {
                  const hour = new Date().getHours();
                  if (hour >= 12 && hour < 19) return 'Buenas tardes';
                  if (hour >= 19 || hour < 5) return 'Buenas noches';
                  return 'Buenos días';
                })()}
                {user?.name ? `, ${user.name}` : ''}
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-500">
              Toca el botón o habla para interactuar con El Fuete
            </p>
          </motion.div>
        )}

        {/* THE MAIN HERO MIC BUTTON / ORB */}
        <div className="relative flex items-center justify-center">
          {/* Animated acoustic ripples when talking / listening */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                key="listening-ripples"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="absolute w-84 h-84 min-[380px]:w-96 min-[380px]:h-96 sm:w-[450px] sm:h-[450px] rounded-full border border-white ai-ripple-1 pointer-events-none"></div>
                <div className="absolute w-84 h-84 min-[380px]:w-96 min-[380px]:h-96 sm:w-[450px] sm:h-[450px] rounded-full border border-white/80 ai-ripple-2 pointer-events-none"></div>
                <div className="absolute w-84 h-84 min-[380px]:w-96 min-[380px]:h-96 sm:w-[450px] sm:h-[450px] rounded-full border border-white/50 ai-ripple-3 pointer-events-none"></div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated soundwave orbit rings while AI is speaking response */}
          <AnimatePresence>
            {isSpeakingResponse && (
              <motion.div
                key="speaking-ripples"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="absolute w-96 h-96 min-[380px]:w-[420px] min-[380px]:h-[420px] sm:w-[480px] sm:h-[480px] rounded-full border border-dashed border-white/40 ai-rotator-slow pointer-events-none"></div>
                <div className="absolute w-84 h-84 min-[380px]:w-96 min-[380px]:h-96 sm:w-[450px] sm:h-[450px] rounded-full border border-white/60 ai-ripple-1 pointer-events-none"></div>
                <div className="absolute w-84 h-84 min-[380px]:w-96 min-[380px]:h-96 sm:w-[450px] sm:h-[450px] rounded-full border border-white/30 ai-ripple-2 pointer-events-none"></div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing indeterminate ring */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                key="processing-ring"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="absolute w-96 h-96 min-[380px]:w-[420px] min-[380px]:h-[420px] sm:w-[480px] sm:h-[480px] rounded-full border-4 border-transparent border-t-white border-r-white animate-spin pointer-events-none"
              />
            )}
          </AnimatePresence>

          <motion.button
            id="hero-voice-button"
            onClick={toggleMic}
            disabled={isProcessing}
            type="button"
            aria-label="Hablar directamente con El Fuete"
            animate={
              isProcessing
                ? { scale: 0.94 }
                : isListening
                ? {
                    scale: [1, 1.035, 1],
                    transition: {
                      scale: {
                        duration: 2.2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    },
                  }
                : isSpeakingResponse
                ? {
                    scale: [1, 1.025, 0.995, 1.02, 1],
                    transition: {
                      scale: {
                        duration: 1.8,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    },
                  }
                : { scale: 1 }
            }
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 24,
            }}
            whileHover={!isProcessing ? { scale: 1.025, transition: { type: 'spring', stiffness: 380, damping: 22 } } : undefined}
            whileTap={!isProcessing ? { scale: 0.94, transition: { type: 'spring', stiffness: 460, damping: 24 } } : undefined}
            title={
              isProcessing
                ? 'Procesando mensaje... Espera a que finalice para enviar otro'
                : isListening
                ? 'Detener y procesar mensaje'
                : isSpeakingResponse
                ? 'Silenciar locución de El Fuete'
                : 'Toca para hablar con El Fuete'
            }
            className={`group relative z-10 w-80 h-80 min-[380px]:w-92 min-[380px]:h-92 sm:w-[420px] sm:h-[420px] rounded-full flex flex-col items-center justify-center transition-colors duration-300 ${
              isProcessing
                ? 'bg-[#121212] text-zinc-400 border-2 border-white/30 cursor-not-allowed pointer-events-none opacity-80 shadow-none'
                : isListening
                ? 'ai-talking-listening bg-white text-black ring-8 ring-white/60'
                : isSpeakingResponse
                ? 'ai-talking-speaking bg-[#161616] text-white border-4 border-white ring-8 ring-white/30'
                : 'bg-black text-white hover:bg-[#121212] border-4 border-white/70 hover:border-white shadow-[0_0_75px_rgba(255,255,255,0.28)] hover:shadow-[0_0_100px_rgba(255,255,255,0.5)]'
            }`}
          >
            {/* Concentric subtle borders inside button */}
            <div
              className={`absolute inset-3.5 sm:inset-4 rounded-full border pointer-events-none transition-colors duration-300 ${
                isListening
                  ? 'border-black/20'
                  : isSpeakingResponse
                  ? 'border-white/40'
                  : 'border-white/25'
              }`}
            ></div>
            <div
              className={`absolute inset-7 sm:inset-8 rounded-full border pointer-events-none transition-colors duration-300 ${
                isListening
                  ? 'border-black/10'
                  : isSpeakingResponse
                  ? 'border-white/20'
                  : 'border-white/10'
              }`}
            ></div>

            <AnimatePresence mode="wait">
              <motion.span
                key={isSpeakingResponse ? 'volume_up' : isProcessing ? 'sync' : 'mic'}
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.88, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={`material-symbols-outlined text-[235px] min-[380px]:text-[275px] sm:text-[320px] leading-none flex items-center justify-center select-none ${
                  isSpeakingResponse
                    ? 'text-white'
                    : isProcessing
                    ? 'text-zinc-400 animate-spin'
                    : isListening
                    ? 'text-black'
                    : 'text-white'
                }`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {isSpeakingResponse ? 'volume_up' : isProcessing ? 'sync' : 'mic'}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* State Indicators with AnimatePresence */}
        <AnimatePresence mode="wait">
          {/* Real-time live speech transcription: escribe lo que el usuario está diciendo */}
          {isListening && (
            <motion.div
              key="listening-state"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 w-full max-w-[420px] px-3 flex flex-col items-center"
            >
              {liveTranscript ? (
                <div className="w-full px-5 py-4 rounded-2xl bg-[#121212] border border-white/20 shadow-2xl backdrop-blur-md text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                    <span>{isWaitingForResponse ? 'Escribiendo tu respuesta...' : 'Escribiendo tu voz...'}</span>
                  </div>
                  <p className="text-white text-base sm:text-lg font-medium leading-relaxed tracking-tight break-words">
                    “{liveTranscript}”
                    <span className="inline-block w-1.5 h-4 ml-1 bg-white animate-pulse align-middle"></span>
                  </p>
                </div>
              ) : isWaitingForResponse ? (
                <div className="px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono tracking-wide text-center flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="font-semibold text-emerald-200">El Fuete espera tu respuesta...</span>
                  <span className="text-[10px] text-emerald-400/80">(Micrófono activo)</span>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-mono tracking-wide text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  <span>Habla ahora, te estoy escuchando...</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Processing State: muestra lo que el usuario dijo mientras la IA procesa */}
          {isProcessing && (
            <motion.div
              key="processing-state"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 w-full max-w-[420px] px-3 flex flex-col items-center"
            >
              <div className="w-full px-5 py-4 rounded-2xl bg-[#121212] border border-white/20 shadow-2xl backdrop-blur-md text-center">
                <div className="flex items-center justify-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  <span className="material-symbols-outlined text-[14px] animate-spin text-white">sync</span>
                  <span>Procesando mensaje</span>
                </div>
                <p className="text-zinc-200 text-sm sm:text-base font-medium leading-relaxed tracking-tight break-words italic">
                  “{lastSpokenQuery || liveTranscript}”
                </p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400">
                  <span className="material-symbols-outlined text-[13px] text-zinc-400">lock</span>
                  <span>Envíos bloqueados mientras se procesa</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Locución de respuesta de El Fuete */}
          {isSpeakingResponse && currentSpeakingText && (
            <motion.div
              key="speaking-state"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 w-full max-w-[440px] px-3 flex flex-col items-center"
            >
              <div className="w-full px-5 py-4 rounded-2xl bg-[#121212] border border-white/20 shadow-2xl backdrop-blur-md text-left max-h-[190px] overflow-y-auto">
                <div className="flex items-center justify-between gap-1.5 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-white animate-pulse">volume_up</span>
                    <span>El Fuete</span>
                  </div>
                  {expectsResponseRef.current && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Esperará tu respuesta
                    </span>
                  )}
                </div>
                <p className="text-white text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {currentSpeakingText}
                </p>

                {/* Real-time notification if El Fuete just created a task */}
                {lastMessage?.createdTask && (
                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-emerald-400 text-[18px] shrink-0">task_alt</span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                          Tarea añadida
                        </div>
                        <p className="text-xs font-medium text-white truncate">
                          "{lastMessage.createdTask.title}"
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0 bg-white/10 text-zinc-200 border-white/20">
                      {lastMessage.createdTask.category}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic Notice if permission is needed */}
        {micNotice && (
          <div className="mt-4 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-tight font-mono max-w-[340px]">
            {micNotice}
          </div>
        )}
      </motion.div>

      {/* ========================================================================= */}
      {/* HISTORIAL DE DIÁLOGO VOCAL RECIENTE (Oculto al hablar con la IA)           */}
      {/* ========================================================================= */}
      <AnimatePresence mode="wait">
        {!isTalkingWithAI && (
          <motion.div
            key="chat-history-container"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col space-y-3 rounded-2xl bg-[#101010] border border-white/15 p-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-white text-[18px]">graphic_eq</span>
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Diálogo con El Fuete
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                type="button"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {showManualInput ? 'keyboard_hide' : 'keyboard'}
                </span>
                <span>{showManualInput ? 'Ocultar teclado' : 'Escribir texto'}</span>
              </motion.button>
            </div>

            {/* Quick Interactive Task Prompts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono">
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  onSendMessage('¡Buenos días! ¿Qué tenemos pendiente para hoy?');
                }}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px] text-amber-300">wb_sunny</span>
                <span>Buenos días</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  onSendMessage('Crea una tarea para ');
                }}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px] text-white">add_task</span>
                <span>Crear tarea</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  onSendMessage('¿Qué tareas tengo pendientes?');
                }}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px] text-white">checklist</span>
                <span>Mis pendientes</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  onSendMessage('Ayúdame a organizar mis prioridades para hoy');
                }}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px] text-white">bolt</span>
                <span>Organizar mi día</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTacticalClick();
                  onSendMessage('Limpia las tareas completadas');
                }}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-zinc-300 hover:text-white transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[13px] text-zinc-400">cleaning_services</span>
                <span>Limpiar completadas</span>
              </button>
            </div>

            {/* Conversation transcript stream */}
            <div className="flex flex-col space-y-3 max-h-[300px] overflow-y-auto py-1">
              {messages.slice(-6).map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex flex-col max-w-[90%] ${
                      isUser ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-white text-black font-medium rounded-br-sm'
                          : 'bg-[#181818] text-zinc-200 border border-white/10 rounded-bl-sm shadow-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Interactive Task Card inside message transcript */}
                      {msg.createdTask && (
                        <div className="mt-2.5 w-full p-2.5 rounded-xl bg-black/60 border border-white/20 flex items-center justify-between gap-2 shadow-inner">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={() => onToggleTask?.(msg.createdTask!.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                msg.createdTask.completed
                                  ? 'bg-white border-white text-black'
                                  : 'border-white/40 hover:border-white text-transparent'
                              }`}
                              title={msg.createdTask.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            </button>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${msg.createdTask.completed ? 'line-through text-zinc-500' : 'text-white'}`}>
                                {msg.createdTask.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                                <span className="text-zinc-300">{msg.createdTask.category}</span>
                                <span>•</span>
                                <span>{msg.createdTask.time}</span>
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold shrink-0 border ${
                            msg.createdTask.completed
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/10 border-white/20 text-zinc-300'
                          }`}>
                            {msg.createdTask.completed ? 'Completada' : 'Agendada'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-zinc-500 font-mono">
                      <span>{msg.time}</span>
                      {!isUser && (
                        <>
                          <button
                            onClick={() => speakText(msg.text, msg.expectsResponse)}
                            className="hover:text-white transition-colors flex items-center gap-0.5"
                            type="button"
                            title="Escuchar de nuevo"
                          >
                            <span className="material-symbols-outlined text-[13px]">volume_up</span>
                            <span>Escuchar</span>
                          </button>
                          <button
                            onClick={() => handleCopy(msg.id, msg.text)}
                            className="hover:text-white transition-colors flex items-center gap-0.5"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {copiedId === msg.id ? 'check' : 'content_copy'}
                            </span>
                            <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>

            {/* Optional text input fallback */}
            <AnimatePresence>
              {showManualInput && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  onSubmit={handleManualSubmit}
                  className="pt-2 border-t border-white/10 flex items-center gap-2 overflow-hidden"
                >
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    disabled={isProcessing}
                    placeholder={isProcessing ? 'Procesando mensaje... Espera un momento' : 'O escribe tu mensaje aquí...'}
                    className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={!manualText.trim() || isProcessing}
                    className="px-3 py-2 rounded-xl bg-white disabled:bg-zinc-800 text-black disabled:text-zinc-500 text-xs font-mono font-bold flex items-center gap-1 hover:bg-zinc-200 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isProcessing ? 'hourglass_top' : 'send'}
                    </span>
                    <span>{isProcessing ? 'Procesando...' : 'Enviar'}</span>
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
