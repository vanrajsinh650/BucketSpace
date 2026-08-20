'use client';

import React from 'react';
import { Archive, CheckSquare, Square, Trash2, X } from 'lucide-react';

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
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] pop-in">
      <div className="bg-zinc-950/80 border border-zinc-700 shadow-2xl shadow-black/80 backdrop-blur-xl px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
        {/* Selected Counter */}
        <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-zinc-800">
          <span className="w-5 h-5 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center font-mono">
            {selectedCount}
          </span>
          <span className="text-zinc-200 font-medium text-xs hidden sm:inline">
            {selectedCount === 1 ? 'selected' : 'selected'}
          </span>
        </div>

        {/* Toggle Select All */}
        <button
          onClick={onToggleSelectAll}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white font-medium transition-colors"
        >
          {isAllSelected ? (
            <>
              <CheckSquare className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Deselect All</span>
            </>
          ) : (
            <>
              <Square className="w-3.5 h-3.5 text-zinc-500" />
              <span>All ({totalCount})</span>
            </>
          )}
        </button>

        {/* Bulk Download ZIP */}
        <button
          onClick={onBulkDownloadZip}
          disabled={isDownloadingZip}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold transition-all active:scale-95 disabled:opacity-50"
        >
          {isDownloadingZip ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>Archiving...</span>
            </>
          ) : (
            <>
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </>
          )}
        </button>

        {/* Bulk Delete */}
        <button
          onClick={onBulkDelete}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        {/* Clear Selection (X) */}
        <button
          onClick={onClearSelection}
          className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
