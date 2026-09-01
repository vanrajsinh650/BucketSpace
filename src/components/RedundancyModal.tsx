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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">
              Multi-Cloud Redundancy & Replicas
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
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1e1e1e]">
            <button
              onClick={() => onVerify(info.fileId)}
              className="border border-[#333] hover:border-white text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors btn-press text-[11px] uppercase tracking-wider"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Verify Integrity</span>
            </button>
            <button
              onClick={() => onRepair(info.fileId)}
              className="border border-[#333] hover:border-white text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors btn-press text-[11px] uppercase tracking-wider"
            >
              <Wrench className="w-3 h-3" />
              <span>Self-Heal</span>
            </button>
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
