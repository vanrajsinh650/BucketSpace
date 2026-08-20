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
          initial={{ y: 100, opacity: 0, x: '-50%', scale: 0.95 }}
          animate={{ y: 0, opacity: 1, x: '-50%', scale: 1 }}
          exit={{ y: 100, opacity: 0, x: '-50%', scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
          className="fixed bottom-4 sm:bottom-6 left-1/2 z-40 max-w-[95vw]"
        >
          <div className="bg-zinc-950/80 border border-zinc-800 shadow-2xl shadow-black/80 backdrop-blur-2xl px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs overflow-hidden">
            {/* Glossy top edge highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Selected Counter */}
            <div className="flex items-center gap-1.5 pr-2 sm:pr-3 border-r border-zinc-800">
              <motion.span
                key={selectedCount}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-5 h-5 rounded-full bg-white text-black font-bold text-[11px] flex items-center justify-center font-mono"
              >
                {selectedCount}
              </motion.span>
              <span className="text-zinc-200 font-medium text-xs hidden sm:inline">
                {selectedCount === 1 ? 'selected' : 'selected'}
              </span>
            </div>

            {/* Toggle Select All */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleSelectAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium transition-colors"
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
            </motion.button>

            {/* Bulk Download ZIP */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBulkDownloadZip}
              disabled={isDownloadingZip}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold transition-colors disabled:opacity-50"
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
            </motion.button>

            {/* Bulk Delete */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline text-rose-400">Delete</span>
            </motion.button>

            {/* Clear Selection (X) */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClearSelection}
              className="p-1 rounded-full bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors ml-1"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
