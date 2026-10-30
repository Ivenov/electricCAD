import React, { useRef } from 'react';
import { Download, Printer, FileJson, Upload, FileCode, BookOpen, Layers, Box } from 'lucide-react';
import { CadProject } from '../../types/cad';
import { downloadDxfFile } from '../../utils/dxfExport';

interface ExportModalProps {
  project: CadProject;
  onImportProject: (imported: CadProject) => void;
  onOpenDstuAlbum?: () => void;
  onOpen3DView?: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ project, onImportProject, onOpenDstuAlbum, onOpen3DView, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export as JSON
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.title.replace(/\s+/g, '_')}_CAD.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 2. Import JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.walls && json.elements) {
          onImportProject(json);
          onClose();
        } else {
          alert('Невірний формат файлу проекту CAD.');
        }
      } catch (err) {
        alert('Помилка при читанні JSON файлу.');
      }
    };
    reader.readAsText(file);
  };

  // 3. Export SVG
  const handleExportSvg = () => {
    const svgElement = document.querySelector('svg.pointer-events-auto') as SVGSVGElement;
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgElement);

    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/\s+/g, '_')}_Blueprint.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // 4. Print layout
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">Експорт та друк проекту</h2>
              <p className="text-xs text-neutral-400">Збереження креслень, специфікацій та файлів даних</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-2 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          {/* DSTU Full Drawing Album */}
          {onOpenDstuAlbum && (
            <button
              onClick={() => {
                onOpenDstuAlbum();
                onClose();
              }}
              className="w-full p-3.5 rounded-xl border border-sky-500/40 bg-sky-950/30 hover:bg-sky-950/50 hover:border-sky-400 flex items-center gap-3.5 text-left transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors flex items-center gap-2">
                  <span>Альбом креслень за стандартом ДСТУ (5 аркушів)</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/30 text-sky-200 border border-sky-400/40 font-mono">
                    А4 / А3
                  </span>
                </div>
                <div className="text-[11px] text-neutral-300">
                  Повний комплект: пояснювальна записка, плани розеток та освітлення, однолінійна схема щита, кабельний журнал
                </div>
              </div>
            </button>
          )}

          {/* 3D Chases & Cables Visualization */}
          {onOpen3DView && (
            <button
              onClick={() => {
                onClose();
                onOpen3DView();
              }}
              className="w-full p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-neutral-950 hover:border-cyan-400 flex items-center gap-3.5 text-left transition-colors group shadow-lg shadow-cyan-950/30"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
                <Box className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                  <span>3D-Візуалізація штроблення та розведення</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 font-mono">
                    Three.js WebGL
                  </span>
                </div>
                <div className="text-[11px] text-neutral-300">
                  Просторовий огляд: вертикальні опуски у штробах (25×25мм), гофра по стелі та в стяжці, щит ВРП та ДБЖ
                </div>
              </div>
            </button>
          )}

          {/* AutoCAD DXF */}
          <button
            onClick={() => downloadDxfFile(project)}
            className="w-full p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 hover:border-neutral-700 flex items-center gap-3.5 text-left transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-neutral-100 group-hover:text-amber-400 transition-colors flex items-center gap-2">
                <span>Експорт в AutoCAD (.DXF R12 / 2000)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                  AutoCAD / LibreCAD
                </span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Векторний CAD-файл із шарами стін (A-WALLS), розеток (E-SOCKETS), щита та кабельних трас (E-WIRING)
              </div>
            </div>
          </button>

          {/* SVG Vector */}
          <button
            onClick={handleExportSvg}
            className="w-full p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 hover:border-neutral-700 flex items-center gap-3.5 text-left transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-sky-950/50 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-neutral-100 group-hover:text-sky-400 transition-colors">
                Векторне креслення SVG (Архітектурний план)
              </div>
              <div className="text-[11px] text-neutral-400">
                Ідеально для масштабування без втрати якості та відкриття у векторних редакторах
              </div>
            </div>
          </button>

          {/* JSON File */}
          <button
            onClick={handleExportJson}
            className="w-full p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 hover:border-neutral-700 flex items-center gap-3.5 text-left transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0">
              <FileJson className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-neutral-100 group-hover:text-amber-400 transition-colors">
                Зберегти проект у файл JSON
              </div>
              <div className="text-[11px] text-neutral-400">
                Повна база проекту: стіни, розетки, кабелі, групи та параметри щита
              </div>
            </div>
          </button>

          {/* Import JSON */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 hover:border-neutral-700 flex items-center gap-3.5 text-left transition-colors group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <div className="w-9 h-9 rounded-lg bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-neutral-100 group-hover:text-emerald-400 transition-colors">
                Відкрити збережений проект (JSON)
              </div>
              <div className="text-[11px] text-neutral-400">
                Завантажити створене раніше креслення з диска
              </div>
            </div>
          </button>

          {/* Print Sheet */}
          <button
            onClick={handlePrint}
            className="w-full p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 hover:border-neutral-700 flex items-center gap-3.5 text-left transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-950/50 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-neutral-100 group-hover:text-purple-400 transition-colors">
                Друк креслення (PDF / Принтер)
              </div>
              <div className="text-[11px] text-neutral-400">
                Виведення на друк зі штампом ДСТУ та розмірами
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
