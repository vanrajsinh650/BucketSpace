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
          <div className="bg-[#0a0a0a] border border-[#222] px-4 py-2 rounded-lg flex items-center gap-3 text-xs font-mono shadow-2xl shadow-black/90">
            {/* Selected Count */}
            <div className="flex items-center gap-2 pr-3 border-r border-[#1e1e1e]">
              <span className="text-white font-bold tabular-nums">{selectedCount}</span>
              <span className="text-[#888]">selected</span>
            </div>

            {/* Select All / Clear */}
            <button
              onClick={onToggleSelectAll}
              className="text-[#888] hover:text-white flex items-center gap-1.5 transition-colors btn-press"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-white" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  <span>Select All ({totalCount})</span>
                </>
              )}
            </button>

            {/* Download Zip */}
            <button
              onClick={onBulkDownloadZip}
              disabled={isDownloadingZip}
              className="bg-white text-black hover:bg-[#e0e0e0] px-3 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors btn-press disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isDownloadingZip ? 'Archiving...' : 'Download ZIP'}</span>
            </button>

            {/* Delete Selected */}
            <button
              onClick={onBulkDelete}
              className="text-[#ff3333] hover:bg-[#ff3333]/10 border border-[#ff3333]/30 px-3 py-1 rounded flex items-center gap-1.5 transition-colors btn-press"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            {/* Clear selection icon */}
            <button
              onClick={onClearSelection}
              className="p-1 text-[#555] hover:text-white rounded transition-colors btn-press ml-1"
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
