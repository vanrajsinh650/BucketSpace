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
                {isIdentical ? 'This file is already in BucketSpace.' : 'Another file with this name already exists.'}
              </h3>
              <p className="text-xs text-slate-400">
                {isIdentical
                  ? 'We found an exact match for the file you are trying to upload.'
                  : 'Do you want to replace it or keep both?'}
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
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                Skip
              </button>

              <button
                onClick={onUploadAnyway}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-medium transition-all border border-slate-700 flex items-center justify-center"
              >
                Upload anyway
              </button>

              {existing && (
                <details className="mt-2 text-xs group cursor-pointer">
                  <summary className="text-slate-500 hover:text-slate-400 inline-block select-none transition-colors mb-2 text-center w-full">
                    Technical details
                  </summary>
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-2 text-left">
                    <p className="text-slate-400">
                      The file content matches exactly.
                    </p>
                    <button
                      onClick={() => onReplaceExisting(existing.id)}
                      className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all border border-slate-700 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      Update Timestamp & Re-verify
                    </button>
                  </div>
                </details>
              )}
            </>
          ) : (
            /* Name Conflict Different Content Options */
            <>
              <button
                onClick={() => onKeepBoth(checkResult.suggestedName)}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                Keep both
              </button>

              {existing && (
                <button
                  onClick={() => onReplaceExisting(existing.id)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-medium transition-all border border-slate-700 flex items-center justify-center gap-2"
                >
                  Replace existing
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full py-2 text-center text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
