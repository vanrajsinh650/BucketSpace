'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  FileCheck2,
  RefreshCw,
  SkipForward,
  Upload,
  X,
} from 'lucide-react';
import { DuplicateCheckResult } from '@bucketspace/shared';

interface DuplicateConflictModalProps {
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

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isIdentical = checkResult.scenario === 'SAME_NAME_IDENTICAL_CONTENT';
  const existing = checkResult.existingFile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 relative border border-slate-700/80 bg-[#0d1117]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                isIdentical
                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
              }`}
            >
              {isIdentical ? <FileCheck2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">
                {isIdentical ? 'Identical File Detected' : 'File Name Conflict'}
              </h3>
              <p className="text-xs text-slate-400">
                {isIdentical
                  ? 'This file is byte-identical to a previously stored file.'
                  : 'A file with this name already exists in your workspace.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Comparison Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
          {/* Existing File */}
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Existing Stored File
            </span>
            <p className="font-semibold text-slate-200 truncate">{existing?.name ?? incomingFile.name}</p>
            <div className="space-y-0.5 text-slate-400 font-mono text-[11px]">
              <div>Size: {existing ? formatSize(existing.size) : 'Unknown'}</div>
              <div>
                Uploaded:{' '}
                {existing ? new Date(existing.createdAt).toLocaleDateString() : 'Previously'}
              </div>
            </div>
          </div>

          {/* Incoming File */}
          <div className="space-y-1.5 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
            <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">
              New File To Upload
            </span>
            <p className="font-semibold text-white truncate">{incomingFile.name}</p>
            <div className="space-y-0.5 text-cyan-300 font-mono text-[11px]">
              <div>Size: {formatSize(incomingFile.size)}</div>
              <div>Date: Just Now</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {isIdentical ? (
            /* True Duplicate Options */
            <>
              <button
                onClick={onSkip}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm transition-all border border-slate-700 flex items-center justify-center gap-2"
              >
                <SkipForward className="w-4 h-4 text-amber-400" />
                Skip (Recommended — Save Storage)
              </button>

              {existing && (
                <button
                  onClick={() => onReplaceExisting(existing.id)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all border border-slate-800 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  Replace Existing Timestamp & Chunks
                </button>
              )}

              <button
                onClick={onUploadAnyway}
                className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Upload anyway as a separate copy
              </button>
            </>
          ) : (
            /* Name Conflict Different Content Options */
            <>
              <button
                onClick={() => onKeepBoth(checkResult.suggestedName)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Keep Both → Save as &quot;{checkResult.suggestedName}&quot;
              </button>

              {existing && (
                <button
                  onClick={() => onReplaceExisting(existing.id)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-all border border-slate-700 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  Replace Existing &quot;{existing.name}&quot;
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Cancel Upload
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
