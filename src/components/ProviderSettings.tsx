'use client';

import React from 'react';
import { X, HardDrive, Send, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

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
    return HardDrive;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-settings-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <h2 id="provider-settings-title" className="text-sm font-semibold tracking-wide text-zinc-100">
            Storage Accounts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Connected Accounts</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenOnboarding();
              }}
              className="bg-white text-zinc-950 hover:bg-zinc-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Account</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {providers.map((p) => {
              const Icon = getProviderIcon(p.providerId);
              const isHealthy = p.status === 'healthy';
              return (
                <div
                  key={p.providerId}
                  className="bg-[#161616] border border-[#262626] p-3.5 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-zinc-800/60 flex items-center justify-center text-zinc-300 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-zinc-100 font-medium capitalize text-xs">{p.providerId}</div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        {isHealthy ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                        )}
                        <span className={isHealthy ? 'text-emerald-400' : 'text-zinc-400'}>
                          {isHealthy ? 'Connected & Healthy' : p.status}
                        </span>
                        {p.latencyMs !== undefined && (
                          <span className="text-zinc-500 tabular-nums">({p.latencyMs}ms)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTestConnection(p.providerId)}
                      className="border border-[#333] hover:border-zinc-500 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveProvider(p.providerId)}
                      className="text-zinc-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-950/20 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Disconnect Account"
                      aria-label={`Disconnect ${p.providerId}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors min-h-[40px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
