'use client';

import React, { useState } from 'react';
import { X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';
import { humanizeError } from '../lib/humanize-error';

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
  const [telegramStep, setTelegramStep] = useState<'phone' | 'code' | '2fa'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  /* ─── REAL Telegram MTProto Auth Handlers ─── */

  const API_BASE =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')
      : '';

  const handleTelegramPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/v1/telegram/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send verification code from Telegram.');
      }

      setSessionToken(data.sessionToken);
      setTelegramStep('code');
    } catch (err: any) {
      setErrorMessage(humanizeError(err));
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      if (data.requires2FA) {
        setTelegramStep('2fa');
        return;
      }

      if (!data.success) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onClose();
    } catch (err: any) {
      setErrorMessage(humanizeError(err));
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid 2FA password.');
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onClose();
    } catch (err: any) {
      setErrorMessage(humanizeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="provider-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <h2 id="provider-modal-title" className="text-sm font-semibold tracking-wide text-zinc-100">
            Connect Telegram Storage
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            aria-label="Close Telegram storage connection"
          >
            <X className="w-4 h-4" />
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
          {telegramStep === 'phone' ? (
            <form onSubmit={handleTelegramPhone} className="space-y-3.5">
                <p className="text-zinc-300 text-xs leading-relaxed">
                  Connect your Telegram account to store files encrypted in the browser before upload.
                </p>
                <PhoneInputWithCountry value={phone} onChange={setPhone} label="Phone Number" />

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
            )}
        </div>
      </div>
    </div>
  );
}
