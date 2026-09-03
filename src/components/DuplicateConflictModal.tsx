'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { DuplicateCheckResult } from '@/shared';
import { formatBytes } from '../lib/utils';

export interface DuplicateConflictModalProps {
  isOpen: boolean;
  incomingFile: File | null;
  checkResult: DuplicateCheckResult | null;
  onKeepBoth: (suggestedName: string) => void;
  onReplaceExisting: (existingFileId: string) => void;
  onSkip: () => void;
  onUploadAnyway: () => void;
  onClose: () => void;
}

export function DuplicateConflictModal({
  isOpen,
  incomingFile,
  checkResult,
  onKeepBoth,
  onReplaceExisting,
  onSkip,
  onUploadAnyway,
  onClose,
}: DuplicateConflictModalProps) {
  if (!isOpen || !incomingFile || !checkResult) return null;

  const isIdentical =
    checkResult.scenario === 'SAME_NAME_IDENTICAL_CONTENT' ||
    checkResult.scenario === 'DIFFERENT_NAME_IDENTICAL_CONTENT';

  const suggestedName =
    checkResult.suggestedName ||
    `${incomingFile.name.replace(/(\.[^.]+)$/, '')} (1)${incomingFile.name.match(/(\.[^.]+)$/)?.[0] || ''}`;
  const existingId = checkResult.existingFile?.id || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-900/50 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 id="conflict-dialog-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              File Conflict Detected
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          <p className="text-zinc-300 text-xs leading-relaxed">
            {isIdentical
              ? `An identical file named "${incomingFile.name}" already exists in your vault with matching cryptographic verification.`
              : `A file named "${incomingFile.name}" already exists with different contents.`}
          </p>

          <div className="bg-[#161616] p-3.5 border border-[#262626] rounded-xl space-y-1 text-xs">
            <div className="text-zinc-500 text-[11px] font-medium">Incoming File</div>
            <div className="text-zinc-100 font-medium truncate">{incomingFile.name}</div>
            <div className="text-zinc-400 tabular-nums text-[11px]">Size: {formatBytes(incomingFile.size)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex flex-col gap-2.5">
          {isIdentical ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onSkip}
                className="bg-white text-zinc-950 hover:bg-zinc-200 py-2.5 rounded-xl font-semibold text-xs transition-colors min-h-[44px] flex items-center justify-center"
              >
                Skip Upload
              </button>
              <button
                type="button"
                onClick={onUploadAnyway}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl font-medium text-xs transition-colors min-h-[44px] flex items-center justify-center"
              >
                Upload Copy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onKeepBoth(suggestedName)}
                className="bg-white text-zinc-950 hover:bg-zinc-200 py-2.5 rounded-xl font-semibold text-xs transition-colors min-h-[44px] flex items-center justify-center"
              >
                Keep Both
              </button>
              <button
                type="button"
                onClick={() => onReplaceExisting(existingId)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl font-medium text-xs transition-colors min-h-[44px] flex items-center justify-center"
              >
                Replace Existing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
