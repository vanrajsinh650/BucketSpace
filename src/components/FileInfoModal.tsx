'use client';

import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, Database, HardDrive } from 'lucide-react';
import { FileMetadata } from '@/shared';

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

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl font-mono">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              File Inspector
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* File Name & ID */}
          <div className="space-y-1 bg-[#121212] p-3 border border-[#1e1e1e] rounded">
            <div className="text-[10px] text-[#666] uppercase">File Name</div>
            <div className="text-white font-medium break-all">{file.name}</div>
            <div className="text-[10px] text-[#555] break-all pt-1">ID: {file.id}</div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#121212] p-2.5 border border-[#1e1e1e] rounded">
              <div className="text-[10px] text-[#666] uppercase">Size</div>
              <div className="text-white font-medium tabular-nums">{formatSize(file.size)} ({file.size} bytes)</div>
            </div>
            <div className="bg-[#121212] p-2.5 border border-[#1e1e1e] rounded">
              <div className="text-[10px] text-[#666] uppercase">MIME Type</div>
              <div className="text-white font-medium truncate">{file.mimeType}</div>
            </div>
            <div className="bg-[#121212] p-2.5 border border-[#1e1e1e] rounded">
              <div className="text-[10px] text-[#666] uppercase">Total Chunks</div>
              <div className="text-white font-medium tabular-nums">{file.chunks.length} chunks</div>
            </div>
            <div className="bg-[#121212] p-2.5 border border-[#1e1e1e] rounded">
              <div className="text-[10px] text-[#666] uppercase">Created</div>
              <div className="text-white font-medium">{new Date(file.createdAt).toLocaleString()}</div>
            </div>
          </div>

          {/* Chunk Map */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-[#666] uppercase tracking-wider">
              Cryptographic Chunks ({file.chunks.length})
            </div>
            <div className="border border-[#1e1e1e] rounded divide-y divide-[#1e1e1e] max-h-48 overflow-y-auto bg-[#121212]">
              {file.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-2 flex items-center justify-between text-[11px] hover:bg-[#181818] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#555] tabular-nums">#{chunk.index}</span>
                    <span className="text-white font-mono truncate max-w-[200px]">
                      {chunk.hash.slice(0, 16)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#666]">
                    <span className="tabular-nums">{formatSize(chunk.size)}</span>
                    <span className="text-[#22c55e]">Verified</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-end">
          <button
            onClick={onClose}
            className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-1.5 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
