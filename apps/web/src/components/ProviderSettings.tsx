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

export interface ProviderSettingsProps {
  providers: ProviderDisplayInfo[];
  onTestConnection: (providerId: string) => void;
  onRemoveProvider: (providerId: string) => void;
  onOpenOnboarding?: () => void;
  onClose: () => void;
}

/* ─── Helpers ─── */

const providerIcon = (id: string) => {
  if (id.includes('telegram')) return <Send className="w-4 h-4" />;
  if (id.includes('s3') || id.includes('r2')) return <Cloud className="w-4 h-4" />;
  if (id.includes('supabase')) return <Database className="w-4 h-4" />;
  if (id.includes('memory') || id.includes('demo')) return <Cpu className="w-4 h-4" />;
  return <HardDrive className="w-4 h-4" />;
};

const statusDot = (status: ProviderDisplayInfo['status']) => {
  const colors: Record<string, string> = {
    healthy: 'bg-white',
    degraded: 'bg-zinc-400',
    unreachable: 'bg-zinc-600',
    unknown: 'bg-zinc-800',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status]} inline-block`} />;
};

const statusLabel = (status: ProviderDisplayInfo['status']) => {
  const labels: Record<string, string> = {
    healthy: 'Connected',
    degraded: 'Needs attention',
    unreachable: 'Offline',
    unknown: 'Status unknown',
  };
  return labels[status];
};

const getDisplayName = (id: string) => {
  if (id.includes('demo') || id.includes('memory')) return 'Sandbox (This device)';
  if (id.includes('supabase')) return 'Supabase Cloud';
  if (id.includes('s3')) return 'Amazon S3';
  if (id.includes('r2')) return 'Cloudflare R2';
  if (id.includes('telegram')) return 'Telegram Storage';
  if (id.includes('local')) return 'Local Disk';
  return id;
};

/* ─── Component ─── */

export function ProviderSettings({
  providers,
  onTestConnection,
  onRemoveProvider,
  onOpenOnboarding,
  onClose,
}: ProviderSettingsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-black border border-[#333] p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold font-mono">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono">Connected Storage</h3>
              <p className="text-[11px] text-[#888] font-mono">Manage connected storage backends & credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider List */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {providers.length === 0 && (
            <div className="text-center py-12 text-[#666] text-xs font-mono">
              No providers registered. Connect a provider to begin storing files.
            </div>
          )}

          {providers.map((p) => (
            <div
              key={p.providerId}
              className="p-4 bg-[#0a0a0a] border border-[#222] flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 border border-[#333] bg-black text-white">
                  {providerIcon(p.providerId)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs font-mono text-white uppercase tracking-wide">{getDisplayName(p.providerId)}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    {statusDot(p.status)}
                    <span className="text-[11px] font-mono text-[#888]">{statusLabel(p.status)}</span>
                  </div>
                  
                  <details className="mt-2 text-xs group cursor-pointer">
                    <summary className="text-[#666] hover:text-white inline-block select-none transition-colors font-mono text-[10px]">
                      Technical details
                    </summary>
                    <div className="mt-1.5 p-2 bg-black border border-[#222] space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#666]">Provider ID</span>
                        <span className="text-white">{p.providerId}</span>
                      </div>
                      {p.latencyMs !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-[#666]">Latency</span>
                          <span className="text-white">{p.latencyMs}ms</span>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onTestConnection(p.providerId)}
                  className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-white border border-[#444] hover:border-white transition-colors flex items-center gap-1.5"
                >
                  <Zap className="w-3 h-3" />
                  Test
                </button>
                <button
                  onClick={() => onRemoveProvider(p.providerId)}
                  className="p-1.5 text-[#666] hover:text-white transition-colors"
                  title="Remove provider"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Disaster Recovery & Snapshot Section */}
        <div className="p-4 bg-[#0a0a0a] border border-[#222] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-white">Disaster Recovery Snapshot</h4>
              <p className="text-[11px] font-mono text-[#888]">Export or restore complete drive metadata state.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                import('../lib/storage-store').then((m) => {
                  const snapshot = m.StorageStore.getInstance().exportBackupSnapshot();
                  const blob = new Blob([snapshot], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `bucketspace_backup_${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                });
              }}
              className="flex-1 py-2 px-3 bg-white text-black font-bold uppercase tracking-widest text-[11px] transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Export Snapshot</span>
            </button>
            <label className="flex-1 py-2 px-3 bg-black border border-[#333] hover:border-white text-white font-bold uppercase tracking-widest text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <span>Restore Backup</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      try {
                        const content = ev.target?.result as string;
                        const m = await import('../lib/storage-store');
                        const res = m.StorageStore.getInstance().restoreBackupSnapshot(content);
                        alert(`Restored successfully: ${res.filesCount} files recovered.`);
                        window.location.reload();
                      } catch (err: any) {
                        alert(err?.message || 'Failed to restore backup');
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Add / Connect Provider Button */}
        {onOpenOnboarding && (
          <div className="pt-2 border-t border-[#222]">
            <button
              onClick={() => {
                onClose();
                onOpenOnboarding();
              }}
              className="w-full py-3 bg-black border border-[#444] hover:border-white text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>+ Connect New Provider (Telegram, S3, R2, Supabase, Local)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
