'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  RefreshCw,
  Wrench,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/* ─── Types ─── */

export interface ChunkLocationDisplay {
  id: string;
  chunkIndex: number;
  providerId: string;
  role: 'PRIMARY' | 'REPLICA';
  state: string;
  verifiedAt?: string;
  lastError?: string;
}

export interface FileRedundancyInfo {
  fileId: string;
  fileName: string;
  totalChunks: number;
  locations: ChunkLocationDisplay[];
}

interface RedundancyModalProps {
  info: FileRedundancyInfo;
  availableProviders: string[];
  onReplicate: (fileId: string, targetProviderId: string) => void;
  onVerify: (fileId: string) => void;
  onRepair: (fileId: string) => void;
  onClose: () => void;
}

/* ─── Status Helpers ─── */

function stateColor(state: string): string {
  switch (state) {
    case 'VERIFIED':   return 'text-emerald-400';
    case 'COPYING':
    case 'VERIFYING':
    case 'REPAIRING':  return 'text-amber-400';
    case 'PENDING':    return 'text-slate-400';
    case 'CORRUPTED':  return 'text-red-400';
    case 'MISSING':    return 'text-red-500';
    case 'FAILED':     return 'text-rose-400';
    case 'STALE':      return 'text-orange-400';
    default:           return 'text-slate-500';
  }
}

function stateIcon(state: string) {
  switch (state) {
    case 'VERIFIED':   return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'CORRUPTED':
    case 'MISSING':
    case 'FAILED':     return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'STALE':      return <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />;
    default:           return <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  }
}

function stateBgClass(state: string): string {
  switch (state) {
    case 'VERIFIED':   return 'bg-emerald-500/10 border-emerald-500/30';
    case 'CORRUPTED':
    case 'MISSING':
    case 'FAILED':     return 'bg-red-500/10 border-red-500/30';
    case 'COPYING':
    case 'VERIFYING':
    case 'REPAIRING':  return 'bg-amber-500/10 border-amber-500/30';
    default:           return 'bg-slate-800/60 border-slate-700/50';
  }
}

/* ─── Component ─── */

export function RedundancyModal({
  info,
  availableProviders,
  onReplicate,
  onVerify,
  onRepair,
  onClose,
}: RedundancyModalProps) {
  const [replicaTarget, setReplicaTarget] = useState(availableProviders[0] ?? '');
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  // Group locations by chunk index
  const locationsByChunk = new Map<number, ChunkLocationDisplay[]>();
  for (const loc of info.locations) {
    const existing = locationsByChunk.get(loc.chunkIndex) ?? [];
    existing.push(loc);
    locationsByChunk.set(loc.chunkIndex, existing);
  }

  // Stats
  const verifiedCount = info.locations.filter((l) => l.state === 'VERIFIED').length;
  const damagedCount = info.locations.filter((l) =>
    ['CORRUPTED', 'MISSING', 'FAILED'].includes(l.state)
  ).length;
  const inProgressCount = info.locations.filter((l) =>
    ['COPYING', 'VERIFYING', 'REPAIRING', 'PENDING'].includes(l.state)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-700/80 max-h-[85vh] flex flex-col"
        style={{ backgroundColor: '#0d1117' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Redundancy Health</h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">{info.fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <div className="text-2xl font-bold text-emerald-400">{verifiedCount}</div>
            <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-medium">Verified</div>
          </div>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <div className="text-2xl font-bold text-red-400">{damagedCount}</div>
            <div className="text-[10px] text-red-300 uppercase tracking-wider font-medium">Damaged</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <div className="text-2xl font-bold text-amber-400">{inProgressCount}</div>
            <div className="text-[10px] text-amber-300 uppercase tracking-wider font-medium">In Progress</div>
          </div>
        </div>

        {/* Chunk Location Grid */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {Array.from(locationsByChunk.entries())
            .sort(([a], [b]) => a - b)
            .map(([chunkIndex, locs]) => (
              <div key={chunkIndex} className="rounded-xl bg-slate-900/70 border border-slate-800">
                <button
                  onClick={() => setExpandedChunk(expandedChunk === chunkIndex ? null : chunkIndex)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <span className="text-xs font-mono text-slate-300">
                    Chunk {chunkIndex}
                  </span>
                  <div className="flex items-center gap-2">
                    {locs.map((l, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {stateIcon(l.state)}
                      </span>
                    ))}
                    {expandedChunk === chunkIndex ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {expandedChunk === chunkIndex && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {locs.map((loc) => (
                      <div
                        key={loc.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs ${stateBgClass(loc.state)}`}
                      >
                        <div className="flex items-center gap-2">
                          {stateIcon(loc.state)}
                          <span className="font-mono text-white">{loc.providerId}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            loc.role === 'PRIMARY'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {loc.role}
                          </span>
                        </div>
                        <span className={`font-semibold ${stateColor(loc.state)}`}>{loc.state}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          {/* Replicate to provider */}
          <div className="flex items-center gap-2">
            <select
              value={replicaTarget}
              onChange={(e) => setReplicaTarget(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
            >
              {availableProviders.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => onReplicate(info.fileId, replicaTarget)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Replicate
            </button>
          </div>

          {/* Verify & Repair */}
          <div className="flex gap-2">
            <button
              onClick={() => onVerify(info.fileId)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Verify All
            </button>
            <button
              onClick={() => onRepair(info.fileId)}
              className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" /> Repair Damaged
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
