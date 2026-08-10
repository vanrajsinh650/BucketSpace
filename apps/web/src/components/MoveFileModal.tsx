'use client';

import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface MoveFileModalProps {
  file: FileMetadata | null;
  availableProviders: { providerId: string; current: boolean }[];
  onMove: (fileId: string, targetProviderId: string) => void;
  onClose: () => void;
}

const providerIcon = (id: string) => {
  if (id.includes('telegram')) return <Send className="w-4 h-4" />;
  if (id.includes('s3') || id.includes('r2')) return <Cloud className="w-4 h-4" />;
  if (id.includes('supabase')) return <Database className="w-4 h-4" />;
  if (id.includes('memory')) return <Cpu className="w-4 h-4" />;
  return <HardDrive className="w-4 h-4" />;
};

export function MoveFileModal({ file, availableProviders, onMove, onClose }: MoveFileModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  if (!file) return null;

  const currentProvider = availableProviders.find((p) => p.current);
  const targetProviders = availableProviders.filter((p) => !p.current);

  const handleMove = () => {
    if (selectedTarget) {
      onMove(file.id, selectedTarget);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-700/80"
        style={{ backgroundColor: '#0d1117' }}>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Move File</h3>
              <p className="text-xs text-slate-400">Transfer chunks to a different provider</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Info */}
        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1.5">File</label>
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-sm font-semibold text-white truncate">
            {file.name}
          </div>
        </div>

        {/* Current Provider */}
        {currentProvider && (
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Current Provider</label>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-sm text-slate-300 flex items-center gap-2">
              {providerIcon(currentProvider.providerId)}
              <span>{currentProvider.providerId}</span>
            </div>
          </div>
        )}

        {/* Target Selection */}
        <div>
          <label className="text-xs text-slate-400 font-medium block mb-2">Move To</label>
          <div className="space-y-2">
            {targetProviders.map((p) => (
              <button
                key={p.providerId}
                onClick={() => setSelectedTarget(p.providerId)}
                className={`w-full p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 text-sm ${
                  selectedTarget === p.providerId
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${
                  selectedTarget === p.providerId ? 'bg-cyan-500/20' : 'bg-slate-800/80'
                }`}>
                  {providerIcon(p.providerId)}
                </div>
                <span className="font-medium">{p.providerId}</span>
                {selectedTarget === p.providerId && (
                  <span className="ml-auto text-xs font-mono text-cyan-400">Selected</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Verification Note */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All chunks verified with SHA-256 before removing originals.</span>
        </div>

        {/* Move Button */}
        <button
          onClick={handleMove}
          disabled={!selectedTarget}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            selectedTarget
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/20'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {selectedTarget ? `Move to ${selectedTarget}` : 'Select a target provider'}
        </button>
      </div>
    </div>
  );
}
