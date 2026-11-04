import React from 'react';
import { Download, Layers, Cpu, FileText, CheckCircle2, BatteryCharging, BookOpen, Box, FileCode, SlidersHorizontal, Sparkles } from 'lucide-react';

interface CadHeaderProps {
  currentTab: 'canvas' | 'circuits' | 'bom' | 'audit';
  onChangeTab: (tab: 'canvas' | 'circuits' | 'bom' | 'audit') => void;
  onOpenTemplates: () => void;
  onOpenExportModal: () => void;
  onOpenBackupModal: () => void;
  onOpenDstuAlbum: () => void;
  onOpen3DView: () => void;
  onOpenLayersModal?: () => void;
  onOpenDxfImport?: () => void;
  onOpenCustomLibrary?: () => void;
  onNewProject?: () => void;
  auditIssueCount: number;
  autosaveStatus?: 'saved' | 'saving' | 'unsaved';
  lastSavedTime?: string | null;
}

export const CadHeader: React.FC<CadHeaderProps> = ({
  currentTab,
  onChangeTab,
  onOpenTemplates,
  onOpenExportModal,
  onOpenBackupModal,
  onOpenDstuAlbum,
  onOpen3DView,
  onOpenLayersModal,
  onOpenDxfImport,
  onOpenCustomLibrary,
  onNewProject,
  auditIssueCount,
  autosaveStatus = 'saved',
  lastSavedTime,
}) => {
  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-900 px-6 flex items-center justify-between gap-6 z-30 shrink-0">
      {/* Zone 1: Single text element wordmark + Autosave indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold font-mono">
          ⚡
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap font-display leading-tight">
            ElectroPlan CAD
          </span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autosaveStatus === 'saving'
                  ? 'bg-amber-400 animate-ping'
                  : autosaveStatus === 'saved'
                  ? 'bg-emerald-400'
                  : 'bg-neutral-500'
              }`}
            />
            <span className="text-neutral-400">
              {autosaveStatus === 'saving'
                ? 'Збереження...'
                : autosaveStatus === 'saved'
                ? lastSavedTime
                  ? `Збережено о ${lastSavedTime}`
                  : 'Збережено'
                : 'Незбережені зміни'}
            </span>
          </div>
        </div>
      </div>

      {/* Zone 2: Clean single-line navigation links */}
      <nav className="flex items-center gap-1 md:gap-2">
        <button
          onClick={() => onChangeTab('canvas')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            currentTab === 'canvas'
              ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Креслення плану</span>
        </button>

        {onOpenLayersModal && (
          <button
            onClick={onOpenLayersModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-100 bg-sky-950/40 hover:bg-sky-900/60 rounded-md transition-colors whitespace-nowrap shrink-0 border border-sky-500/40 shadow-sm shadow-sky-950/40"
            title="Диспетчер шарів креслення (AutoCAD Layer Manager, пресети освітлення, розеток, штроб)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span>Видимість шарів</span>
          </button>
        )}

        <button
          onClick={onOpen3DView}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-100 bg-cyan-950/40 hover:bg-cyan-900/60 rounded-md transition-colors whitespace-nowrap shrink-0 border border-cyan-500/40 shadow-sm shadow-cyan-950/40"
          title="3D-візуалізація штроблення стін, прокладки у гофрі по стелі та в стяжці"
        >
          <Box className="w-3.5 h-3.5 text-cyan-400" />
          <span>3D Штроби & Траси</span>
        </button>

        <button
          onClick={() => onChangeTab('circuits')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            currentTab === 'circuits'
              ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Щит і розрахунок</span>
        </button>

        <button
          onClick={onOpenBackupModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-md transition-colors whitespace-nowrap shrink-0 border border-emerald-500/30 bg-emerald-950/20"
        >
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          <span>Резерв ДБЖ (Блекаут)</span>
        </button>

        <button
          onClick={onOpenDstuAlbum}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Альбом ДСТУ</span>
        </button>

        <button
          onClick={() => onChangeTab('bom')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            currentTab === 'bom'
              ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Специфікація</span>
        </button>

        <button
          onClick={() => onChangeTab('audit')}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            currentTab === 'audit'
              ? 'bg-neutral-800 text-sky-400 font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Аудит ПУЕ</span>
          {auditIssueCount > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {auditIssueCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <span>Шаблони</span>
        </button>

        {onOpenCustomLibrary && (
          <button
            onClick={onOpenCustomLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-100 bg-amber-950/40 hover:bg-amber-900/60 rounded-md transition-colors whitespace-nowrap shrink-0 border border-amber-500/40 shadow-sm shadow-amber-950/40"
            title="Власна бібліотека CAD (створення, налаштування та імпорт символів і меблів)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Власна бібліотека</span>
          </button>
        )}

        {onNewProject && (
          <button
            onClick={onNewProject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-md transition-colors whitespace-nowrap shrink-0"
            title="Створити новий чистий план"
          >
            <span>+ Новий</span>
          </button>
        )}
      </nav>

      {/* Zone 3: Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenDxfImport && (
          <button
            onClick={onOpenDxfImport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-300 hover:text-emerald-100 bg-emerald-950/40 hover:bg-emerald-900/60 rounded-lg border border-emerald-500/40 transition-colors whitespace-nowrap shadow-sm"
            title="Двосторонній імпорт архітектурного креслення DXF (AutoCAD, ArchiCAD)"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Імпорт DXF</span>
          </button>
        )}

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-neutral-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shadow-sm shadow-sky-500/20 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Експорт / Друк</span>
        </button>
      </div>
    </header>
  );
};
