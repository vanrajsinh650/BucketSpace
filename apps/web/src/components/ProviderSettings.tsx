'use client';

import React from 'react';
import {
  Cloud,
  Cpu,
  Database,
  HardDrive,
  Send,
  Activity,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

/* ─── Types ─── */

export interface ProviderDisplayInfo {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unreachable' | 'unknown';
  latencyMs?: number;
}

interface ProviderSettingsProps {
  providers: ProviderDisplayInfo[];
  onTestConnection: (providerId: string) => void;
  onRemoveProvider: (providerId: string) => void;
  onClose: () => void;
}

/* ─── Helpers ─── */

const providerIcon = (id: string) => {
  if (id.includes('telegram')) return <Send className="w-5 h-5" />;
  if (id.includes('s3') || id.includes('r2')) return <Cloud className="w-5 h-5" />;
  if (id.includes('supabase')) return <Database className="w-5 h-5" />;
  if (id.includes('memory')) return <Cpu className="w-5 h-5" />;
  return <HardDrive className="w-5 h-5" />;
};

const statusDot = (status: ProviderDisplayInfo['status']) => {
  const colors: Record<string, string> = {
    healthy: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    unreachable: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`w-2.5 h-2.5 rounded-full ${colors[status]} inline-block`} />;
};

const statusLabel = (status: ProviderDisplayInfo['status']) => {
  const labels: Record<string, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unreachable: 'Unreachable',
    unknown: 'Unknown',
  };
  return labels[status];
};

/* ─── Component ─── */

export function ProviderSettings({
  providers,
  onTestConnection,
  onRemoveProvider,
  onClose,
}: ProviderSettingsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6 border border-slate-700/80"
        style={{ backgroundColor: '#0d1117' }}>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Storage Providers</h3>
              <p className="text-xs text-slate-400">Your storage. One interface. Any provider.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {providers.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No providers registered. Add a provider to start storing files.
            </div>
          )}

          {providers.map((p) => (
            <div
              key={p.providerId}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-slate-800/80 text-slate-300">
                  {providerIcon(p.providerId)}
                </div>
                <div>
                  <h4 className="font-medium text-sm text-white">{p.providerId}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {statusDot(p.status)}
                    <span className="text-xs text-slate-400">{statusLabel(p.status)}</span>
                    {p.latencyMs !== undefined && (
                      <span className="text-xs font-mono text-slate-500">{p.latencyMs}ms</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onTestConnection(p.providerId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Test
                </button>
                <button
                  onClick={() => onRemoveProvider(p.providerId)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove provider"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
