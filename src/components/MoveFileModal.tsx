'use client';

import React, { useState } from 'react';
import { X, ArrowRightLeft, HardDrive, Send, ShieldCheck, AlertCircle } from 'lucide-react';
import { FileMetadata } from '@/shared';
import { humanizeError } from '../lib/humanize-error';

interface MoveFileModalProps {
  file: FileMetadata | null;
  availableProviders: { providerId: string; current: boolean }[];
  onMove: (fileId: string, targetProviderId: string) => Promise<void> | void;
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
  const [error, setError] = useState('');

  if (!file) return null;

  const getProviderIcon = (id: string) => {
    if (id.includes('telegram')) return Send;
    return HardDrive;
  };

  const handleExecuteMove = async () => {
    if (!selectedTarget) return;
    setIsMoving(true);
    setError('');
    try {
      await onMove(file.id, selectedTarget);
      setIsMoving(false);
      onClose();
    } catch (err: unknown) {
      setError(humanizeError(err));
      setIsMoving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="w-4 h-4 text-zinc-300" />
            <h2 id="move-modal-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              Relocate Storage
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-[#161616] p-3.5 border border-[#262626] rounded-xl space-y-1">
            <div className="text-[11px] text-zinc-500 font-medium">Selected file</div>
            <div className="text-zinc-100 font-medium truncate text-xs">{file.name}</div>
            <div className="text-xs text-zinc-400 pt-0.5">
              Current storage: <span className="text-zinc-200 capitalize font-medium">{currentProvider}</span>
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block font-medium">
              Destination storage provider
            </label>
            <div className="space-y-2">
              {targetOptions.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-500 bg-[#161616] rounded-xl border border-[#262626]">
                  No additional storage providers configured.
                </div>
              ) : (
                targetOptions.map((provider) => {
                  const Icon = getProviderIcon(provider.providerId);
                  const isSelected = selectedTarget === provider.providerId;
                  return (
                    <button
                      key={provider.providerId}
                      type="button"
                      onClick={() => setSelectedTarget(provider.providerId)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors min-h-[44px] ${
                        isSelected
                          ? 'border-zinc-500 bg-zinc-800/60 text-white font-medium'
                          : 'border-[#262626] bg-[#161616] text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span className="capitalize">{provider.providerId}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] bg-white text-zinc-950 px-2 py-0.5 rounded-md font-semibold">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="text-xs text-zinc-500 flex items-center gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500/80 shrink-0" />
            <span>Integrity is cryptographically verified before removing source chunks.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteMove}
            disabled={!selectedTarget || isMoving}
            className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isMoving ? 'Relocating...' : 'Move Storage'}
          </button>
        </div>
      </div>
    </div>
  );
}
