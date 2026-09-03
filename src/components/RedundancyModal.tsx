'use client';

import React, { useState } from 'react';
import { X, Layers, ShieldCheck, RefreshCw, Wrench } from 'lucide-react';

interface RedundancyLocation {
  id: string;
  chunkIndex: number;
  providerId: string;
  role: 'PRIMARY' | 'REPLICA';
  state: 'VERIFIED' | 'STALE' | 'OFFLINE';
  verifiedAt: string;
}

interface RedundancyInfo {
  fileId: string;
  fileName: string;
  totalChunks: number;
  locations: RedundancyLocation[];
}

interface RedundancyModalProps {
  info: RedundancyInfo;
  availableProviders: string[];
  onReplicate: (fileId: string, targetProviderId: string) => void;
  onVerify: (fileId: string) => void;
  onRepair: (fileId: string) => void;
  onClose: () => void;
}

export function RedundancyModal({
  info,
  availableProviders,
  onReplicate,
  onVerify,
  onRepair,
  onClose,
}: RedundancyModalProps) {
  const [selectedTarget, setSelectedTarget] = useState(availableProviders[0] || '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="redundancy-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-zinc-300" />
            <h2 id="redundancy-modal-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              Backup & Replicas
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* File Info Box */}
          <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1">
            <div className="text-[10px] text-[#666] uppercase">File</div>
            <div className="text-white font-medium truncate">{info.fileName}</div>
            <div className="text-[10px] text-[#888] tabular-nums">
              Total Chunks: {info.totalChunks} | Active Replica Locations: {info.locations.length}
            </div>
          </div>

          {/* Chunk Replica Grid */}
          <div className="space-y-1.5">
            <div className="text-[10px] text-[#666] uppercase tracking-wider">
              Chunk Locations & Health
            </div>
            <div className="border border-[#1e1e1e] rounded divide-y divide-[#1e1e1e] bg-[#121212] max-h-52 overflow-y-auto">
              {info.locations.map((loc) => (
                <div key={loc.id} className="p-2.5 flex items-center justify-between hover:bg-[#181818]">
                  <div className="flex items-center gap-2">
                    <span className="text-[#555] tabular-nums">Chunk #{loc.chunkIndex}</span>
                    <span className="text-white uppercase font-medium">{loc.providerId}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-[#888]">{loc.role}</span>
                    <span className="text-[#22c55e] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e1e1e]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onVerify(info.fileId)}
                className="border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60 text-zinc-200 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs font-medium min-h-[40px]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Verify Integrity</span>
              </button>
              <button
                type="button"
                onClick={() => onRepair(info.fileId)}
                className="border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60 text-zinc-200 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs font-medium min-h-[40px]"
              >
                <Wrench className="w-3.5 h-3.5 text-zinc-400" />
                <span>Self-Heal</span>
              </button>
            </div>

            {availableProviders.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-zinc-500 min-h-[40px]"
                  aria-label="Replication target provider"
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onReplicate(info.fileId, selectedTarget)}
                  className="bg-zinc-100 hover:bg-white text-zinc-950 font-medium px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors min-h-[40px]"
                >
                  <span>Replicate</span>
                </button>
              </div>
            )}
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
