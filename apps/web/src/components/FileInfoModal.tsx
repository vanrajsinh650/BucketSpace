'use client';

import React from 'react';
import { Calendar, FileCheck, HardDrive, Hash, Layers, ShieldCheck, X } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface FileInfoModalProps {
  file: FileMetadata | null;
  onClose: () => void;
}

export function FileInfoModal({ file, onClose }: FileInfoModalProps) {
  if (!file) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 relative border border-slate-700/80">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white truncate max-w-xs">{file.name}</h3>
              <p className="text-xs text-slate-400">Metadata & Provider Breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" /> Size
              </span>
              <p className="font-semibold text-slate-200 font-mono">{formatSize(file.size)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-purple-400" /> Created
              </span>
              <p className="font-semibold text-slate-200 font-mono">
                {new Date(file.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-amber-400" /> Whole-File SHA-256 Digest
            </span>
            <p className="font-mono text-xs text-cyan-300 break-all select-all bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
              {file.wholeFileHash}
            </p>
          </div>

          {/* Chunk References List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Chunk Provider Map ({file.chunks.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {file.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                >
                  <span className="text-slate-300">Chunk #{chunk.index}</span>
                  <span className="text-slate-400">{formatSize(chunk.size)}</span>
                  <span className="text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                    {chunk.providerRef?.providerId ?? 'none'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
