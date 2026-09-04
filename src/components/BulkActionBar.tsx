'use client';

import React from 'react';
import { Archive, CheckSquare, Square, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: 20, opacity: 0, x: '-50%' }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-6 left-1/2 z-40 max-w-[95vw]"
        >
          <div className="bg-[#121212] border border-[#262626] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex items-center gap-2 sm:gap-3 text-xs font-sans shadow-2xl shadow-black/90 backdrop-blur-md overflow-x-auto max-w-[96vw] sm:max-w-[92vw]">
            {/* Selected Count */}
            <div className="flex items-center gap-1.5 sm:gap-2 pr-2.5 sm:pr-3 border-r border-[#222] shrink-0">
              <span className="text-white font-semibold tabular-nums">{selectedCount}</span>
              <span className="text-zinc-400 text-[11px] sm:text-xs">selected</span>
            </div>

            {/* Select All / Clear */}
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors shrink-0 py-1.5 px-2 rounded-lg hover:bg-zinc-800/50 min-h-[36px]"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Deselect All</span>
                  <span className="sm:hidden">Deselect</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span className="hidden sm:inline">Select All ({totalCount})</span>
                  <span className="sm:hidden">All ({totalCount})</span>
                </>
              )}
            </button>

            {/* Download Zip */}
            <button
              type="button"
              onClick={onBulkDownloadZip}
              disabled={isDownloadingZip}
              className="bg-white text-zinc-950 hover:bg-zinc-200 px-3 sm:px-3.5 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0 min-h-[36px]"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isDownloadingZip ? 'Archiving...' : 'Download ZIP'}</span>
              <span className="sm:hidden">{isDownloadingZip ? '...' : 'ZIP'}</span>
            </button>

            {/* Delete Selected */}
            <button
              type="button"
              onClick={onBulkDelete}
              className="text-rose-400 hover:bg-rose-950/30 border border-rose-900/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors shrink-0 min-h-[36px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            {/* Clear selection icon */}
            <button
              type="button"
              onClick={onClearSelection}
              className="p-1.5 text-zinc-500 hover:text-white rounded-lg transition-colors ml-1 min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0"
              aria-label="Clear selection"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
