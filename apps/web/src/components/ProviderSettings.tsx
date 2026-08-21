'use client';

import React from 'react';
import { X, HardDrive, Send, Cloud, Database, Cpu, Plus, Activity, Trash2 } from 'lucide-react';

export interface ProviderDisplayInfo {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unreachable' | 'unknown';
  latencyMs?: number;
}

interface ProviderSettingsProps {
  providers: ProviderDisplayInfo[];
  onTestConnection: (providerId: string) => void;
  onRemoveProvider: (providerId: string) => void;
  onOpenOnboarding: () => void;
  onClose: () => void;
}

export function ProviderSettings({
  providers,
  onTestConnection,
  onRemoveProvider,
  onOpenOnboarding,
  onClose,
}: ProviderSettingsProps) {
  const getProviderIcon = (id: string) => {
    if (id.includes('telegram')) return Send;
    if (id.includes('local') || id.includes('disk')) return HardDrive;
    if (id.includes('s3') || id.includes('r2')) return Cloud;
    if (id.includes('supabase')) return Database;
    return Cpu;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <span className="font-bold uppercase tracking-wider text-white">
            Storage Providers
          </span>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666] uppercase">Connected Clusters</span>
            <button
              onClick={() => {
                onClose();
                onOpenOnboarding();
              }}
              className="bg-white text-black hover:bg-[#e0e0e0] px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors btn-press"
            >
              <Plus className="w-3 h-3" />
              <span>Add Provider</span>
            </button>
          </div>

          <div className="space-y-2">
            {providers.map((p) => {
              const Icon = getProviderIcon(p.providerId);
              return (
                <div
                  key={p.providerId}
                  className="bg-[#121212] border border-[#1e1e1e] p-3 rounded flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-white" />
                    <div>
                      <div className="text-white font-medium uppercase">{p.providerId}</div>
                      <div className="text-[10px] text-[#666]">
                        Status: <span className="text-[#22c55e]">{p.status}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTestConnection(p.providerId)}
                      className="border border-[#333] hover:border-white text-white px-2.5 py-1 rounded text-[10px] uppercase transition-colors btn-press"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => onRemoveProvider(p.providerId)}
                      className="text-[#ff3333] p-1 rounded hover:bg-[#ff3333]/10 transition-colors btn-press"
                      title="Remove Provider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-end">
          <button
            onClick={onClose}
            className="border border-[#333] hover:border-white text-white px-4 py-1.5 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
