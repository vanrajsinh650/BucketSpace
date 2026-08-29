'use client';

import React, { useState, useEffect } from 'react';
import { X, Send, HardDrive, Cloud, ArrowRight, ShieldCheck, Check, AlertCircle, Loader2, Key, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showApiCreds, setShowApiCreds] = useState(false);
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [localPath, setLocalPath] = useState('C:\\BucketSpace\\Storage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedApiId = localStorage.getItem('bucketspace_telegram_api_id') || '';
      const savedApiHash = localStorage.getItem('bucketspace_telegram_api_hash') || '';
      if (savedApiId) setApiId(savedApiId);
      if (savedApiHash) setApiHash(savedApiHash);
    }
  }, []);

  if (!isOpen) return null;

  /* ─── REAL Telegram MTProto Auth Handlers ─── */

  const API_BASE =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://localhost:4000';

  const handleTelegramPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (typeof window !== 'undefined') {
        if (apiId) localStorage.setItem('bucketspace_telegram_api_id', apiId);
        if (apiHash) localStorage.setItem('bucketspace_telegram_api_hash', apiHash);
      }

      const res = await fetch(`${API_BASE}/api/v1/telegram/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          apiId: apiId ? Number(apiId) : undefined,
          apiHash: apiHash || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send verification code from Telegram.');
      }

      setSessionToken(data.sessionToken);
      if (data.sessionToken?.startsWith('tgsess_dev_')) {
        setCode('12345');
      }
      setTelegramStep('code');
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting to API gateway.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTelegramCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !sessionToken) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, code }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      if (data.requires2FA) {
        setTelegramStep('2fa');
        return;
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTelegram2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password2FA || !sessionToken) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, password: password2FA }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid 2FA password.');
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || '2FA Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onConnectProvider('local', { rootDir: localPath });
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
            onClick={() => {
              setProviderType('telegram');
              setTelegramStep('phone');
              setErrorMessage('');
            }}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'telegram'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => {
              setProviderType('local');
              setErrorMessage('');
            }}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'local'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            Local Disk
          </button>
          <button
            onClick={() => {
              setProviderType('cloud');
              setErrorMessage('');
            }}
            className={`py-1.5 rounded transition-colors uppercase font-bold text-[11px] btn-press ${
              providerType === 'cloud'
                ? 'bg-white text-black'
                : 'text-[#888] hover:text-white'
            }`}
          >
            S3 / R2
          </button>
        </div>

        {/* Error Message Box */}
        {errorMessage && (
          <div className="m-4 p-3 bg-red-950/30 border border-red-800/50 rounded-lg text-xs space-y-2">
            <div className="flex items-start gap-2 text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-4 space-y-4">
          {providerType === 'telegram' ? (
            telegramStep === 'phone' ? (
              <form onSubmit={handleTelegramPhone} className="space-y-3.5">
                <p className="text-zinc-300 text-xs leading-relaxed">
                  Store unlimited zero-knowledge encrypted chunks inside your private Telegram account.
                </p>
                <PhoneInputWithCountry value={phone} onChange={setPhone} label="Phone Number" />

                {/* Optional / Expandable MTProto API Credentials */}
                <div className="border border-[#1e1e1e] bg-[#111] rounded-lg p-2.5 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setShowApiCreds((prev) => !prev)}
                    className="w-full flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Key className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Telegram API Credentials {apiId ? '(Set)' : '(Custom / Optional)'}</span>
                    </span>
                    {showApiCreds ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showApiCreds && (
                    <div className="pt-2 border-t border-[#222] space-y-2 text-[11px]">
                      <p className="text-zinc-400 text-[10px]">
                        Obtain your credentials for free from{' '}
                        <a
                          href="https://my.telegram.org"
                          target="_blank"
                          rel="noreferrer"
                          className="text-white underline hover:text-blue-400 inline-flex items-center gap-0.5"
                        >
                          my.telegram.org <ExternalLink className="w-2.5 h-2.5" />
                        </a>{' '}
                        under API development tools.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#666] uppercase block mb-1">API ID</label>
                          <input
                            type="text"
                            placeholder="e.g. 29481920"
                            value={apiId}
                            onChange={(e) => setApiId(e.target.value)}
                            className="w-full bg-[#181818] border border-[#2a2a2a] rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#666] uppercase block mb-1">API Hash</label>
                          <input
                            type="text"
                            placeholder="e.g. 9fa8b7c6..."
                            value={apiHash}
                            onChange={(e) => setApiHash(e.target.value)}
                            className="w-full bg-[#181818] border border-[#2a2a2a] rounded px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-zinc-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!phone || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Sending Real Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Telegram Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : telegramStep === 'code' ? (
              <form onSubmit={handleTelegramCode} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-white text-xs leading-relaxed">
                    Enter the 5-digit verification code sent to your Telegram app for <span className="font-bold text-white">{phone}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTelegramStep('phone')}
                    className="text-[10px] text-[#888] hover:text-white underline shrink-0 ml-2"
                  >
                    Change
                  </button>
                </div>
                {sessionToken.startsWith('tgsess_dev_') && (
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-emerald-300 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Ready! Quick verify code:</span>
                    </div>
                    <span className="bg-emerald-900/60 text-white font-mono font-bold px-2 py-0.5 rounded text-xs border border-emerald-700/50 tracking-widest">
                      12345
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] text-[#666] uppercase block">Telegram Code</label>
                  <input
                    type="text"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[#444]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!code || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Connect</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTelegram2FA} className="space-y-4">
                <p className="text-white text-xs leading-relaxed">
                  Your Telegram account is protected with 2FA. Please enter your Cloud Password.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#666] uppercase block">Telegram 2FA Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password2FA}
                    onChange={(e) => setPassword2FA(e.target.value)}
                    className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-center text-sm focus:outline-none focus:border-[#444]"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!password2FA || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verifying 2FA...</span>
                    </>
                  ) : (
                    <>
                      <span>Unlock & Connect</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )
          ) : providerType === 'local' ? (
            <form onSubmit={handleLocalSubmit} className="space-y-4">
              <p className="text-white text-xs leading-relaxed">
                Persist encrypted chunks directly to your local file system.
              </p>
              <div className="space-y-1">
                <label className="text-[10px] text-[#666] uppercase block">Storage Folder Path</label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!localPath || isSubmitting}
                className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
              >
                {isSubmitting ? 'Connecting...' : 'Connect Local Storage'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-white text-xs leading-relaxed">
                Connect Cloudflare R2, AWS S3, or Supabase Storage with standard S3 API keys.
              </p>
              <button
                onClick={async () => {
                  setIsSubmitting(true);
                  await onConnectProvider('r2', {
                    endpoint: 'https://r2.cloudflarestorage.com',
                    bucket: 'bucketspace-drive',
                    region: 'auto',
                    accessKeyId: 'r2_key',
                    secretAccessKey: 'r2_secret',
                  });
                  setIsSubmitting(false);
                  onClose();
                }}
                className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press"
              >
                Connect S3 / R2 Bucket
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
