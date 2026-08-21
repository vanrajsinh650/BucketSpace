'use client';

import React, { useState } from 'react';
import { Send, HardDrive, Cloud, ArrowRight, ShieldCheck, Play, Layers, X } from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';

interface OnboardingLandingPageProps {
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
  onFinishOnboarding: () => void;
  onLaunchSandbox?: () => void;
}

export function OnboardingLandingPage({
  onConnectProvider,
  onFinishOnboarding,
  onLaunchSandbox,
}: OnboardingLandingPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTelegramPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setStep('code');
  };

  const handleTelegramCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setIsSubmitting(true);
    await onConnectProvider('telegram', { phone, code });
    setIsSubmitting(false);
    onFinishOnboarding();
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[#1e1e1e] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-white text-black font-mono font-bold text-xs flex items-center justify-center rounded">
            B
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
            BucketSpace
          </span>
        </div>

        {onLaunchSandbox && (
          <button
            onClick={onLaunchSandbox}
            className="border border-[#333] hover:border-white text-white px-3.5 py-1.5 rounded font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors btn-press"
          >
            <Play className="w-3 h-3" />
            <span>Launch Sandbox Demo</span>
          </button>
        )}
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl my-auto py-12 space-y-8">
        <div className="space-y-4">
          <div className="text-[11px] font-mono text-[#888] uppercase tracking-widest">
            High Performance Personal Cloud Storage
          </div>
          <h1 className="text-4xl sm:text-6xl font-light tracking-tighter text-white uppercase leading-none">
            Zero Compromise <br />
            <span className="font-bold">Encrypted Storage.</span>
          </h1>
          <p className="text-sm font-mono text-[#888] max-w-xl leading-relaxed">
            Chunked, zero-knowledge encrypted, and distributed across Telegram MTProto, Local Disks, and S3 clusters.
          </p>
        </div>

        {/* Primary Connection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => setModalOpen(true)}
            className="bg-[#0a0a0a] hover:bg-[#121212] border border-[#1e1e1e] hover:border-[#444] p-5 rounded-lg cursor-pointer transition-colors btn-press space-y-3 group"
          >
            <Send className="w-5 h-5 text-white" />
            <div>
              <div className="font-mono text-xs font-bold text-white uppercase">Telegram Cloud</div>
              <div className="font-mono text-[10px] text-[#666] mt-1">Unlimited private storage</div>
            </div>
            <div className="font-mono text-[10px] text-white flex items-center gap-1 uppercase tracking-wider">
              <span>Connect</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={async () => {
              await onConnectProvider('local-disk', { path: 'C:\\BucketSpace' });
              onFinishOnboarding();
            }}
            className="bg-[#0a0a0a] hover:bg-[#121212] border border-[#1e1e1e] hover:border-[#444] p-5 rounded-lg cursor-pointer transition-colors btn-press space-y-3 group"
          >
            <HardDrive className="w-5 h-5 text-white" />
            <div>
              <div className="font-mono text-xs font-bold text-white uppercase">This Computer</div>
              <div className="font-mono text-[10px] text-[#666] mt-1">Local encrypted vault</div>
            </div>
            <div className="font-mono text-[10px] text-white flex items-center gap-1 uppercase tracking-wider">
              <span>Connect</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={async () => {
              await onConnectProvider('s3-r2', { bucket: 'bucketspace' });
              onFinishOnboarding();
            }}
            className="bg-[#0a0a0a] hover:bg-[#121212] border border-[#1e1e1e] hover:border-[#444] p-5 rounded-lg cursor-pointer transition-colors btn-press space-y-3 group"
          >
            <Cloud className="w-5 h-5 text-white" />
            <div>
              <div className="font-mono text-xs font-bold text-white uppercase">S3 / R2 Cluster</div>
              <div className="font-mono text-[10px] text-[#666] mt-1">Cloudflare & AWS</div>
            </div>
            <div className="font-mono text-[10px] text-white flex items-center gap-1 uppercase tracking-wider">
              <span>Connect</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e1e] pt-4 flex items-center justify-between text-[11px] font-mono text-[#666]">
        <div>AES-256-GCM Envelope Encryption</div>
        <div>SHA-256 Integrity Verified</div>
      </footer>

      {/* Telegram Connect Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-white">
                Connect Telegram
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#666] hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 'phone' ? (
              <form onSubmit={handleTelegramPhone} className="space-y-4">
                <PhoneInputWithCountry value={phone} onChange={setPhone} label="Phone Number" />
                <button
                  type="submit"
                  disabled={!phone}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
                >
                  Continue
                </button>
              </form>
            ) : (
              <form onSubmit={handleTelegramCode} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#666] uppercase block">Verification Code</label>
                  <input
                    type="text"
                    placeholder="12345"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-center tracking-widest text-lg focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!code || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying...' : 'Finish Setup'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
