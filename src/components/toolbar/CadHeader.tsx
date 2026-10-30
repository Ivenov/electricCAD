import React from 'react';
import { Download, Layers, Cpu, FileText, CheckCircle2, BatteryCharging, BookOpen, Box } from 'lucide-react';

interface CadHeaderProps {
  currentTab: 'canvas' | 'circuits' | 'bom' | 'audit';
  onChangeTab: (tab: 'canvas' | 'circuits' | 'bom' | 'audit') => void;
  onOpenTemplates: () => void;
  onOpenExportModal: () => void;
  onOpenBackupModal: () => void;
  onOpenDstuAlbum: () => void;
  onOpen3DView: () => void;
  auditIssueCount: number;
}

export const CadHeader: React.FC<CadHeaderProps> = ({
  currentTab,
  onChangeTab,
  onOpenTemplates,
  onOpenExportModal,
  onOpenBackupModal,
  onOpenDstuAlbum,
  onOpen3DView,
  auditIssueCount,
}) => {
  return (
    <header className="h-14 border-b border-neutral-800 bg-neutral-900 px-6 flex items-center justify-between gap-6 z-30 shrink-0">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold font-mono">
          ⚡
        </div>
        <span className="text-base font-bold tracking-tight text-white whitespace-nowrap font-display">
          ElectroPlan CAD
        </span>
      </div>

      {/* Zone 2: 4–5 clean single-line navigation links */}
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
      </nav>

      {/* Zone 3: 1 primary action button */}
      <div className="flex items-center gap-2 shrink-0">
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
