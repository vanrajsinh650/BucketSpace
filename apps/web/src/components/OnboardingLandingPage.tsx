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
      {/* Brutalist Grid Background overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      <header className="w-full px-6 py-6 flex items-center justify-between border-b border-[#222] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold text-lg leading-none tracking-tighter">
            B
          </div>
          <span className="font-bold tracking-tight uppercase text-sm">BucketSpace</span>
        </div>
        <div className="flex gap-6 text-xs font-mono text-[#888] uppercase tracking-widest">
          <span className="hover:text-white cursor-pointer transition-colors">V 1.0</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24 relative z-10">
        <div className="space-y-12">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter leading-[0.9]">
            ZERO <br/><span className="text-[#666]">COMPROMISE</span><br/> STORAGE.
          </h1>

          <p className="text-lg text-[#888] max-w-xl leading-relaxed">
            A brutally simple personal drive. Local disk, Telegram, S3, or R2. 
            No subscriptions. No AI bloat. Just your files.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-[#222]">
            <button
              onClick={() => setActiveFlow('TELEGRAM_PHONE')}
              className="px-8 py-4 bg-white hover:bg-[#e5e5e5] text-black font-bold uppercase tracking-widest text-xs transition-colors"
            >
              Connect Telegram
            </button>
            <button
              onClick={() => setActiveFlow('LOCAL_FOLDER')}
              className="px-8 py-4 bg-black border border-[#444] hover:border-white text-white font-bold uppercase tracking-widest text-xs transition-colors"
            >
              Local Disk
            </button>
          </div>
        </div>
      </main>

      {/* MONOCHROME MODAL OVERLAY */}
      <AnimatePresence>
      {activeFlow && activeFlow !== 'SUCCESS' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ type: 'spring', bounce: 0 }} className="w-full max-w-md bg-black border border-[#333] p-8 relative">
            <button onClick={() => setActiveFlow(null)} className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-2xl font-bold tracking-tight mb-2">CONNECT</h2>
            
            <div className="space-y-6 mt-8">
              {activeFlow === 'TELEGRAM_PHONE' && (
                <div className="space-y-4">
                  <label className="block text-xs font-mono uppercase text-[#888]">Phone Number</label>
                  <PhoneInputWithCountry value={phone} onChange={setPhone} />
                  <button onClick={handleTelegramPhoneSubmit} disabled={loading} className="w-full bg-white text-black font-bold uppercase tracking-widest p-4 mt-4 disabled:opacity-50">
                    {loading ? 'Processing...' : 'Send Code'}
                  </button>
                </div>
              )}

              {activeFlow === 'TELEGRAM_CODE' && (
                <div className="space-y-4">
                  <label className="block text-xs font-mono uppercase text-[#888]">Verification Code</label>
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono text-center tracking-[1em]" placeholder="00000" />
                  <button onClick={handleTelegramCodeSubmit} disabled={loading} className="w-full bg-white text-black font-bold uppercase tracking-widest p-4 mt-4 disabled:opacity-50">
                    {loading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              )}

              {activeFlow === 'TELEGRAM_2FA' && (
                <div className="space-y-4">
                  <label className="block text-xs font-mono uppercase text-[#888]">2FA Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono" />
                  <button onClick={handleTelegram2FASubmit} disabled={loading} className="w-full bg-white text-black font-bold uppercase tracking-widest p-4 mt-4 disabled:opacity-50">
                    {loading ? 'Authenticating...' : 'Submit'}
                  </button>
                </div>
              )}

              {activeFlow === 'LOCAL_FOLDER' && (
                <div className="space-y-4">
                  <label className="block text-xs font-mono uppercase text-[#888]">Local Directory Path</label>
                  <input type="text" value={localDir} onChange={e => setLocalDir(e.target.value)} className="w-full bg-black border border-[#444] text-white p-3 focus:border-white outline-none font-mono" />
                  <button onClick={handleLocalSubmit} disabled={loading} className="w-full bg-white text-black font-bold uppercase tracking-widest p-4 mt-4 disabled:opacity-50">
                    {loading ? 'Connecting...' : 'Mount'}
                  </button>
                </div>
              )}
            </div>
            
            {error && <div className="mt-4 p-3 border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-mono">{error}</div>}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
