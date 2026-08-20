'use client';

import React from 'react';
import { Archive, CheckSquare, Square, Trash2, X, Download } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  onToggleSelectAll: () => void;
  onBulkDownloadZip: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isDownloadingZip?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  isAllSelected,
  onToggleSelectAll,
  onBulkDownloadZip,
  onBulkDelete,
  onClearSelection,
  isDownloadingZip = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fadeIn">
      <div className="bg-[#0d1117]/95 border border-cyan-500/40 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl px-5 py-3 rounded-2xl flex items-center gap-4 text-sm">
        {/* Selected Counter */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center justify-center font-mono">
            {selectedCount}
          </span>
          <span className="text-white font-medium text-xs">
            {selectedCount === 1 ? 'file selected' : 'files selected'}
          </span>
        </div>

        {/* Toggle Select All */}
        <button
          onClick={onToggleSelectAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-colors"
        >
          {isAllSelected ? (
            <>
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Deselect All</span>
            </>
          ) : (
            <>
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>Select All ({totalCount})</span>
            </>
          )}
        </button>

        {/* Bulk Download ZIP */}
        <button
          onClick={onBulkDownloadZip}
          disabled={isDownloadingZip}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isDownloadingZip ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Archiving ZIP...</span>
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5" />
              <span>Download as ZIP</span>
            </>
          )}
        </button>

        {/* Bulk Delete */}
        <button
          onClick={onBulkDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        {/* Clear Selection (X) */}
        <button
          onClick={onClearSelection}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
