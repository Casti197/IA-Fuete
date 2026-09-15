import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantMessage, AssistantTask, DetailData, UserProfile } from '../types';
import { playTacticalClick, playConfirmTone } from '../utils/soundEffects';
import { VoiceChatView } from './VoiceChatView';

interface DashboardScreenProps {
  user: UserProfile;
  messages: AssistantMessage[];
  tasks: AssistantTask[];
  onSendMessage: (text: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddTask: (title: string, category: AssistantTask['category'], notes?: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenVoice: () => void;
  onOpenDetail: (detail: DetailData) => void;
  voiceTriggerCount?: number;
  isVoiceActive?: boolean;
  onVoiceActiveChange?: (isActive: boolean) => void;
  isProcessing?: boolean;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  messages,
  tasks,
  onSendMessage,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  voiceTriggerCount = 0,
  isVoiceActive = false,
  onVoiceActiveChange,
  isProcessing = false,
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<AssistantTask['category']>('Trabajo');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    playConfirmTone();
    onAddTask(newTaskTitle.trim(), newTaskCategory, newTaskNotes.trim());
    setNewTaskTitle('');
    setNewTaskNotes('');
    setIsAddingTask(false);
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'pending') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    return true;
  });

  return (
    <div
      className={`flex flex-col px-4 min-h-screen transition-all duration-500 ${
        isVoiceActive ? 'justify-center items-center py-0' : 'space-y-5 pt-2 pb-10'
      }`}
    >
      {/* Voice Assistant Centerpiece & Live Acoustic Engine */}
      <VoiceChatView
        user={user}
        messages={messages}
        onSendMessage={onSendMessage}
        onAddTask={onAddTask}
        onToggleTask={onToggleTask}
        voiceTriggerCount={voiceTriggerCount}
        onVoiceActiveChange={onVoiceActiveChange}
        isProcessing={isProcessing}
      />

      {/* Tareas & Agenda Section (Oculto al hablar con la IA) */}
      <AnimatePresence mode="wait">
        {!isVoiceActive && (
          <motion.section
            key="agenda-section"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col space-y-3.5 flex-1 w-full"
          >
            {/* Task Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#121212] border border-white/10 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-white">checklist</span>
                  <h2 className="text-sm font-bold text-white">Tareas de {user.name}</h2>
                  {pendingCount > 0 && (
                    <motion.span
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-white font-mono text-[10px] font-bold"
                    >
                      {pendingCount} pendientes
                    </motion.span>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    playTacticalClick();
                    setIsAddingTask(!isAddingTask);
                  }}
                  className="px-3 py-1 rounded-lg bg-white text-black font-mono text-xs font-bold flex items-center gap-1 hover:bg-zinc-200 transition-colors shadow-sm"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {isAddingTask ? 'close' : 'add'}
                  </span>
                  <span>{isAddingTask ? 'Cancelar' : 'Nueva Tarea'}</span>
                </motion.button>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                  <span>Progreso ({completedCount} de {tasks.length} completadas)</span>
                  <span className="text-white font-bold">{completionRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#222222] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionRate}%` }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-[#141414] border border-white/10 text-xs font-mono">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  playTacticalClick();
                  setTaskFilter('all');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  taskFilter === 'all' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
                type="button"
              >
                Todas ({tasks.length})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  playTacticalClick();
                  setTaskFilter('pending');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  taskFilter === 'pending' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
                type="button"
              >
                Pendientes ({pendingCount})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  playTacticalClick();
                  setTaskFilter('completed');
                }}
                className={`flex-1 py-1.5 rounded-lg transition-colors ${
                  taskFilter === 'completed' ? 'bg-white text-black font-bold shadow-sm' : 'text-zinc-400 hover:text-white'
                }`}
                type="button"
              >
                Hechas ({completedCount})
              </motion.button>
            </div>

            {/* Add Task Quick Form */}
            <AnimatePresence>
              {isAddingTask && (
                <motion.form
                  key="new-task-form"
                  initial={{ opacity: 0, height: 0, scale: 0.97 }}
                  animate={{ opacity: 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.97 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  onSubmit={handleCreateTask}
                  className="p-3.5 rounded-xl bg-[#141414] border border-white/20 space-y-2.5 shadow-lg overflow-hidden"
                >
                  <span className="text-xs font-mono font-bold text-white uppercase block">
                    Crear Tarea Personal
                  </span>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Título de la tarea (ej. Comprar insumos, Redactar informe...)"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newTaskCategory}
                      onChange={(e) => setNewTaskCategory(e.target.value as AssistantTask['category'])}
                      className="px-2.5 py-1.5 rounded-lg bg-black border border-white/20 text-xs text-white font-mono focus:outline-none"
                    >
                      <option value="Trabajo">Trabajo</option>
                      <option value="Prioridad">Prioridad</option>
                      <option value="Personal">Personal</option>
                      <option value="Idea">Idea</option>
                    </select>
                    <input
                      type="text"
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      placeholder="Nota u horario..."
                      className="px-3 py-1.5 rounded-lg bg-black border border-white/20 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      onClick={() => setIsAddingTask(false)}
                      className="px-3 py-1.5 rounded-lg bg-[#242424] text-zinc-300 hover:text-white text-xs font-mono"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-mono font-bold hover:bg-zinc-200"
                    >
                      Guardar Tarea
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Task Cards List */}
            <AnimatePresence mode="popLayout">
              {filteredTasks.length === 0 ? (
                <motion.div
                  key="empty-tasks-state"
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                  className="p-8 rounded-xl bg-[#121212] border border-white/10 flex flex-col items-center justify-center text-center space-y-2 shadow-sm flex-1"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-[24px]">done_all</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Bandeja al día</h3>
                  <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed">
                    {taskFilter === 'completed'
                      ? 'No hay tareas completadas registradas.'
                      : 'No tienes tareas pendientes en esta vista.'}
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      playTacticalClick();
                      setIsAddingTask(true);
                    }}
                    className="mt-2 px-3.5 py-1.5 rounded-lg bg-white text-black font-mono text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-colors"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                    <span>Crear Tarea</span>
                  </motion.button>
                </motion.div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {filteredTasks.map((task) => (
                    <motion.article
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, y: -6 }}
                      transition={{ type: 'spring', damping: 26, stiffness: 350 }}
                      className={`p-3.5 rounded-xl bg-[#121212] border transition-colors flex items-start justify-between gap-3 ${
                        task.completed ? 'border-white/5 opacity-60' : 'border-white/10 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.88 }}
                          onClick={() => {
                            playConfirmTone();
                            onToggleTask(task.id);
                          }}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                            task.completed
                              ? 'bg-white border-white text-black'
                              : 'border-white/30 hover:border-white text-transparent'
                          }`}
                          type="button"
                          aria-label="Marcar tarea"
                        >
                          <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                        </motion.button>

                        <div className="flex flex-col min-w-0 flex-1">
                          <span
                            className={`text-xs font-medium text-white transition-all ${
                              task.completed ? 'line-through text-zinc-400' : ''
                            }`}
                          >
                            {task.title}
                          </span>
                          {task.notes && (
                            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                              {task.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[9px] uppercase border border-white/15">
                              {task.category}
                            </span>
                            <span className="text-zinc-500 font-mono text-[10px]">{task.time}</span>
                          </div>
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.15, color: '#ffffff' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          playTacticalClick();
                          onDeleteTask(task.id);
                        }}
                        className="text-zinc-500 hover:text-white p-1 transition-colors"
                        type="button"
                        title="Eliminar tarea"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </motion.button>
                    </motion.article>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};
