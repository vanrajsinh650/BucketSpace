'use client';

import React from 'react';
import { ShieldCheck, Download, X, Lock } from 'lucide-react';

export interface GovernanceAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export const GovernanceAuditModal: React.FC<GovernanceAuditModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">Governance & Audit Log</span>
          </div>
          <button onClick={onClose} className="p-1 text-[#666] hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-[#888] leading-relaxed">
          <p>
            All file writes, migrations, and deletes generate tamper-evident SHA-256 event receipts recorded in SQLite metadata.
          </p>
          <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded text-white space-y-1">
            <div className="text-[10px] text-[#666] uppercase">Active Workspace</div>
            <div className="text-xs">{workspaceId || 'Default Vault'}</div>
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
