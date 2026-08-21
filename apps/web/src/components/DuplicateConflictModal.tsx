'use client';

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { DuplicateCheckResult } from '@bucketspace/shared';

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

  const suggestedName = checkResult.suggestedName || `${incomingFile.name.replace(/(\.[^.]+)$/, '')} (1)${incomingFile.name.match(/(\.[^.]+)$/)?.[0] || ''}`;
  const existingId = checkResult.existingFile?.id || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">
              Duplicate Conflict Detected
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-white text-xs leading-relaxed font-sans">
            {isIdentical
              ? `An identical file named "${incomingFile.name}" already exists in storage with matching SHA-256 checksum.`
              : `A file named "${incomingFile.name}" exists but with different contents.`}
          </p>

          <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1 text-[11px]">
            <div className="text-[#666] uppercase text-[10px]">Incoming File</div>
            <div className="text-white font-medium truncate">{incomingFile.name}</div>
            <div className="text-[#888] tabular-nums">Size: {incomingFile.size} bytes</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex flex-col gap-2">
          {isIdentical ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSkip}
                className="bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Skip Upload
              </button>
              <button
                onClick={onUploadAnyway}
                className="border border-[#333] hover:border-white text-white py-2 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Upload Copy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onKeepBoth(suggestedName)}
                className="bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Keep Both
              </button>
              <button
                onClick={() => onReplaceExisting(existingId)}
                className="border border-[#333] hover:border-white text-white py-2 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Replace File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
