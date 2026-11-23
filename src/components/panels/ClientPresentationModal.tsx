/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Модуль узгодження з замовником та шар коментарів (Client Presentation & Notes Layer)
 * Забезпечує інтерактивний режим презентації плану клієнту без інженерного візуального шуму
 * та дозволяє залишати стікери-побажання/правки з воркфлоу статусів (pending -> approved -> resolved).
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  Send,
  MapPin,
  Share2,
  Filter,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { CadProject, ClientNote, Point } from '../../types/cad';

interface ClientPresentationModalProps {
  isOpen: boolean;
  project: CadProject;
  onUpdateProject: (updated: CadProject) => void;
  onClose: () => void;
  onFocusPosition?: (pos: Point) => void;
  onActivateNoteTool?: () => void;
}

export const ClientPresentationModal: React.FC<ClientPresentationModalProps> = ({
  isOpen,
  project,
  onUpdateProject,
  onClose,
  onFocusPosition,
  onActivateNoteTool,
}) => {
  const notes: ClientNote[] = project.clientNotes || [];
  const presentationMode = project.presentationMode || false;

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState('Замовник');
  const [newNoteCategory, setNewNoteCategory] = useState<ClientNote['category']>('socket');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  if (!isOpen) return null;

  // Toggle presentation mode
  const handleTogglePresentationMode = () => {
    onUpdateProject({
      ...project,
      presentationMode: !presentationMode,
    });
  };

  // Add new note at center of canvas or selected point
  const handleAddNote = () => {
    if (!newNoteText.trim()) return;

    // Use center of first room or default (300, 300)
    const centerPos: Point =
      project.rooms.length > 0 && project.rooms[0].points.length > 0
        ? project.rooms[0].points[0]
        : { x: 350, y: 350 };

    const newNote: ClientNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      position: centerPos,
      author: newNoteAuthor,
      text: newNoteText.trim(),
      category: newNoteCategory,
      status: 'pending',
      createdAt: new Date().toISOString(),
      floorId: project.activeFloorId,
    };

    onUpdateProject({
      ...project,
      clientNotes: [...notes, newNote],
    });

    setNewNoteText('');
    setSelectedNoteId(newNote.id);
  };

  // Update status of note
  const handleUpdateStatus = (noteId: string, status: ClientNote['status']) => {
    const updated = notes.map((n) => (n.id === noteId ? { ...n, status } : n));
    onUpdateProject({
      ...project,
      clientNotes: updated,
    });
  };

  // Add reply to note
  const handleAddReply = (noteId: string) => {
    if (!replyText.trim()) return;
    const updated = notes.map((n) =>
      n.id === noteId ? { ...n, replyText: replyText.trim(), status: 'resolved' as const } : n
    );
    onUpdateProject({
      ...project,
      clientNotes: updated,
    });
    setReplyText('');
  };

  // Delete note
  const handleDeleteNote = (noteId: string) => {
    const updated = notes.filter((n) => n.id !== noteId);
    onUpdateProject({
      ...project,
      clientNotes: updated,
    });
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  // Filtered notes list
  const filteredNotes = notes.filter((n) => {
    if (filterStatus !== 'all' && n.status !== filterStatus) return false;
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    return true;
  });

  // Statistics
  const pendingCount = notes.filter((n) => n.status === 'pending').length;
  const approvedCount = notes.filter((n) => n.status === 'approved').length;
  const resolvedCount = notes.filter((n) => n.status === 'resolved').length;

  // Copy notes summary to clipboard
  const handleCopyNotesSummary = () => {
    if (notes.length === 0) return;
    const lines = [
      `📋 ЗАУВАЖЕННЯ ТА ПОБАЖАННЯ ДО ПРОЄКТУ: ${project.title}`,
      `Дата: ${new Date().toLocaleDateString('uk-UA')}`,
      `Всього запитів: ${notes.length} (В роботі: ${pendingCount}, Виконано: ${resolvedCount})`,
      '--------------------------------------------------',
      ...notes.map(
        (n, i) =>
          `${i + 1}. [${n.author}] [${n.category || 'загальне'}] [Статус: ${
            n.status === 'pending'
              ? 'Очікує'
              : n.status === 'approved'
              ? 'Погоджено'
              : n.status === 'resolved'
              ? 'Виконано'
              : 'Відхилено'
          }]\n   ${n.text}${n.replyText ? `\n   -> Відповідь інженера: ${n.replyText}` : ''}`
      ),
    ];
    navigator.clipboard?.writeText(lines.join('\n\n'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <MessageSquare className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-display">
                  Режим узгодження та зауваження клієнта
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  {notes.length} запитів
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Спільна робота замовника, дизайнера та інженера-електрика
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Presentation Mode Toggle */}
            <button
              type="button"
              onClick={handleTogglePresentationMode}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                presentationMode
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950/50'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
              }`}
              title="Приховує складні штроби та кабельні пучки, залишаючи чистий план приміщень з висотами"
            >
              {presentationMode ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-neutral-400" />}
              <span>{presentationMode ? 'Презентація: УВІМК' : 'Презентація: ВИМК'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Notes List & Filters */}
          <div className="w-7/12 border-r border-neutral-800 flex flex-col bg-neutral-950/40">
            {/* Filter Bar */}
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterStatus === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Всі ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('pending')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterStatus === 'pending'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 font-bold'
                      : 'text-amber-400/80 hover:text-amber-300'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>В роботі ({pendingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('resolved')}
                  className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterStatus === 'resolved'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Виконано ({resolvedCount})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyNotesSummary}
                className="text-[11px] text-neutral-400 hover:text-sky-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-800 transition-colors"
                title="Скопіювати всі зауваження для Viber/Telegram/Email"
              >
                <Share2 className="w-3 h-3" />
                <span>Скопіювати</span>
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredNotes.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs">
                  Зауважень у цій категорії немає. Натисніть «+ Додати» або клікніть інструментом на плані.
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isSelected = selectedNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-950/20 shadow-md ring-1 ring-sky-500/30'
                          : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              note.status === 'pending'
                                ? 'bg-amber-400 ring-2 ring-amber-400/20'
                                : note.status === 'approved'
                                ? 'bg-sky-400'
                                : note.status === 'resolved'
                                ? 'bg-emerald-400'
                                : 'bg-rose-400'
                            }`}
                          />
                          <span className="text-xs font-bold text-white">{note.author}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                            {note.category === 'socket'
                              ? 'Розетки'
                              : note.category === 'switch'
                              ? 'Вимикачі'
                              : note.category === 'light'
                              ? 'Світло'
                              : note.category === 'furniture'
                              ? 'Меблі'
                              : 'Загальне'}
                          </span>
                        </div>

                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(note.createdAt).toLocaleDateString('uk-UA')}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-200 line-clamp-2 leading-relaxed">
                        {note.text}
                      </p>

                      {note.replyText && (
                        <div className="mt-2 pl-2 border-l-2 border-emerald-500/50 text-[11px] text-emerald-300">
                          <span className="font-semibold">Інженер:</span> {note.replyText}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Add Note on Plan Button */}
            {onActivateNoteTool && (
              <div className="p-3 border-t border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Поставити позначку прямо на кресленні:</span>
                <button
                  type="button"
                  onClick={() => {
                    onActivateNoteTool();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 rounded-lg transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Клікнути на плані</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Selected Note Detail & Reply Form */}
          <div className="w-5/12 flex flex-col p-4 bg-neutral-900 overflow-y-auto">
            {selectedNoteId ? (
              (() => {
                const note = notes.find((n) => n.id === selectedNoteId);
                if (!note) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-neutral-400">ID: {note.id.slice(0, 12)}</span>
                      <div className="flex items-center gap-2">
                        {onFocusPosition && (
                          <button
                            type="button"
                            onClick={() => onFocusPosition(note.position)}
                            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 p-1 hover:bg-neutral-800 rounded"
                            title="Показати на плані"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>На план</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1 rounded hover:bg-neutral-800"
                          title="Видалити зауваження"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{note.author}</span>
                        <span className="text-neutral-400 text-[10px]">
                          {new Date(note.createdAt).toLocaleString('uk-UA')}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap">
                        {note.text}
                      </p>
                    </div>

                    {/* Status Changer */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                        Статус виконання:
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(note.id, 'pending')}
                          className={`py-1.5 px-2 rounded-lg border font-semibold flex items-center justify-center gap-1 ${
                            note.status === 'pending'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-500/60'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>Очікує</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(note.id, 'approved')}
                          className={`py-1.5 px-2 rounded-lg border font-semibold flex items-center justify-center gap-1 ${
                            note.status === 'approved'
                              ? 'bg-sky-950/60 text-sky-300 border-sky-500/60'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>Погоджено</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(note.id, 'resolved')}
                          className={`py-1.5 px-2 rounded-lg border font-semibold flex items-center justify-center gap-1 ${
                            note.status === 'resolved'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/60'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Виконано</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(note.id, 'rejected')}
                          className={`py-1.5 px-2 rounded-lg border font-semibold flex items-center justify-center gap-1 ${
                            note.status === 'rejected'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/60'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Відхилено</span>
                        </button>
                      </div>
                    </div>

                    {/* Engineer Reply Box */}
                    <div className="pt-2 border-t border-neutral-800 space-y-2">
                      <label className="block text-xs font-semibold text-neutral-300">
                        Коментар / відповідь інженера:
                      </label>
                      <textarea
                        value={replyText || note.replyText || ''}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="напр. 'Перенесено на висоту +1100мм згідно дизайн-проєкту'"
                        className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg p-2.5 text-xs text-white outline-none resize-none h-20"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddReply(note.id)}
                        className="w-full py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Зберегти відповідь інженера</span>
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Create New Note Form */
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Нове побажання або правка
                </h4>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Хто вносить правку:</label>
                  <select
                    value={newNoteAuthor}
                    onChange={(e) => setNewNoteAuthor(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="Замовник">Замовник / Власник</option>
                    <option value="Дизайнер">Дизайнер інтер'єру</option>
                    <option value="Електромонтажник">Електромонтажник</option>
                    <option value="Головний інженер">Головний інженер</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Категорія:</label>
                  <select
                    value={newNoteCategory}
                    onChange={(e) => setNewNoteCategory(e.target.value as any)}
                    className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="socket">Розетки та силові пости</option>
                    <option value="switch">Вимикачі та керування</option>
                    <option value="light">Освітлення та світильники</option>
                    <option value="furniture">Меблі та розташування</option>
                    <option value="change_request">Запит на зміну конфігурації</option>
                    <option value="general">Загальне питання</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Опис побажання / запитання:</label>
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="наприклад: 'Потрібно ще 2 розетки праворуч від робочого столу для принтера та зарядки'"
                    className="w-full bg-neutral-950 border border-neutral-700 focus:border-sky-500 rounded-lg p-2.5 text-xs text-white outline-none resize-none h-28"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim()}
                  className="w-full py-2 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-neutral-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-sky-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Додати зауваження</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
