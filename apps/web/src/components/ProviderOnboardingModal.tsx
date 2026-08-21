'use client';

import React, { useState } from 'react';
import { X, Send, HardDrive, Cloud, ArrowRight, ShieldCheck, Check } from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';

export interface ProviderOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
}

export function ProviderOnboardingModal({
  isOpen,
  onClose,
  onConnectProvider,
}: ProviderOnboardingModalProps) {
  const [providerType, setProviderType] = useState<'telegram' | 'local' | 'cloud'>('telegram');
  const [telegramStep, setTelegramStep] = useState<'phone' | 'code' | '2fa'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [localPath, setLocalPath] = useState('C:\\BucketSpace\\Storage');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTelegramPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setTelegramStep('code');
  };

  const handleTelegramCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setIsSubmitting(true);
    await onConnectProvider('telegram', { phone, code });
    setIsSubmitting(false);
    onClose();
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onConnectProvider('local-disk', { path: localPath });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <span className="font-bold uppercase tracking-wider text-white">
            Connect Storage Provider
          </span>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 border-b border-[#1e1e1e] bg-[#0a0a0a]">
          <button
            onClick={() => setProviderType('telegram')}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'telegram'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => setProviderType('local')}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'local'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            Local Disk
          </button>
          <button
            onClick={() => setProviderType('cloud')}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'cloud'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            S3 / R2
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-4">
          {providerType === 'telegram' ? (
            telegramStep === 'phone' ? (
              <form onSubmit={handleTelegramPhone} className="space-y-4">
                <p className="text-white text-xs leading-relaxed">
                  Store unlimited zero-knowledge encrypted chunks inside your private Telegram cloud channel.
                </p>
                <PhoneInputWithCountry value={phone} onChange={setPhone} label="Phone Number" />
                <button
                  type="submit"
                  disabled={!phone}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>Send Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleTelegramCode} className="space-y-4">
                <p className="text-white text-xs leading-relaxed">
                  Enter the 5-digit verification code sent to your Telegram app.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#666] uppercase block">Telegram Code</label>
                  <input
                    type="text"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[#444]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!code || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
                >
                  {isSubmitting ? 'Authenticating...' : 'Verify & Connect'}
                </button>
              </form>
            )
          ) : providerType === 'local' ? (
            <form onSubmit={handleLocalSubmit} className="space-y-4">
              <p className="text-white text-xs leading-relaxed">
                Persist encrypted chunks directly to your local file system.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-[#666] uppercase block">Storage Directory</label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-[#444]"
                />
              </div>
              <button
                type="submit"
                disabled={!localPath || isSubmitting}
                className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
              >
                {isSubmitting ? 'Connecting...' : 'Connect Folder'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-white text-xs leading-relaxed">
                Connect Cloudflare R2, AWS S3, or Supabase Storage with standard S3 API keys.
              </p>
              <button
                onClick={async () => {
                  setIsSubmitting(true);
                  await onConnectProvider('s3-r2', { bucket: 'bucketspace-vault' });
                  setIsSubmitting(false);
                  onClose();
                }}
                className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Connect S3 / R2 Cluster
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
