'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, Database, HardDrive, Info } from 'lucide-react';
import { FileMetadata } from '@/shared';
import { formatBytes } from '../lib/utils';

interface FileInfoModalProps {
  file: FileMetadata | null;
  onClose: () => void;
}

export function FileInfoModal({ file, onClose }: FileInfoModalProps) {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const copyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-info-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-zinc-300" />
            <h2 id="file-info-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              File Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file details"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* File Name & ID */}
          <div className="space-y-1.5 bg-[#161616] p-3.5 border border-[#262626] rounded-xl">
            <div className="text-[11px] text-zinc-500 font-medium">Filename</div>
            <div className="text-zinc-100 font-medium break-all text-sm">{file.name}</div>
            <div className="text-[10px] text-zinc-500 font-mono break-all pt-0.5">ID: {file.id}</div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#161616] p-3 border border-[#262626] rounded-xl space-y-1">
              <div className="text-[11px] text-zinc-500 font-medium">Size</div>
              <div className="text-zinc-100 font-medium tabular-nums">{formatBytes(file.size)}</div>
            </div>
            <div className="bg-[#161616] p-3 border border-[#262626] rounded-xl space-y-1">
              <div className="text-[11px] text-zinc-500 font-medium">Type</div>
              <div className="text-zinc-100 font-medium truncate">{file.mimeType}</div>
            </div>
            <div className="bg-[#161616] p-3 border border-[#262626] rounded-xl space-y-1">
              <div className="text-[11px] text-zinc-500 font-medium">Chunks</div>
              <div className="text-zinc-100 font-medium tabular-nums">{file.chunks.length} {file.chunks.length === 1 ? 'part' : 'parts'}</div>
            </div>
            <div className="bg-[#161616] p-3 border border-[#262626] rounded-xl space-y-1">
              <div className="text-[11px] text-zinc-500 font-medium">Uploaded</div>
              <div className="text-zinc-100 font-medium">{new Date(file.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Chunk Map */}
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-400 font-medium">
              Encrypted Vault Parts ({file.chunks.length})
            </div>
            <div className="border border-[#262626] rounded-xl divide-y divide-[#262626] max-h-48 overflow-y-auto bg-[#161616]">
              {file.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-2.5 flex items-center justify-between text-xs hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-zinc-500 tabular-nums">Part {chunk.index + 1}</span>
                    <span className="text-zinc-300 font-mono text-[11px] truncate max-w-[180px]">
                      {chunk.hash.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="tabular-nums">{formatBytes(chunk.size)}</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
