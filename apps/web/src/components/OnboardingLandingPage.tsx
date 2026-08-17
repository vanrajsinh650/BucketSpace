'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Cpu,
  Database,
  Eye,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  HelpCircle,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  Lock,
  Music,
  Play,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';

export interface OnboardingLandingPageProps {
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
  onFinishOnboarding: () => void;
}

type ModalFlow =
  | null
  | 'TELEGRAM_PHONE'
  | 'TELEGRAM_CODE'
  | 'TELEGRAM_2FA'
  | 'LOCAL_FOLDER'
  | 'CLOUD_R2'
  | 'CLOUD_S3'
  | 'CLOUD_SUPABASE'
  | 'SUCCESS';

export function OnboardingLandingPage({
  onConnectProvider,
  onFinishOnboarding,
}: OnboardingLandingPageProps) {
  // Modal flow state
  const [activeFlow, setActiveFlow] = useState<ModalFlow>(null);
  const [connectedProviderTitle, setConnectedProviderTitle] = useState('');

  // Interactive Demo State
  const [activeDemoTab, setActiveDemoTab] = useState<'telegram' | 'local' | 'r2'>('telegram');
  const [selectedDemoFile, setSelectedDemoFile] = useState<number>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Telegram form state
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [showAdvancedTelegram, setShowAdvancedTelegram] = useState(false);
  const [codeSentViaApp, setCodeSentViaApp] = useState(true);

  // Local disk state
  const [localDir, setLocalDir] = useState('C:\\BucketSpace\\Storage');

  // Cloud credentials state
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Region, setS3Region] = useState('auto');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseBucket, setSupabaseBucket] = useState('');

  // Async state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetModalState = () => {
    setActiveFlow(null);
    setError(null);
    setLoading(false);
    setCode('');
    setPassword('');
    setSessionToken('');
  };

  const executeConnect = async (
    providerId: string,
    config: Record<string, unknown>,
    displayName: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await onConnectProvider(providerId, config);
      if (res.success) {
        setConnectedProviderTitle(displayName);
        setActiveFlow('SUCCESS');
      } else {
        setError(res.message || 'Connection failed. Please check credentials.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramPhoneSubmit = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { phone: phone.trim() };
      if (apiId.trim()) payload.apiId = Number(apiId.trim());
      if (apiHash.trim()) payload.apiHash = apiHash.trim();

      const response = await fetch('http://localhost:4000/api/v1/telegram/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send Telegram code');
      }

      setSessionToken(data.sessionToken);
      setCodeSentViaApp(data.isCodeViaApp ?? true);
      setActiveFlow('TELEGRAM_CODE');
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Telegram. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramCodeSubmit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:4000/api/v1/telegram/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, code: code.trim() }),
      });

      const data = await response.json();

      if (
        data.requires2FA ||
        (data.message && (data.message.toLowerCase().includes('2fa') || data.message.toLowerCase().includes('password')))
      ) {
        setError(null);
        setActiveFlow('TELEGRAM_2FA');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      if (data.success && data.sessionString) {
        await executeConnect(
          'telegram',
          { mode: 'mtproto', phone, sessionString: data.sessionString },
          'Telegram Cloud'
        );
      } else {
        throw new Error('Verification failed. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification code failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTelegram2FASubmit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:4000/api/v1/telegram/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, password: password.trim() }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.sessionString) {
        throw new Error(data.message || 'Invalid 2FA password');
      }

      await executeConnect(
        'telegram',
        { mode: 'mtproto', phone, sessionString: data.sessionString },
        'Telegram Cloud'
      );
    } catch (err: any) {
      setError(err?.message || '2FA authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSubmit = async () => {
    if (!localDir.trim()) return;
    await executeConnect('local', { rootDir: localDir }, 'This Computer (Local Disk)');
  };

  const handleCloudSubmit = async (providerId: string) => {
    let config: Record<string, unknown> = {};
    let name = '';

    if (providerId === 'r2' || providerId === 's3') {
      config = {
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3Bucket,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      };
      name = providerId === 'r2' ? 'Cloudflare R2' : 'AWS S3';
    } else if (providerId === 'supabase') {
      config = { supabaseUrl, supabaseKey, bucketName: supabaseBucket };
      name = 'Supabase Storage';
    }

    await executeConnect(providerId, config, name);
  };

  const demoFiles = [
    {
      name: '4K_Drone_Cinematic_Footage.mp4',
      size: '1.42 GB',
      chunks: 284,
      provider: 'Telegram Cloud',
      icon: Video,
      color: 'text-blue-400',
      badge: '284 Chunks Encrypted',
      hash: '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
    },
    {
      name: 'Q3_Financial_Forecast_Master.xlsx',
      size: '18.4 MB',
      chunks: 4,
      provider: 'Local SSD',
      icon: FileText,
      color: 'text-amber-400',
      badge: '4 Chunks Verified',
      hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    },
    {
      name: 'Raw_Production_Dataset.parquet',
      size: '640 MB',
      chunks: 128,
      provider: 'Cloudflare R2',
      icon: Database,
      color: 'text-purple-400',
      badge: 'Zero Egress Verified',
      hash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    },
  ];

  const faqs = [
    {
      q: 'How does Telegram Cloud storage work with BucketSpace?',
      a: 'Telegram allows users to upload files up to 2 GB with zero subscription fees. BucketSpace automatically slices your large files into encrypted 5 MB to 2 GB chunks using client-side AES-256-GCM, uploads them to your Telegram account, and reconstructs them on-the-fly when you browse or download.',
    },
    {
      q: 'Can Telegram or third parties view my files?',
      a: 'No. All files are client-side encrypted before leaving your browser using keys derived with scrypt and AES-256-GCM envelope encryption. Telegram and cloud providers only ever receive encrypted ciphertext chunks. They cannot see your filenames, contents, or directory trees.',
    },
    {
      q: 'Can I combine multiple storage providers at the same time?',
      a: 'Yes! BucketSpace features intelligent chunk routing and storage policies. You can store your media on Telegram Cloud, sensitive documents on your local SSD, and archives on Cloudflare R2 or Supabase — all accessible from one unified drive.',
    },
    {
      q: 'What happens if a provider is temporarily unreachable?',
      a: 'BucketSpace includes built-in redundancy replication and parity repair. When redundancy is enabled, critical files are replicated across multiple backends and automatically repaired from healthy replicas if a provider goes offline.',
    },
    {
      q: 'Is BucketSpace truly open source and free?',
      a: 'Yes, BucketSpace is 100% open-source under the MIT license. You can self-host it locally or on your private server with zero telemetry and zero vendor lock-in.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background Ambient Glow Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[800px] right-[-150px] w-[600px] h-[600px] bg-indigo-600/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[1400px] left-[-150px] w-[600px] h-[600px] bg-purple-600/10 blur-3xl pointer-events-none -z-10" />

      {/* ─── Top Navigation Bar ─── */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">BucketSpace</span>
              <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                v1.0 RC
              </span>
            </div>
            <p className="text-xs text-slate-400">Personal Multi-Cloud Drive System</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-medium">
          <a href="#demo" className="hover:text-cyan-400 transition-colors">Interactive Demo</a>
          <a href="#providers" className="hover:text-cyan-400 transition-colors">Storage Backends</a>
          <a href="#comparison" className="hover:text-cyan-400 transition-colors">Comparison</a>
          <a href="#faq" className="hover:text-cyan-400 transition-colors">FAQ</a>
          <button
            onClick={() => setActiveFlow('TELEGRAM_PHONE')}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium transition-all"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <main className="max-w-7xl mx-auto px-6 pt-16 pb-24 space-y-28">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Turn any free or enterprise storage into a unified personal cloud</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.1]">
            Your Storage.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
              One Workspace.
            </span>{' '}
            Zero Lock-in.
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Transform Telegram Cloud, your local SSD, Cloudflare R2, and AWS S3 into a private, encrypted personal drive.
            Enjoy unlimited capacity, zero monthly subscription costs, and instant hybrid search.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveFlow('TELEGRAM_PHONE')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 group"
            >
              <Send className="w-4 h-4 text-white" />
              <span>Connect Telegram Cloud</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setActiveFlow('LOCAL_FOLDER')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Use Local Storage Folder</span>
            </button>
          </div>
        </div>

        {/* ─── Hero Live Interactive Demo Drive Widget ─── */}
        <section id="demo" className="max-w-5xl mx-auto rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 bg-slate-950/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400">BucketSpace Drive Explorer (Interactive Preview)</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Simulate Storage Backend:</span>
              {(['telegram', 'local', 'r2'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDemoTab(tab)}
                  className={`px-2.5 py-1 rounded-lg font-mono capitalize transition-all ${
                    activeDemoTab === tab
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {tab === 'telegram' ? 'Telegram' : tab === 'local' ? 'Local SSD' : 'R2 Cloud'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
            {/* File List */}
            <div className="p-4 space-y-2 md:col-span-2">
              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider px-2 pb-1">
                Active Unified Drive Files
              </div>
              {demoFiles.map((file, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedDemoFile(idx)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedDemoFile === idx
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                      : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl bg-slate-800/80 border border-slate-700 ${file.color}`}>
                      <file.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold truncate">{file.name}</h4>
                      <p className="text-xs text-slate-400">{file.size} • Managed via {file.provider}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0 ml-2">
                    {file.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* File Inspector & Cryptographic Proof */}
            <div className="p-5 space-y-4 bg-slate-950/40 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 font-mono">
                  <span>Inspection Details</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Bit-Verified
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Target File</span>
                  <p className="text-xs font-semibold text-white truncate">{demoFiles[selectedDemoFile].name}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Encryption Standard</span>
                  <p className="text-xs text-cyan-300 font-mono">AES-256-GCM Envelope Key</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Whole-File SHA-256</span>
                  <p className="text-[10px] text-slate-300 font-mono break-all bg-slate-900 p-2 rounded-xl border border-slate-800">
                    {demoFiles[selectedDemoFile].hash}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Routing Target:</span>
                  <span className="font-semibold text-white capitalize">{activeDemoTab}</span>
                </div>
                <button
                  onClick={() => {
                    if (activeDemoTab === 'telegram') setActiveFlow('TELEGRAM_PHONE');
                    else if (activeDemoTab === 'local') setActiveFlow('LOCAL_FOLDER');
                    else setActiveFlow('CLOUD_R2');
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Connect this Backend</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Storage Selection Hub: Connect Cards Grid ─── */}
        <section id="providers" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Choose Your Storage Engine</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Select where you want BucketSpace to store your encrypted chunks. You can link multiple providers anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Card 1: Telegram Cloud (Featured) */}
            <div className="relative group p-7 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-blue-500/30 hover:border-blue-400/60 shadow-xl shadow-blue-500/5 transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-inner">
                    <Send className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    ✨ UNLIMITED FREE CLOUD
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-blue-200 transition-colors">
                    Telegram Cloud
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Turn Telegram into your personal, unlimited cloud drive. Files are client-encrypted, split into 2 GB
                    chunks, and stored securely with zero subscription fees.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-slate-400">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Zero Monthly Cost</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">2 GB / Chunk</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">4x Parallel Streams</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveFlow('TELEGRAM_PHONE');
                  setError(null);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 group-hover:gap-3"
              >
                <span>Connect Telegram Account</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Card 2: This Computer (Local Disk) */}
            <div className="relative group p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-inner">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    ⚡ FAST & OFFLINE
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-amber-200 transition-colors">
                    This Computer
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Store files directly on your local SSD or hard drive in a dedicated directory. Instant line-speed
                    access with zero internet connection required.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-slate-400">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Line-Speed I/O</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Sandboxed Storage</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Offline-First</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveFlow('LOCAL_FOLDER');
                  setError(null);
                }}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/40 text-slate-200 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Select Local Storage Folder</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Card 3: Cloudflare R2 & AWS S3 */}
            <div className="relative group p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 shadow-inner">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    🛡️ ZERO EGRESS
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-purple-200 transition-colors">
                    Cloudflare R2 / AWS S3
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Connect enterprise cloud object storage buckets. Compatible with Cloudflare R2, AWS S3, Wasabi,
                    MinIO, and standard S3-compatible endpoints.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-slate-400">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">11 9s Durability</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Zero Egress on R2</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">S3 Presigned URLs</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    setActiveFlow('CLOUD_R2');
                    setError(null);
                  }}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-all"
                >
                  Cloudflare R2
                </button>
                <button
                  onClick={() => {
                    setActiveFlow('CLOUD_S3');
                    setError(null);
                  }}
                  className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-all"
                >
                  AWS S3
                </button>
              </div>
            </div>

            {/* Card 4: Supabase Storage */}
            <div className="relative group p-7 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 shadow-xl transition-all duration-300 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-inner">
                    <Database className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    🗄️ RESILIENT
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-200 transition-colors">
                    Supabase Storage
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    PostgreSQL-backed resilient object storage buckets with built-in global CDN distribution and automated
                    backups.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono text-slate-400">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">PostgreSQL Schema</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Global CDN</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">Instant REST</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveFlow('CLOUD_SUPABASE');
                  setError(null);
                }}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/40 text-slate-200 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>Connect Supabase Storage</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ─── Engineering Highlights ─── */}
        <div className="border-t border-slate-800/60 pt-16 space-y-10">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white">Built for Security, Performance & Autonomy</h3>
            <p className="text-sm text-slate-400">Engineered with high cryptographic standards across every layer.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: Shield,
                title: 'Envelope Encryption',
                desc: 'scrypt key derivation + AES-256-GCM with unique 96-bit nonces. Zero plaintext secrets.',
                color: 'text-cyan-400',
              },
              {
                icon: CheckCircle2,
                title: 'Bit-Fidelity Checks',
                desc: 'Every chunk is verified with SHA-256 on upload, download, and background repair cycles.',
                color: 'text-emerald-400',
              },
              {
                icon: Search,
                title: 'Zero-Cost Hybrid Search',
                desc: 'Instant SQLite FTS5 BM25 text indexing paired with optional local AI vector embeddings.',
                color: 'text-amber-400',
              },
              {
                icon: RefreshCw,
                title: 'Self-Healing Redundancy',
                desc: 'Replicate files across multiple providers with automated parity verification.',
                color: 'text-purple-400',
              },
            ].map((f, i) => (
              <div key={i} className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
                <f.icon className={`w-5 h-5 ${f.color}`} />
                <h4 className="font-semibold text-sm text-white">{f.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Comparison Section ─── */}
        <section id="comparison" className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Why BucketSpace?</h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              How BucketSpace compares to traditional proprietary cloud drives.
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/60 backdrop-blur-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 font-mono text-slate-400">
                  <th className="p-4 sm:p-5">Feature</th>
                  <th className="p-4 sm:p-5 text-cyan-400 font-bold">BucketSpace</th>
                  <th className="p-4 sm:p-5">Google Drive / Dropbox</th>
                  <th className="p-4 sm:p-5">Raw Cloud Console</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Monthly Subscription</td>
                  <td className="p-4 sm:p-5 text-emerald-400 font-bold">$0 / Month (Free Unlimited)</td>
                  <td className="p-4 sm:p-5 text-slate-400">$10 – $100+ / mo</td>
                  <td className="p-4 sm:p-5 text-slate-400">Pay-per-GB + Egress</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Encryption & Privacy</td>
                  <td className="p-4 sm:p-5 text-cyan-300 font-bold">Client-Side AES-256-GCM (Zero Knowledge)</td>
                  <td className="p-4 sm:p-5 text-slate-400">Server-Side (Vendor holds keys)</td>
                  <td className="p-4 sm:p-5 text-slate-400">Server-Side KMS</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Vendor Independence</td>
                  <td className="p-4 sm:p-5 text-cyan-300 font-bold">100% (Switch or combine any provider)</td>
                  <td className="p-4 sm:p-5 text-rose-400">High Vendor Lock-in</td>
                  <td className="p-4 sm:p-5 text-rose-400">Single Cloud Locked</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Large File Handling</td>
                  <td className="p-4 sm:p-5 text-cyan-300 font-bold">Resumable 512KB-2GB chunk streaming</td>
                  <td className="p-4 sm:p-5 text-slate-400">Strict upload caps & timeouts</td>
                  <td className="p-4 sm:p-5 text-slate-400">Multipart CLI scripts</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-semibold text-white">Offline Access</td>
                  <td className="p-4 sm:p-5 text-cyan-300 font-bold">Instant Local SSD Directory Mode</td>
                  <td className="p-4 sm:p-5 text-slate-400">Partial sync client</td>
                  <td className="p-4 sm:p-5 text-rose-400">None</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── FAQ Section ─── */}
        <section id="faq" className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</h2>
            <p className="text-sm text-slate-400">Everything you need to know about BucketSpace architecture.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/50 border border-slate-800/80 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors"
                >
                  <span className="font-semibold text-sm text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${
                      openFaqIndex === idx ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {openFaqIndex === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 bg-slate-950/80 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-300">BucketSpace</span>
            <span>•</span>
            <span>Open Source Personal Cloud Drive System</span>
          </div>

          <div className="flex items-center gap-6">
            <span>MIT License</span>
            <span>Zero Telemetry</span>
            <span>Client-Side AES-256</span>
          </div>
        </div>
      </footer>

      {/* ─── Connection Modal Overlay ─── */}
      {activeFlow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl p-6 bg-[#0d1117] border border-slate-700/80 shadow-2xl relative space-y-5">
            {/* Header / Back */}
            {activeFlow !== 'SUCCESS' && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <button
                  onClick={resetModalState}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <span className="text-xs font-mono text-slate-400">Connect Storage</span>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Flow 1: Telegram Phone */}
            {activeFlow === 'TELEGRAM_PHONE' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-2">
                    <Send className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Connect Telegram</h3>
                  <p className="text-xs text-slate-400">
                    We&apos;ll link BucketSpace to your personal Telegram cloud.
                  </p>
                </div>

                <PhoneInputWithCountry
                  value={phone}
                  onChange={setPhone}
                  label="Phone number"
                  autoFocus
                />

                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedTelegram(!showAdvancedTelegram)}
                    className="text-[11px] text-cyan-400/80 hover:text-cyan-300 transition-colors flex items-center gap-1 mx-auto"
                  >
                    <span>{showAdvancedTelegram ? 'Hide' : 'Custom Telegram App API ID / Hash (Optional)'}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedTelegram ? 'rotate-180' : ''}`} />
                  </button>

                  {showAdvancedTelegram && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs text-left">
                      <p className="text-[11px] text-slate-400">
                        Obtain your own free API credentials from{' '}
                        <a
                          href="https://my.telegram.org"
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 underline"
                        >
                          my.telegram.org
                        </a>{' '}
                        under <em>API development tools</em>.
                      </p>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">API ID</label>
                        <input
                          type="text"
                          value={apiId}
                          onChange={(e) => setApiId(e.target.value)}
                          placeholder="e.g. 12345678"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">API Hash</label>
                        <input
                          type="password"
                          value={apiHash}
                          onChange={(e) => setApiHash(e.target.value)}
                          placeholder="e.g. abcdef1234567890..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleTelegramPhoneSubmit}
                  disabled={!phone.trim() || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Verification Code'}
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Telegram will deliver a real 5-digit verification code to your Telegram app.
                </p>
              </div>
            )}

            {/* Flow 2: Telegram Code */}
            {activeFlow === 'TELEGRAM_CODE' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-white">Enter Verification Code</h3>
                  <p className="text-xs text-slate-400">
                    We sent a login code to your Telegram app.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1.5">Verification code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="12345"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-center text-lg tracking-widest focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleTelegramCodeSubmit}
                  disabled={!code.trim() || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Connect'}
                </button>
              </div>
            )}

            {/* Flow 3: Telegram 2FA */}
            {activeFlow === 'TELEGRAM_2FA' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-white">Two-Step Verification</h3>
                  <p className="text-xs text-slate-400">Enter your Telegram 2FA cloud password.</p>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleTelegram2FASubmit}
                  disabled={!password.trim() || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </button>
              </div>
            )}

            {/* Flow 4: Local Folder */}
            {activeFlow === 'LOCAL_FOLDER' && (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Choose Storage Directory</h3>
                  <p className="text-xs text-slate-400">Specify a folder on this computer to store your files.</p>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1.5">Directory path</label>
                  <input
                    type="text"
                    value={localDir}
                    onChange={(e) => setLocalDir(e.target.value)}
                    placeholder="C:\BucketSpace\Storage"
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleLocalSubmit}
                  disabled={!localDir.trim() || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Local Storage'}
                </button>
              </div>
            )}

            {/* Flow 5: Cloudflare R2 */}
            {activeFlow === 'CLOUD_R2' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">Connect Cloudflare R2</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Endpoint URL</label>
                    <input
                      type="text"
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                      placeholder="https://<account-id>.r2.cloudflarestorage.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                      placeholder="my-bucket"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Access Key ID</label>
                    <input
                      type="text"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      placeholder="Access Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      placeholder="Secret Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCloudSubmit('r2')}
                  disabled={!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect R2 Bucket'}
                </button>
              </div>
            )}

            {/* Flow 6: AWS S3 */}
            {activeFlow === 'CLOUD_S3' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">Connect AWS S3</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Region</label>
                    <input
                      type="text"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.target.value)}
                      placeholder="us-east-1"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.target.value)}
                      placeholder="my-bucket"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Access Key ID</label>
                    <input
                      type="text"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.target.value)}
                      placeholder="Access Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.target.value)}
                      placeholder="Secret Key"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCloudSubmit('s3')}
                  disabled={!s3Bucket || !s3AccessKey || !s3SecretKey || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect S3 Bucket'}
                </button>
              </div>
            )}

            {/* Flow 7: Supabase */}
            {activeFlow === 'CLOUD_SUPABASE' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white">Connect Supabase</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Project URL</label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xxxx.supabase.co"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Service Role Key</label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJ..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={supabaseBucket}
                      onChange={(e) => setSupabaseBucket(e.target.value)}
                      placeholder="storage-bucket"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleCloudSubmit('supabase')}
                  disabled={!supabaseUrl || !supabaseKey || !supabaseBucket || loading}
                  className="w-full py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 disabled:opacity-40 font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect Supabase'}
                </button>
              </div>
            )}

            {/* Flow 8: Success */}
            {activeFlow === 'SUCCESS' && (
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                  <Check className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-white">{connectedProviderTitle} Connected</h3>
                  <p className="text-xs text-slate-400">
                    Your personal cloud drive workspace is ready to use.
                  </p>
                </div>

                <button
                  onClick={onFinishOnboarding}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                >
                  Open My Workspace
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
