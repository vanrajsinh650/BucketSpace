'use client';

import React, { useState, useEffect } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';

export interface OnboardingLandingPageProps {
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
  onFinishOnboarding: () => void;
  onLaunchSandbox?: () => void;
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
  onLaunchSandbox,
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
  const [resendCooldown, setResendCooldown] = useState(60);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeFlow === 'TELEGRAM_CODE' && resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeFlow, resendCooldown]);

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
    setInfoMessage(null);
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
      setResendCooldown(60);
      setActiveFlow('TELEGRAM_CODE');
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Telegram. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!phone.trim() || resendCooldown > 0 || loading) return;
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    setCode('');
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
        throw new Error(data.message || 'Failed to resend Telegram code');
      }

      setSessionToken(data.sessionToken);
      setResendCooldown(60);
      setInfoMessage('A fresh verification code was sent to your Telegram app.');
    } catch (err: any) {
      setError(err?.message || 'Failed to resend verification code');
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
    <div className="min-h-screen bg-black text-white relative selection:bg-white selection:text-black overflow-hidden font-sans">
      {/* Structural Grid Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-[#222] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-lg leading-none tracking-tighter">
            B
          </div>
          <span className="font-bold tracking-tight uppercase text-sm">BucketSpace</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-[#888]">
          <button
            onClick={() => onLaunchSandbox ? onLaunchSandbox() : executeConnect('in-memory', {}, 'Sandbox Drive')}
            className="px-3 py-1.5 border border-[#333] hover:border-white text-white uppercase tracking-wider text-[11px] transition-colors"
          >
            Launch Sandbox Demo
          </button>
          <span className="hidden sm:inline text-[#555]">V 1.0</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-24 relative z-10 space-y-16">
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#333] text-xs font-mono text-[#888] uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span>Zero-Knowledge Personal Cloud</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter leading-[0.95]">
            ZERO <br/><span className="text-[#666]">COMPROMISE</span><br/> STORAGE.
          </h1>

          <p className="text-base sm:text-lg text-[#888] max-w-2xl leading-relaxed">
            Turn Telegram Cloud, Local Disk, Cloudflare R2, or AWS S3 into a private encrypted personal drive.
            No subscriptions. No AI telemetry. Just your files.
          </p>

          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={() => setActiveFlow('TELEGRAM_PHONE')}
              className="px-6 py-3.5 bg-white hover:bg-[#e5e5e5] text-black font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4 fill-current" />
              <span>Connect Telegram</span>
            </button>
            <button
              onClick={() => setActiveFlow('LOCAL_FOLDER')}
              className="px-6 py-3.5 bg-black border border-[#444] hover:border-white text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
            >
              <HardDrive className="w-4 h-4 text-[#888]" />
              <span>Local Storage</span>
            </button>
            <button
              onClick={() => setActiveFlow('CLOUD_R2')}
              className="px-6 py-3.5 bg-black border border-[#444] hover:border-white text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
            >
              <Cloud className="w-4 h-4 text-[#888]" />
              <span>Cloud Storage (R2/S3)</span>
            </button>
            <button
              onClick={() => onLaunchSandbox ? onLaunchSandbox() : executeConnect('in-memory', {}, 'Sandbox Drive')}
              className="px-6 py-3.5 bg-[#111] border border-[#333] hover:border-white text-[#aaa] hover:text-white font-bold uppercase tracking-widest text-xs transition-colors flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-white" />
              <span>Try Sandbox (Instant)</span>
            </button>
          </div>
        </div>

        {/* Interactive Architecture Preview */}
        <div className="border border-[#222] bg-[#050505] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222] pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#aaa]">Live Storage Architecture</span>
            </div>
            <div className="flex gap-2 text-xs font-mono">
              {(['telegram', 'local', 'r2'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveDemoTab(tab)}
                  className={`px-3 py-1 border uppercase text-[11px] transition-colors ${
                    activeDemoTab === tab ? 'border-white text-white bg-[#151515]' : 'border-[#222] text-[#666] hover:text-white'
                  }`}
                >
                  {tab === 'telegram' ? 'Telegram Cloud' : tab === 'local' ? 'Local SSD' : 'Cloudflare R2'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoFiles.map((file, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedDemoFile(idx)}
                className={`p-4 border cursor-pointer transition-all space-y-3 ${
                  selectedDemoFile === idx ? 'border-white bg-[#111]' : 'border-[#222] bg-black hover:border-[#444]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold font-mono text-white">{file.name}</span>
                  <span className="text-[#888] font-mono">{file.size}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#666] border-t border-[#222] pt-2">
                  <span>{file.chunks} Chunks</span>
                  <span className="text-white">{file.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Connection Modals */}
      <AnimatePresence>
      {activeFlow && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 15 }} transition={{ type: 'spring', bounce: 0 }} className="w-full max-w-md bg-black border border-[#333] p-8 relative">
            <button onClick={resetModalState} className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold tracking-tight uppercase font-mono mb-1">
              {activeFlow === 'SUCCESS' ? 'Status' : 'Connect Storage'}
            </h2>
            <p className="text-xs text-[#888] font-mono mb-6">
              {activeFlow === 'TELEGRAM_PHONE' && 'Enter your Telegram phone number'}
              {activeFlow === 'TELEGRAM_CODE' && 'Enter the 5-digit verification code'}
              {activeFlow === 'TELEGRAM_2FA' && 'Two-step verification password'}
              {activeFlow === 'LOCAL_FOLDER' && 'Select your local storage folder'}
              {(activeFlow === 'CLOUD_R2' || activeFlow === 'CLOUD_S3') && 'Enter S3/R2 API Credentials'}
              {activeFlow === 'CLOUD_SUPABASE' && 'Enter Supabase Storage Credentials'}
              {activeFlow === 'SUCCESS' && 'Storage registered successfully'}
            </p>

            <div className="space-y-4">
              {activeFlow === 'TELEGRAM_PHONE' && (
                <div className="space-y-4">
                  <PhoneInputWithCountry value={phone} onChange={setPhone} />
                  <button onClick={handleTelegramPhoneSubmit} disabled={loading || !phone.trim()} className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] disabled:opacity-40 transition-all">
                    {loading ? 'Sending Code...' : 'Send Verification Code'}
                  </button>
                </div>
              )}

              {activeFlow === 'TELEGRAM_CODE' && (
                <div className="space-y-4">
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono text-center tracking-[0.6em] text-lg" placeholder="00000" />
                  <button onClick={handleTelegramCodeSubmit} disabled={loading || !code.trim()} className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] disabled:opacity-40 transition-all">
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>
                  {resendCooldown > 0 ? (
                    <p className="text-[11px] font-mono text-center text-[#666]">Resend code in {resendCooldown}s</p>
                  ) : (
                    <button onClick={handleResendCode} className="w-full text-[11px] font-mono text-center text-white underline">Resend code</button>
                  )}
                </div>
              )}

              {activeFlow === 'TELEGRAM_2FA' && (
                <div className="space-y-4">
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono" placeholder="Password" />
                  <button onClick={handleTelegram2FASubmit} disabled={loading || !password.trim()} className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] disabled:opacity-40 transition-all">
                    {loading ? 'Authenticating...' : 'Authenticate'}
                  </button>
                </div>
              )}

              {activeFlow === 'LOCAL_FOLDER' && (
                <div className="space-y-4">
                  <input type="text" value={localDir} onChange={e => setLocalDir(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono text-xs" placeholder="C:\\BucketSpace\\Storage" />
                  <button onClick={handleLocalSubmit} disabled={loading || !localDir.trim()} className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] disabled:opacity-40 transition-all">
                    {loading ? 'Mounting...' : 'Mount Storage'}
                  </button>
                </div>
              )}

              {(activeFlow === 'CLOUD_R2' || activeFlow === 'CLOUD_S3') && (
                <div className="space-y-3">
                  <input type="text" value={s3Endpoint} onChange={e => setS3Endpoint(e.target.value)} className="w-full bg-black border border-[#444] text-white p-2.5 focus:border-white outline-none font-mono text-xs" placeholder="Endpoint URL" />
                  <input type="text" value={s3Bucket} onChange={e => setS3Bucket(e.target.value)} className="w-full bg-black border border-[#444] text-white p-2.5 focus:border-white outline-none font-mono text-xs" placeholder="Bucket Name" />
                  <input type="text" value={s3AccessKey} onChange={e => setS3AccessKey(e.target.value)} className="w-full bg-black border border-[#444] text-white p-2.5 focus:border-white outline-none font-mono text-xs" placeholder="Access Key ID" />
                  <input type="password" value={s3SecretKey} onChange={e => setS3SecretKey(e.target.value)} className="w-full bg-black border border-[#444] text-white p-2.5 focus:border-white outline-none font-mono text-xs" placeholder="Secret Access Key" />
                  <button onClick={() => handleCloudSubmit(activeFlow === 'CLOUD_R2' ? 'r2' : 's3')} disabled={loading || !s3Bucket.trim()} className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] disabled:opacity-40 transition-all mt-2">
                    {loading ? 'Connecting...' : 'Connect Cloud Bucket'}
                  </button>
                </div>
              )}

              {activeFlow === 'SUCCESS' && (
                <div className="space-y-6 text-center py-2">
                  <div className="w-12 h-12 border border-white flex items-center justify-center mx-auto text-white">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight uppercase font-mono">Connected</h3>
                    <p className="text-xs text-[#888] font-mono mt-1">{connectedProviderTitle} is ready</p>
                  </div>
                  <button
                    onClick={() => {
                      resetModalState();
                      onFinishOnboarding();
                    }}
                    className="w-full bg-white text-black font-bold uppercase tracking-widest p-3.5 text-xs hover:bg-[#e5e5e5] transition-colors"
                  >
                    Open Workspace
                  </button>
                </div>
              )}
            </div>
            
            {error && <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">{error}</div>}
            {infoMessage && <div className="mt-4 p-3 border border-white/20 bg-white/5 text-white text-xs font-mono">{infoMessage}</div>}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
