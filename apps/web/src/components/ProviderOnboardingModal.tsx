'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Info,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { StorageProviderCapabilities } from '@bucketspace/shared';

export interface ProviderOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
}

type ProviderType = 'telegram' | 'r2' | 's3' | 'supabase' | 'local';

interface ProviderMeta {
  id: ProviderType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  capabilities: Partial<StorageProviderCapabilities>;
  recommendedBadge?: string;
}

const PROVIDER_METAS: ProviderMeta[] = [
  {
    id: 'telegram',
    title: 'Telegram Storage (MTProto)',
    subtitle: 'User account cloud storage via Grammers MTProto architecture',
    icon: Send,
    recommendedBadge: 'Zero Cost Cloud',
    capabilities: {
      maxObjectSizeBytes: 2_000_000_000, // 2 GB
      optimalChunkSizeBytes: 512 * 1024, // 512 KB
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
    },
  },
  {
    id: 'local',
    title: 'Local Storage Disk',
    subtitle: 'High-speed local NVMe / SSD / HDD storage volume',
    icon: HardDrive,
    recommendedBadge: 'Maximum Speed',
    capabilities: {
      maxObjectSizeBytes: null, // Unlimited
      optimalChunkSizeBytes: 5 * 1024 * 1024, // 5 MB
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
    },
  },
  {
    id: 'r2',
    title: 'Cloudflare R2 Storage',
    subtitle: 'S3-compatible zero-egress fee globally distributed object store',
    icon: Cloud,
    capabilities: {
      maxObjectSizeBytes: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB
      optimalChunkSizeBytes: 5 * 1024 * 1024,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
    },
  },
  {
    id: 's3',
    title: 'AWS S3 / S3-Compatible',
    subtitle: 'Enterprise-grade durable cloud object storage',
    icon: Database,
    capabilities: {
      maxObjectSizeBytes: 5 * 1024 * 1024 * 1024 * 1024, // 5 TB
      optimalChunkSizeBytes: 5 * 1024 * 1024,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
    },
  },
  {
    id: 'supabase',
    title: 'Supabase Storage',
    subtitle: 'PostgreSQL-backed resilient object storage buckets',
    icon: Cpu,
    capabilities: {
      maxObjectSizeBytes: 50 * 1024 * 1024 * 1024, // 50 GB
      optimalChunkSizeBytes: 5 * 1024 * 1024,
      supportsByteRangeRead: true,
      supportsParallelUploads: true,
      supportsResumableUpload: true,
      supportsDirectMediaPlayback: true,
    },
  },
];

export function ProviderOnboardingModal({
  isOpen,
  onClose,
  onConnectProvider,
}: ProviderOnboardingModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('telegram');
  const [authMode, setAuthMode] = useState<'mtproto' | 'bot_api'>('mtproto');

  // Form states
  const [telegramPhone, setTelegramPhone] = useState('');
  const [telegramApiId, setTelegramApiId] = useState('');
  const [telegramApiHash, setTelegramApiHash] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('-100');

  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Region, setS3Region] = useState('auto');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseBucket, setSupabaseBucket] = useState('');

  const [localDir, setLocalDir] = useState('C:\\BucketSpace\\Storage');

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentMeta = PROVIDER_METAS.find((p) => p.id === selectedProvider)!;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setConnectionResult(null);

    let config: Record<string, unknown> = {};

    if (selectedProvider === 'telegram') {
      config =
        authMode === 'mtproto'
          ? {
              mode: 'mtproto',
              apiId: parseInt(telegramApiId || '0', 10),
              apiHash: telegramApiHash,
              phone: telegramPhone,
              defaultChatId: telegramChatId,
            }
          : {
              mode: 'bot_api',
              botToken: telegramBotToken,
              defaultChatId: telegramChatId,
            };
    } else if (selectedProvider === 'r2' || selectedProvider === 's3') {
      config = {
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3Bucket,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      };
    } else if (selectedProvider === 'supabase') {
      config = {
        supabaseUrl,
        supabaseKey,
        bucketName: supabaseBucket,
      };
    } else if (selectedProvider === 'local') {
      config = {
        rootDir: localDir,
      };
    }

    try {
      const res = await onConnectProvider(selectedProvider, config);
      setConnectionResult(res);
      if (res.success) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      setConnectionResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const formatSize = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined) return 'Unlimited';
    if (bytes >= 1024 * 1024 * 1024 * 1024) return `${bytes / (1024 * 1024 * 1024 * 1024)} TB`;
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl rounded-3xl p-6 shadow-2xl bg-[#0d1117] border border-slate-700/80 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold text-white tracking-tight">Connect Storage Provider</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                v1.0 RC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Your files. Your storage. Connect any provider without global size caps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4 flex-1 overflow-y-auto min-h-0">
          {/* Provider Selector (Left Column) */}
          <div className="md:col-span-5 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block px-1">
              Available Backends
            </label>
            {PROVIDER_METAS.map((meta) => {
              const Icon = meta.icon;
              const isSelected = selectedProvider === meta.id;
              return (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(meta.id);
                    setConnectionResult(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-lg shadow-cyan-500/5'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl ${
                      isSelected ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white truncate">{meta.title}</span>
                      {meta.recommendedBadge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {meta.recommendedBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{meta.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Configuration Form & Capability Card (Right Column) */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            {/* Capability Badges */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Provider Capability Profile
                </span>
                <span className="text-xs text-cyan-400 font-mono">
                  Chunk: {formatSize(currentMeta.capabilities.optimalChunkSizeBytes)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-500 block text-[11px]">Single Object Cap</span>
                  <span className="font-semibold text-white">
                    {formatSize(currentMeta.capabilities.maxObjectSizeBytes)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-500 block text-[11px]">Byte Range Seek</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-500 block text-[11px]">Parallel Streams</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
                  <span className="text-slate-500 block text-[11px]">Multi-Part Logical</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                  </span>
                </div>
              </div>
            </div>

            {/* Provider Form Fields */}
            <form id="provider-connect-form" onSubmit={handleConnect} className="space-y-3.5">
              {selectedProvider === 'telegram' && (
                <>
                  <div className="flex gap-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setAuthMode('mtproto')}
                      className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
                        authMode === 'mtproto'
                          ? 'bg-cyan-500 text-black shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      MTProto User Account (2 GB)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('bot_api')}
                      className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
                        authMode === 'bot_api'
                          ? 'bg-cyan-500 text-black shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bot Token API (50 MB)
                    </button>
                  </div>

                  {authMode === 'mtproto' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">API ID (my.telegram.org)</label>
                          <input
                            type="text"
                            placeholder="12345678"
                            value={telegramApiId}
                            onChange={(e) => setTelegramApiId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">API Hash</label>
                          <input
                            type="password"
                            placeholder="32-char hex string"
                            value={telegramApiHash}
                            onChange={(e) => setTelegramApiHash(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Phone Number (+CountryCode)</label>
                        <input
                          type="text"
                          placeholder="+1234567890"
                          value={telegramPhone}
                          onChange={(e) => setTelegramPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Telegram Bot Token (@BotFather)</label>
                      <input
                        type="password"
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Storage Channel ID or 'me'</label>
                    <input
                      type="text"
                      placeholder="-100123456789 or 'me'"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </>
              )}

              {(selectedProvider === 'r2' || selectedProvider === 's3') && (
                <>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Endpoint URL</label>
                    <input
                      type="text"
                      placeholder={
                        selectedProvider === 'r2'
                          ? 'https://<account_id>.r2.cloudflarestorage.com'
                          : 'https://s3.amazonaws.com'
                      }
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Bucket Name</label>
                      <input
                        type="text"
                        placeholder="my-bucket"
                        value={s3Bucket}
                        onChange={(e) => setS3Bucket(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Region</label>
                      <input
                        type="text"
                        placeholder="auto or us-east-1"
                        value={s3Region}
                        onChange={(e) => setS3Region(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Access Key ID</label>
                      <input
                        type="text"
                        placeholder="AKIA..."
                        value={s3AccessKey}
                        onChange={(e) => setS3AccessKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Secret Access Key</label>
                      <input
                        type="password"
                        placeholder="Secret key"
                        value={s3SecretKey}
                        onChange={(e) => setS3SecretKey(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedProvider === 'supabase' && (
                <>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Supabase Project URL</label>
                    <input
                      type="text"
                      placeholder="https://xyzcompany.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Service Role Key</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOi..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Storage Bucket Name</label>
                    <input
                      type="text"
                      placeholder="bucketspace-storage"
                      value={supabaseBucket}
                      onChange={(e) => setSupabaseBucket(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              {selectedProvider === 'local' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Host Directory Path</label>
                  <input
                    type="text"
                    placeholder="C:\BucketSpace\Storage or /var/bucketspace"
                    value={localDir}
                    onChange={(e) => setLocalDir(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Path will be sandboxed to prevent path traversal attacks.
                  </p>
                </div>
              )}
            </form>

            {/* Status Feedback */}
            {connectionResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  connectionResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {connectionResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>
                  {connectionResult.message ??
                    (connectionResult.success
                      ? 'Provider connected and verified successfully!'
                      : 'Connection error')}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="provider-connect-form"
                disabled={isConnecting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Provider...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Test & Connect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
