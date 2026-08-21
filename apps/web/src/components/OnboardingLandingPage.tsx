'use client';

import React, { useState } from 'react';
import {
  Send,
  HardDrive,
  Cloud,
  Lock,
  Play,
  Layers,
  ArrowRight,
  Cpu,
  Terminal,
  Sliders,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
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
  // Modal connection state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'telegram' | 'local' | 'cloud'>('telegram');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | '2fa'>('phone');
  const [sessionToken, setSessionToken] = useState('');
  const [localPath, setLocalPath] = useState('C:\\BucketSpace\\Storage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Interactive Live Vault Demo State
  const [selectedDemoFile, setSelectedDemoFile] = useState(0);
  const [isSimulatingChunking, setIsSimulatingChunking] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(100);
  const simIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  const demoFiles = [
    {
      name: 'cinema_raw_footage_4k.mov',
      size: '1.42 GB',
      chunks: 71,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      provider: 'Telegram DC4 (Europe)',
      speed: '48.2 MB/s',
    },
    {
      name: 'financial_ledger_2026.sqlite',
      size: '84.5 MB',
      chunks: 5,
      hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      provider: 'Local NVMe Vault',
      speed: '1.2 GB/s',
    },
    {
      name: 'ai_weights_quantized.gguf',
      size: '3.80 GB',
      chunks: 190,
      hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      provider: 'Cloudflare R2 + Telegram Replica',
      speed: '92.4 MB/s',
    },
  ];

  const handleSimulate = (index: number) => {
    setSelectedDemoFile(index);
    setIsSimulatingChunking(true);
    setSimulatedProgress(0);

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }

    let p = 0;
    simIntervalRef.current = setInterval(() => {
      p += 20;
      setSimulatedProgress(p);
      if (p >= 100) {
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
        }
        setIsSimulatingChunking(false);
      }
    }, 150);
  };

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
      const res = await fetch(`${API_BASE}/api/v1/telegram/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send verification code from Telegram.');
      }

      setSessionToken(data.sessionToken);
      setStep('code');
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
        setStep('2fa');
        return;
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onFinishOnboarding();
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
      onFinishOnboarding();
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
    onFinishOnboarding();
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white font-sans selection:bg-white selection:text-black relative overflow-x-hidden">
      {/* ─── Background 1px Structural Grid ─── */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, #1e1e1e 1px, transparent 1px), linear-gradient(to bottom, #1e1e1e 1px, transparent 1px)`,
          backgroundSize: '4rem 4rem',
        }}
      />

      {/* ─── Sticky Header Navigation ─── */}
      <header className="sticky top-0 z-40 h-16 border-b border-[#1e1e1e] bg-black/90 backdrop-blur-md px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-white text-black font-mono font-black text-xs flex items-center justify-center rounded">
            B
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-tight uppercase text-white">
              BucketSpace
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#22c55e] border border-[#22c55e]/30 bg-[#22c55e]/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-ping" />
              CLUSTER LIVE
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider text-[#888]">
          <a href="#features" className="hover:text-white transition-colors">Capabilities</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          <a href="#benchmarks" className="hover:text-white transition-colors">Comparison</a>
        </nav>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {onLaunchSandbox && (
            <button
              onClick={onLaunchSandbox}
              className="border border-[#333] hover:border-white text-white px-3.5 py-1.5 rounded font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors btn-press"
            >
              <Play className="w-3 h-3 text-white" />
              <span>Sandbox Demo</span>
            </button>
          )}

          <button
            onClick={() => {
              setModalOpen(true);
              setStep('phone');
              setErrorMessage('');
            }}
            className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-1.5 rounded font-mono font-bold text-xs uppercase tracking-wider transition-colors btn-press shadow-sm"
          >
            Connect Drive
          </button>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="relative pt-16 pb-20 px-6 sm:px-12 max-w-7xl mx-auto space-y-12">
        <div className="space-y-6 max-w-4xl">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#121212] border border-[#1e1e1e] text-[11px] font-mono text-[#888] uppercase tracking-widest">
            <Cpu className="w-3.5 h-3.5 text-white" />
            <span>Distributed Object Storage System</span>
          </div>

          {/* Main Headline (Weight Inversion) */}
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-light tracking-tighter text-white uppercase leading-[0.95]">
            Infinite Cloud Drive. <br />
            <span className="font-extrabold text-white">Zero Subscription.</span>
          </h1>

          {/* Subtext */}
          <p className="text-base sm:text-lg font-mono text-[#888] max-w-2xl leading-relaxed">
            Turn your Telegram cloud channel, local SSDs, and S3 buckets into a single, high-performance personal cloud storage engine with client-side AES-256-GCM encryption.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => {
                setModalOpen(true);
                setStep('phone');
                setErrorMessage('');
              }}
              className="bg-white text-black hover:bg-[#e0e0e0] px-6 py-3 rounded-lg font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors btn-press shadow-lg"
            >
              <span>Connect Storage Provider</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onLaunchSandbox && (
              <button
                onClick={onLaunchSandbox}
                className="border border-[#222] hover:border-white bg-[#0a0a0a] hover:bg-[#121212] text-white px-6 py-3 rounded-lg font-mono text-xs uppercase tracking-wider flex items-center gap-2 transition-colors btn-press"
              >
                <Terminal className="w-4 h-4 text-[#888]" />
                <span>Launch Interactive Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Metric Strip ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-[#1e1e1e] border border-[#1e1e1e] rounded-lg overflow-hidden font-mono">
          <div className="bg-black p-4 sm:p-5 space-y-1">
            <div className="text-[10px] text-[#666] uppercase tracking-widest">Storage Cost</div>
            <div className="text-2xl font-light text-white">$0.00 / mo</div>
            <div className="text-[10px] text-[#555]">Unlimited via Telegram MTProto</div>
          </div>
          <div className="bg-black p-4 sm:p-5 space-y-1">
            <div className="text-[10px] text-[#666] uppercase tracking-widest">Ingestion Pipeline</div>
            <div className="text-2xl font-light text-white">20 MB Chunks</div>
            <div className="text-[10px] text-[#555]">Parallel Multi-Part Uploads</div>
          </div>
          <div className="bg-black p-4 sm:p-5 space-y-1">
            <div className="text-[10px] text-[#666] uppercase tracking-widest">Encryption Standard</div>
            <div className="text-2xl font-light text-white">AES-256-GCM</div>
            <div className="text-[10px] text-[#555]">Zero-Knowledge Envelope</div>
          </div>
          <div className="bg-black p-4 sm:p-5 space-y-1">
            <div className="text-[10px] text-[#666] uppercase tracking-widest">Integrity Invariant</div>
            <div className="text-2xl font-light text-white">100% SHA-256</div>
            <div className="text-[10px] text-[#555]">Cryptographic Digest Receipts</div>
          </div>
        </div>

        {/* ─── Interactive Live Product Console ─── */}
        <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-xl overflow-hidden shadow-2xl space-y-0">
          {/* Console Top Window Bar */}
          <div className="px-4 py-3 border-b border-[#1e1e1e] bg-[#0d0d0d] flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <span className="text-[#666] text-[11px] ml-2">bucketspace-vault-telemetry.sh</span>
            </div>
            <span className="text-[10px] text-[#22c55e]">● LIVE INTERACTIVE SIMULATOR</span>
          </div>

          {/* Console Interactive Body */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-xs">
            {/* Left: Interactive File List (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="text-[10px] text-[#666] uppercase tracking-wider">
                Click File To Simulate Chunking
              </div>
              <div className="space-y-2">
                {demoFiles.map((file, idx) => (
                  <div
                    key={file.name}
                    onClick={() => handleSimulate(idx)}
                    className={`p-3.5 rounded border cursor-pointer transition-colors btn-press ${
                      selectedDemoFile === idx
                        ? 'border-white bg-[#161616] text-white'
                        : 'border-[#1e1e1e] bg-[#0a0a0a] text-[#888] hover:border-[#333] hover:text-white'
                    }`}
                  >
                    <div className="font-medium text-xs truncate text-white">{file.name}</div>
                    <div className="flex items-center justify-between text-[10px] text-[#666] mt-1.5">
                      <span>{file.size}</span>
                      <span>{file.chunks} chunks</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Live Telemetry & Pipeline Inspector (8 cols) */}
            <div className="lg:col-span-8 bg-black border border-[#1e1e1e] rounded-lg p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e1e1e] pb-3">
                <div className="space-y-0.5">
                  <div className="text-white font-medium text-xs">{demoFiles[selectedDemoFile].name}</div>
                  <div className="text-[10px] text-[#666]">
                    Routing: <span className="text-white uppercase">{demoFiles[selectedDemoFile].provider}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#22c55e] font-bold">{demoFiles[selectedDemoFile].speed}</div>
                  <div className="text-[10px] text-[#555]">Throughput</div>
                </div>
              </div>

              {/* Live Slicing Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#888]">
                    {isSimulatingChunking ? 'Hashing & Slicing Chunks...' : 'Zero-Knowledge Cryptographic Assembly Complete'}
                  </span>
                  <span className="text-white font-bold">{simulatedProgress}%</span>
                </div>
                <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-150"
                    style={{ width: `${simulatedProgress}%` }}
                  />
                </div>
              </div>

              {/* Chunk Hash Distribution */}
              <div className="space-y-2">
                <div className="text-[10px] text-[#666] uppercase">SHA-256 Root Digest</div>
                <div className="p-2.5 bg-[#121212] border border-[#1e1e1e] rounded text-[11px] text-white font-mono truncate">
                  {demoFiles[selectedDemoFile].hash}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e1e1e] text-[10px]">
                <div className="text-[#666]">
                  Status: <span className="text-[#22c55e]">VERIFIED</span>
                </div>
                <div className="text-[#666]">
                  DC Latency: <span className="text-white">18ms</span>
                </div>
                <div className="text-[#666]">
                  Cipher: <span className="text-white">AES-GCM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Bento Grid Capabilities Section ─── */}
      <section id="features" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto space-y-10 border-t border-[#1e1e1e]">
        <div className="space-y-3">
          <div className="text-[11px] font-mono text-[#888] uppercase tracking-widest">
            Core Architecture
          </div>
          <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white uppercase">
            Engineered For Pure Privacy.
          </h2>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          {/* Card 1: Telegram MTProto (2 cols span) */}
          <div className="md:col-span-2 bg-[#0a0a0a] border border-[#1e1e1e] p-6 sm:p-8 rounded-xl space-y-4 flex flex-col justify-between group hover:border-[#333] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded bg-[#121212] border border-[#222] flex items-center justify-center text-white">
                <Send className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Telegram MTProto Storage Engine
              </h3>
              <p className="text-xs text-[#888] leading-relaxed max-w-lg">
                Upload files of any size without hitches. BucketSpace automatically slices large media into deterministic 20MB encrypted chunks, streaming them directly into your private Telegram cloud infrastructure with infinite free capacity.
              </p>
            </div>
            <div className="pt-4 border-t border-[#1e1e1e] flex items-center justify-between text-[11px] text-[#666]">
              <span>Zero Account Limits</span>
              <span className="text-white">Parallel Part Slicing</span>
            </div>
          </div>

          {/* Card 2: Zero-Knowledge AES-256 */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 sm:p-8 rounded-xl space-y-4 flex flex-col justify-between group hover:border-[#333] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded bg-[#121212] border border-[#222] flex items-center justify-center text-white">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Zero-Knowledge Encryption
              </h3>
              <p className="text-xs text-[#888] leading-relaxed">
                Files are encrypted locally in your browser using AES-256-GCM before transport. Not even Telegram or BucketSpace can see file names, contents, or metadata.
              </p>
            </div>
            <div className="pt-4 border-t border-[#1e1e1e] text-[11px] text-[#22c55e]">
              Client-Side WebCrypto API
            </div>
          </div>

          {/* Card 3: Multi-Provider Redundancy */}
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] p-6 sm:p-8 rounded-xl space-y-4 flex flex-col justify-between group hover:border-[#333] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded bg-[#121212] border border-[#222] flex items-center justify-center text-white">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Multi-Cloud Replicas
              </h3>
              <p className="text-xs text-[#888] leading-relaxed">
                Mirror chunks automatically between Telegram, local SSDs, AWS S3, and Cloudflare R2. Self-healing integrity engines repair corrupted replicas in the background.
              </p>
            </div>
            <div className="pt-4 border-t border-[#1e1e1e] text-[11px] text-[#666]">
              Self-Healing Checksums
            </div>
          </div>

          {/* Card 4: Policy Routing Engine (2 cols span) */}
          <div className="md:col-span-2 bg-[#0a0a0a] border border-[#1e1e1e] p-6 sm:p-8 rounded-xl space-y-4 flex flex-col justify-between group hover:border-[#333] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded bg-[#121212] border border-[#222] flex items-center justify-center text-white">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Storage Policy Engine
              </h3>
              <p className="text-xs text-[#888] leading-relaxed max-w-lg">
                Create granular rules to automate storage tiering based on MIME types, file size, or directory paths (e.g. store raw 4K videos on Telegram, keep confidential PDFs on local disk, and backup code archives to R2).
              </p>
            </div>
            <div className="pt-4 border-t border-[#1e1e1e] flex items-center justify-between text-[11px] text-[#666]">
              <span>Dynamic Rule Matcher</span>
              <span className="text-white">Deterministic Priority Order</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Comparison Matrix Section ─── */}
      <section id="benchmarks" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto space-y-10 border-t border-[#1e1e1e]">
        <div className="space-y-3">
          <div className="text-[11px] font-mono text-[#888] uppercase tracking-widest">
            Comparison
          </div>
          <h2 className="text-3xl sm:text-5xl font-light tracking-tight text-white uppercase">
            Legacy Cloud vs BucketSpace.
          </h2>
        </div>

        <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-xl overflow-hidden font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e1e1e] bg-[#121212] text-[10px] text-[#666] uppercase">
                <th className="p-4 sm:p-5">Feature</th>
                <th className="p-4 sm:p-5 text-[#888]">Google Drive / Dropbox</th>
                <th className="p-4 sm:p-5 text-white">BucketSpace Vault</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e1e]">
              <tr>
                <td className="p-4 sm:p-5 font-bold text-white uppercase">Storage Quota Cost</td>
                <td className="p-4 sm:p-5 text-[#888]">$120 to $240 / year</td>
                <td className="p-4 sm:p-5 text-[#22c55e] font-bold">$0.00 Forever</td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-white uppercase">Max File Upload Boundary</td>
                <td className="p-4 sm:p-5 text-[#888]">Subject to 2TB Tier Cap</td>
                <td className="p-4 sm:p-5 text-white">Unlimited Multi-Chunk Ingestion</td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-white uppercase">Encryption Keys Ownership</td>
                <td className="p-4 sm:p-5 text-[#888]">Provider Holds Keys (Plaintext Scans)</td>
                <td className="p-4 sm:p-5 text-[#22c55e] font-bold">100% Client-Side AES-256-GCM</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#1e1e1e] py-8 px-6 sm:px-12 font-mono text-xs text-[#666] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white text-black font-bold text-[10px] flex items-center justify-center rounded">
            B
          </div>
          <span>BucketSpace Personal Cloud Storage</span>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <span>AES-256-GCM Envelope Encryption</span>
          <span>SHA-256 Integrity Verified</span>
          <span>MIT License</span>
        </div>
      </footer>

      {/* ─── Provider Connection Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono text-xs">
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
              <span className="font-bold uppercase tracking-wider text-white text-sm">
                Connect Storage Cluster
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#666] hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Type Selector */}
            <div className="grid grid-cols-3 gap-1 bg-[#121212] p-1 border border-[#1e1e1e] rounded-lg">
              <button
                onClick={() => {
                  setActiveProvider('telegram');
                  setStep('phone');
                  setErrorMessage('');
                }}
                className={`py-1.5 rounded text-[10px] uppercase font-bold transition-colors btn-press ${
                  activeProvider === 'telegram' ? 'bg-white text-black' : 'text-[#888] hover:text-white'
                }`}
              >
                Telegram
              </button>
              <button
                onClick={() => {
                  setActiveProvider('local');
                  setErrorMessage('');
                }}
                className={`py-1.5 rounded text-[10px] uppercase font-bold transition-colors btn-press ${
                  activeProvider === 'local' ? 'bg-white text-black' : 'text-[#888] hover:text-white'
                }`}
              >
                Local NVMe
              </button>
              <button
                onClick={() => {
                  setActiveProvider('cloud');
                  setErrorMessage('');
                }}
                className={`py-1.5 rounded text-[10px] uppercase font-bold transition-colors btn-press ${
                  activeProvider === 'cloud' ? 'bg-white text-black' : 'text-[#888] hover:text-white'
                }`}
              >
                S3 / R2
              </button>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* Provider Forms */}
            {activeProvider === 'telegram' ? (
              step === 'phone' ? (
                <form onSubmit={handleTelegramPhone} className="space-y-4">
                  <p className="text-white text-xs leading-relaxed">
                    Connect your private Telegram account. A real 5-digit verification code will be sent to your Telegram app.
                  </p>
                  <PhoneInputWithCountry value={phone} onChange={setPhone} label="International Phone Number" />
                  <button
                    type="submit"
                    disabled={!phone || isSubmitting}
                    className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Sending Real Code via MTProto...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Telegram Code</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              ) : step === 'code' ? (
                <form onSubmit={handleTelegramCode} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white text-xs leading-relaxed">
                      Enter the 5-digit code sent to your Telegram app for <span className="font-bold text-white">{phone}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep('phone')}
                      className="text-[10px] text-[#888] hover:text-white underline shrink-0 ml-2"
                    >
                      Change
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#666] uppercase block">5-Digit Telegram Code</label>
                    <input
                      type="text"
                      placeholder="12345"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2.5 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[#444]"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!code || isSubmitting}
                    className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Authenticating Session...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Enter Drive</span>
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
                      className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2.5 text-white font-mono text-center text-sm focus:outline-none focus:border-[#444]"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!password2FA || isSubmitting}
                    className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>Verifying 2FA Password...</span>
                      </>
                    ) : (
                      <>
                        <span>Unlock Vault</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )
            ) : activeProvider === 'local' ? (
              <form onSubmit={handleLocalSubmit} className="space-y-4">
                <p className="text-white text-xs leading-relaxed">
                  Store encrypted chunks on your local drive with zero network dependency.
                </p>
                <div className="space-y-1">
                  <label className="text-[10px] text-[#666] uppercase block">Local Vault Folder</label>
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!localPath || isSubmitting}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press disabled:opacity-50"
                >
                  {isSubmitting ? 'Connecting...' : 'Connect Local Vault'}
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
                    onFinishOnboarding();
                  }}
                  className="w-full bg-white text-black hover:bg-[#e0e0e0] py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors btn-press"
                >
                  Connect S3 / R2 Bucket
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
