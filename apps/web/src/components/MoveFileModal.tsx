'use client';

import React, { useState } from 'react';
import { X, ArrowRightLeft, HardDrive, Send, Cloud, Database, Cpu, ShieldCheck } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface MoveFileModalProps {
  file: FileMetadata | null;
  availableProviders: { providerId: string; current: boolean }[];
  onMove: (fileId: string, targetProviderId: string) => void;
  onClose: () => void;
}

export function MoveFileModal({
  file,
  availableProviders,
  onMove,
  onClose,
}: MoveFileModalProps) {
  const targetOptions = availableProviders.filter((p) => !p.current);
  const currentProvider = availableProviders.find((p) => p.current)?.providerId || 'Unknown';
  const [selectedTarget, setSelectedTarget] = useState<string>(
    targetOptions[0]?.providerId || ''
  );
  const [isMoving, setIsMoving] = useState(false);

  if (!file) return null;

  const getProviderIcon = (id: string) => {
    if (id.includes('telegram')) return Send;
    if (id.includes('local') || id.includes('disk')) return HardDrive;
    if (id.includes('s3') || id.includes('r2')) return Cloud;
    if (id.includes('supabase')) return Database;
    return Cpu;
  };

  const handleExecuteMove = () => {
    if (!selectedTarget) return;
    setIsMoving(true);
    setTimeout(() => {
      onMove(file.id, selectedTarget);
      setIsMoving(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md flex flex-col overflow-hidden shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">
              Migrate Storage Provider
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
        <div className="p-4 space-y-4">
          <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1">
            <div className="text-[10px] text-[#666] uppercase">Target File</div>
            <div className="text-white font-medium truncate">{file.name}</div>
            <div className="text-[10px] text-[#555]">
              Current Location: <span className="text-white uppercase">{currentProvider}</span>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#666] uppercase block">
              Destination Provider
            </label>
            <div className="space-y-1.5">
              {targetOptions.map((provider) => {
                const Icon = getProviderIcon(provider.providerId);
                const isSelected = selectedTarget === provider.providerId;
                return (
                  <button
                    key={provider.providerId}
                    type="button"
                    onClick={() => setSelectedTarget(provider.providerId)}
                    className={`w-full flex items-center justify-between p-2.5 rounded border transition-colors btn-press ${
                      isSelected
                        ? 'border-white bg-[#1a1a1a] text-white font-bold'
                        : 'border-[#1e1e1e] bg-[#121212] text-[#888] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="uppercase">{provider.providerId}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded font-bold">
                        TARGET
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] text-[#555] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22c55e]" />
            <span>Chunks will be verified with SHA-256 before removing source.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="border border-[#333] hover:border-white text-white px-3.5 py-1.5 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteMove}
            disabled={!selectedTarget || isMoving}
            className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-1.5 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
          >
            {isMoving ? 'Migrating...' : 'Move Chunks'}
          </button>
        </div>
      </div>
    </div>
  );
}
