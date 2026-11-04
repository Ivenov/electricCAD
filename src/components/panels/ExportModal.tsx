/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Download, Printer, FileJson, Upload, FileCode, Image as ImageIcon, FileSpreadsheet, AlertCircle, Box } from 'lucide-react';
import { CadProject } from '../../types/cad';
import { downloadDxfFile } from '../../utils/dxfExport';
import { downloadIfcFile } from '../../utils/ifcExport';
import { generateCadProjectSvg } from '../../utils/svgExport';
import { validateAndParseProjectJson } from '../../utils/storage';

interface ExportModalProps {
  project: CadProject;
  onImportProject: (imported: CadProject) => void;
  onOpenDstuAlbum?: () => void;
  onOpen3DView?: () => void;
  onOpenDxfImport?: () => void;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  project,
  onImportProject,
  onOpenDstuAlbum,
  onOpen3DView,
  onOpenDxfImport,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);

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

  // 2. Import JSON with Schema Validation and in-modal error handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportErrors([]);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = validateAndParseProjectJson(content);
      if (res.valid && res.project) {
        onImportProject(res.project);
        onClose();
      } else {
        setImportErrors(res.errors);
      }
    };
    reader.readAsText(file);
  };

  // 3. Export SVG from CAD project model
  const handleExportSvg = () => {
    const svgContent = generateCadProjectSvg(project);
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.title.replace(/\s+/g, '_')}_Векторне_креслення.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // 4. Export PNG canvas snapshot
  const handleExportPng = () => {
    // Шукаємо Konva або будь-який HTML5 canvas на сторінці
    const canvas = document.querySelector('.konvajs-content canvas') as HTMLCanvasElement || document.querySelector('canvas') as HTMLCanvasElement;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${project.title.replace(/\s+/g, '_')}_План_електрики.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    // Якщо канвас не знайдено (наприклад SVG режим), конвертуємо SVG у PNG через Image
    const svgContent = generateCadProjectSvg(project);
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width || 1920;
      tempCanvas.height = img.height || 1080;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(img, 0, 0);
        const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${project.title.replace(/\s+/g, '_')}_План_електрики.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // 5. Print layout
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
              <h2 className="text-base font-bold text-white font-display">Експорт та збереження проекту</h2>
              <p className="text-xs text-neutral-400">Формати AutoCAD, векторний SVG, растровий PNG та проектні дані JSON</p>
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
        <div className="p-6 space-y-4">
          {importErrors.length > 0 && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Помилка валідації файлу проекту:</div>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-rose-300">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* AutoCAD DXF Export */}
            <button
              onClick={() => {
                downloadDxfFile(project);
                onClose();
              }}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800/80 hover:border-amber-500/40 transition-all text-left group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <FileCode className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">.DXF</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Креслення AutoCAD</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Векторні шари стін, електроточок та трас кабелів</p>
              </div>
            </button>

            {/* PNG Image Export */}
            <button
              onClick={handleExportPng}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800/80 hover:border-emerald-500/40 transition-all text-left group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <ImageIcon className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">.PNG</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Зображення плану</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Висока роздільна здатність для замовника та презентацій</p>
              </div>
            </button>

            {/* SVG Vector Export */}
            <button
              onClick={handleExportSvg}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800/80 hover:border-sky-500/40 transition-all text-left group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <Download className="w-6 h-6 text-sky-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">.SVG</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Векторний SVG</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Масштабоване креслення для друку та редагування</p>
              </div>
            </button>

            {/* JSON Project Backup */}
            <button
              onClick={handleExportJson}
              className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 hover:bg-neutral-800/80 hover:border-purple-500/40 transition-all text-left group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <FileJson className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">.JSON</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-200">Файл проекту ElectroPlan</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">Повна резервна копія даних із версією схеми</p>
              </div>
            </button>

            {/* OpenBIM / IFC 4.3 Export */}
            <button
              onClick={() => {
                downloadIfcFile(project);
                onClose();
              }}
              className="col-span-2 p-4 rounded-xl border border-sky-500/40 bg-sky-950/20 hover:bg-sky-900/40 transition-all text-left group flex items-center justify-between shadow-sm shadow-sky-950/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Box className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">OpenBIM / IFC 4.3 (ISO 16739-1:2024)</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">.IFC</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 mt-0.5">
                    3D-стіни, кімнати, електроточки та траси для Autodesk Revit, ArchiCAD, BlenderBIM
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-sky-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Import JSON File */}
          <div className="pt-2 border-t border-neutral-800">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-3 rounded-xl border border-dashed border-neutral-700 hover:border-sky-500/60 bg-neutral-950 hover:bg-neutral-900/60 transition-colors flex items-center justify-center gap-2 text-xs font-semibold text-neutral-300"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              <span>Імпортувати збережений проект (.JSON)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
