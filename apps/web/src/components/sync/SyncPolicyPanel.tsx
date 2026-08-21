'use client';

import React from 'react';
import { RefreshCw, X, Layers } from 'lucide-react';

export interface SyncPolicyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SyncPolicyPanel: React.FC<SyncPolicyPanelProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">Cross-Cloud Sync</span>
          </div>
          <button onClick={onClose} className="p-1 text-[#666] hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-[#888]">
          <p>
            Continuous bi-directional delta synchronization between Telegram MTProto and S3-compatible clusters.
          </p>
          <div className="p-3 bg-[#121212] border border-[#1e1e1e] rounded text-white text-[11px]">
            Sync status: Idle (All chunk hashes aligned)
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white text-black font-bold px-4 py-1.5 rounded uppercase text-xs btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
