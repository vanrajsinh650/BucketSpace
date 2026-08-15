'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  Lock,
  Send,
  X,
} from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';

/* ------------------------------------------------------------------ */
/*  Public Props                                                       */
/* ------------------------------------------------------------------ */

export interface ProviderOnboardingModalProps {
  isOpen: boolean;
  /** When true renders a full-page welcome instead of a modal overlay */
  isFirstRun?: boolean;
  onClose: () => void;
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

type Screen =
  | 'CHOOSE_PROVIDER'
  | 'TELEGRAM_PHONE'
  | 'TELEGRAM_CODE'
  | 'TELEGRAM_2FA'
  | 'LOCAL_FOLDER'
  | 'CLOUD_CHOOSE'
  | 'CLOUD_R2'
  | 'CLOUD_S3'
  | 'CLOUD_SUPABASE'
  | 'SUCCESS';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProviderOnboardingModal({
  isOpen,
  isFirstRun = false,
  onClose,
  onConnectProvider,
}: ProviderOnboardingModalProps) {
  /* ── Navigation state ── */
  const [screen, setScreen] = useState<Screen>('CHOOSE_PROVIDER');
  const [connectedName, setConnectedName] = useState('');

  /* ── Telegram flow state ── */
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);

  /* ── Local disk state ── */
  const [localDir, setLocalDir] = useState('C:\\BucketSpace\\Storage');

  /* ── Cloud provider state ── */
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Region, setS3Region] = useState('auto');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseBucket, setSupabaseBucket] = useState('');

  /* ── Shared state ── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  /* ── Reset everything when closing ── */
  const handleClose = () => {
    setScreen('CHOOSE_PROVIDER');
    setPhone('');
    setCode('');
    setPassword('');
    setNeeds2FA(false);
    setError(null);
    setLoading(false);
    onClose();
  };

  /* ── Connect helper: calls parent and transitions to success ── */
  const doConnect = async (providerId: string, config: Record<string, unknown>, displayName: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await onConnectProvider(providerId, config);
      if (result.success) {
        setConnectedName(displayName);
        setScreen('SUCCESS');
      } else {
        setError(result.message || 'Connection failed. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Telegram: send phone number ── */
  const handleTelegramPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError(null);

    // Simulate sending code to Telegram (real impl would call API)
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setScreen('TELEGRAM_CODE');
  };

  /* ── Telegram: verify code ── */
  const handleTelegramCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);

    // Simulate code verification
    await new Promise((r) => setTimeout(r, 600));

    // In a real implementation, the API would tell us if 2FA is required
    // For now, transition directly to connection
    if (needs2FA) {
      setLoading(false);
      setScreen('TELEGRAM_2FA');
      return;
    }

    await doConnect('telegram', { mode: 'mtproto', phone }, 'Telegram');
  };

  /* ── Telegram: 2FA password ── */
  const handleTelegram2FA = async () => {
    if (!password.trim()) return;
    await doConnect('telegram', { mode: 'mtproto', phone, password }, 'Telegram');
  };

  /* ── Local disk connect ── */
  const handleLocalConnect = async () => {
    if (!localDir.trim()) return;
    await doConnect('local', { rootDir: localDir }, 'This computer');
  };

  /* ── Cloud provider connect ── */
  const handleCloudConnect = async (providerId: string) => {
    let config: Record<string, unknown> = {};
    let displayName = '';

    if (providerId === 'r2' || providerId === 's3') {
      config = {
        endpoint: s3Endpoint,
        region: s3Region,
        bucket: s3Bucket,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      };
      displayName = providerId === 'r2' ? 'Cloudflare R2' : 'AWS S3';
    } else if (providerId === 'supabase') {
      config = { supabaseUrl, supabaseKey, bucketName: supabaseBucket };
      displayName = 'Supabase';
    }

    await doConnect(providerId, config, displayName);
  };

  /* ================================================================ */
  /*  Render helpers                                                   */
  /* ================================================================ */

  /** Back button used in sub-screens */
  const BackButton = ({ to }: { to: Screen }) => (
    <button
      onClick={() => { setScreen(to); setError(null); }}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-6"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );

  /** Primary action button */
  const PrimaryButton = ({
    onClick,
    disabled,
    children,
  }: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold text-sm
                 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed
                 transition-all duration-200 flex items-center justify-center gap-2"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        children
      )}
    </button>
  );

  /** Error banner */
  const ErrorBanner = () =>
    error ? (
      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
        {error}
      </div>
    ) : null;

  /** Text input field */
  const InputField = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    autoFocus = false,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    autoFocus?: boolean;
  }) => (
    <div>
      <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3
                   text-white placeholder:text-slate-500 focus:border-slate-500
                   focus:outline-none transition-colors"
      />
    </div>
  );

  /* ================================================================ */
  /*  Screen: Choose Provider                                          */
  /* ================================================================ */

  const renderChooseProvider = () => (
    <div className="space-y-6">
      {/* Welcome heading */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">BucketSpace</h1>
        <p className="text-slate-300 text-base">Your files. One place.</p>
        <p className="text-slate-500 text-sm">Connect a storage to get started.</p>
      </div>

      {/* Provider cards */}
      <div className="space-y-3 pt-2">
        {/* Telegram */}
        <button
          onClick={() => setScreen('TELEGRAM_PHONE')}
          className="w-full p-5 rounded-2xl bg-slate-900/60 border border-slate-800
                     hover:border-slate-600 transition-all duration-200
                     flex items-center gap-4 text-left group"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400
                          group-hover:bg-blue-500/15 transition-colors shrink-0">
            <Send className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Telegram</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400
                             border border-emerald-500/30">
                Quickest setup
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Store files in your Telegram cloud</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-600 rotate-180 group-hover:text-slate-400
                               transition-colors shrink-0" />
        </button>

        {/* Local disk */}
        <button
          onClick={() => setScreen('LOCAL_FOLDER')}
          className="w-full p-5 rounded-2xl bg-slate-900/60 border border-slate-800
                     hover:border-slate-600 transition-all duration-200
                     flex items-center gap-4 text-left group"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400
                          group-hover:bg-amber-500/15 transition-colors shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">This computer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400
                             border border-slate-500/30">
                Offline
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Use a folder on this device</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-600 rotate-180 group-hover:text-slate-400
                               transition-colors shrink-0" />
        </button>

        {/* Cloud storage */}
        <button
          onClick={() => setScreen('CLOUD_CHOOSE')}
          className="w-full p-5 rounded-2xl bg-slate-900/60 border border-slate-800
                     hover:border-slate-600 transition-all duration-200
                     flex items-center gap-4 text-left group"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400
                          group-hover:bg-purple-500/15 transition-colors shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white">More storage options</span>
            <p className="text-sm text-slate-400 mt-0.5">Cloudflare R2, AWS S3, Supabase</p>
          </div>
          <ArrowLeft className="w-4 h-4 text-slate-600 rotate-180 group-hover:text-slate-400
                               transition-colors shrink-0" />
        </button>
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Telegram — Phone Number                                  */
  /* ================================================================ */

  const renderTelegramPhone = () => (
    <div className="space-y-5">
      <BackButton to="CHOOSE_PROVIDER" />

      <div className="text-center space-y-1">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400
                        flex items-center justify-center mx-auto mb-4">
          <Send className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-white">Connect Telegram</h2>
        <p className="text-sm text-slate-400">
          We&apos;ll connect BucketSpace to your Telegram account.
        </p>
      </div>

      <PhoneInputWithCountry
        label="Phone number"
        value={phone}
        onChange={setPhone}
        autoFocus
      />

      <ErrorBanner />

      <PrimaryButton onClick={handleTelegramPhone} disabled={!phone.trim()}>
        Continue
      </PrimaryButton>

      <p className="text-xs text-slate-500 text-center">
        Your Telegram app will receive a verification code.
      </p>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Telegram — Verification Code                             */
  /* ================================================================ */

  const renderTelegramCode = () => (
    <div className="space-y-5">
      <BackButton to="TELEGRAM_PHONE" />

      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-white">Enter your Telegram code</h2>
        <p className="text-sm text-slate-400">
          We sent a code to your Telegram app.
        </p>
      </div>

      <InputField
        label="Verification code"
        value={code}
        onChange={setCode}
        placeholder="12345"
        autoFocus
      />

      <ErrorBanner />

      <PrimaryButton onClick={handleTelegramCode} disabled={!code.trim()}>
        Verify
      </PrimaryButton>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Telegram — 2FA Password                                  */
  /* ================================================================ */

  const renderTelegram2FA = () => (
    <div className="space-y-5">
      <BackButton to="TELEGRAM_CODE" />

      <div className="text-center space-y-1">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400
                        flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-white">Two-step verification</h2>
        <p className="text-sm text-slate-400">
          Your Telegram account requires a password.
        </p>
      </div>

      <InputField
        label="Telegram password"
        value={password}
        onChange={setPassword}
        placeholder="Enter your password"
        type="password"
        autoFocus
      />

      <ErrorBanner />

      <PrimaryButton onClick={handleTelegram2FA} disabled={!password.trim()}>
        Continue
      </PrimaryButton>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Local Folder                                             */
  /* ================================================================ */

  const renderLocalFolder = () => (
    <div className="space-y-5">
      <BackButton to="CHOOSE_PROVIDER" />

      <div className="text-center space-y-1">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400
                        flex items-center justify-center mx-auto mb-4">
          <HardDrive className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-white">Use this computer</h2>
        <p className="text-sm text-slate-400">
          Choose where BucketSpace should store your files.
        </p>
      </div>

      <InputField
        label="Storage folder"
        value={localDir}
        onChange={setLocalDir}
        placeholder="C:\BucketSpace\Storage"
      />

      <ErrorBanner />

      <PrimaryButton onClick={handleLocalConnect} disabled={!localDir.trim()}>
        Connect
      </PrimaryButton>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Cloud Provider Choice                                    */
  /* ================================================================ */

  const renderCloudChoose = () => (
    <div className="space-y-5">
      <BackButton to="CHOOSE_PROVIDER" />

      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-white">Cloud storage</h2>
        <p className="text-sm text-slate-400">Choose a cloud provider.</p>
      </div>

      <div className="space-y-3">
        {[
          { id: 'CLOUD_R2' as Screen, name: 'Cloudflare R2', desc: 'S3-compatible, zero egress fees', icon: Cloud },
          { id: 'CLOUD_S3' as Screen, name: 'AWS S3', desc: 'Enterprise cloud object storage', icon: Database },
          { id: 'CLOUD_SUPABASE' as Screen, name: 'Supabase', desc: 'PostgreSQL-backed storage', icon: Database },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setScreen(p.id)}
            className="w-full p-4 rounded-xl bg-slate-900/60 border border-slate-800
                       hover:border-slate-600 transition-all duration-200
                       flex items-center gap-3 text-left group"
          >
            <p.icon className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-white text-sm">{p.name}</span>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Cloud credential forms (R2 / S3 / Supabase)             */
  /* ================================================================ */

  const renderCloudR2 = () => (
    <div className="space-y-4">
      <BackButton to="CLOUD_CHOOSE" />
      <h2 className="text-lg font-semibold text-white">Connect Cloudflare R2</h2>
      <InputField label="Endpoint URL" value={s3Endpoint} onChange={setS3Endpoint} placeholder="https://....r2.cloudflarestorage.com" />
      <InputField label="Bucket name" value={s3Bucket} onChange={setS3Bucket} placeholder="my-bucket" />
      <InputField label="Access key" value={s3AccessKey} onChange={setS3AccessKey} placeholder="Access key ID" />
      <InputField label="Secret key" value={s3SecretKey} onChange={setS3SecretKey} placeholder="Secret access key" type="password" />
      <ErrorBanner />
      <PrimaryButton onClick={() => handleCloudConnect('r2')} disabled={!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey}>
        Connect
      </PrimaryButton>
    </div>
  );

  const renderCloudS3 = () => (
    <div className="space-y-4">
      <BackButton to="CLOUD_CHOOSE" />
      <h2 className="text-lg font-semibold text-white">Connect AWS S3</h2>
      <InputField label="Region" value={s3Region} onChange={setS3Region} placeholder="us-east-1" />
      <InputField label="Bucket name" value={s3Bucket} onChange={setS3Bucket} placeholder="my-bucket" />
      <InputField label="Access key" value={s3AccessKey} onChange={setS3AccessKey} placeholder="Access key ID" />
      <InputField label="Secret key" value={s3SecretKey} onChange={setS3SecretKey} placeholder="Secret access key" type="password" />
      <ErrorBanner />
      <PrimaryButton onClick={() => handleCloudConnect('s3')} disabled={!s3Bucket || !s3AccessKey || !s3SecretKey}>
        Connect
      </PrimaryButton>
    </div>
  );

  const renderCloudSupabase = () => (
    <div className="space-y-4">
      <BackButton to="CLOUD_CHOOSE" />
      <h2 className="text-lg font-semibold text-white">Connect Supabase</h2>
      <InputField label="Project URL" value={supabaseUrl} onChange={setSupabaseUrl} placeholder="https://xxxx.supabase.co" />
      <InputField label="Service key" value={supabaseKey} onChange={setSupabaseKey} placeholder="eyJ..." type="password" />
      <InputField label="Bucket name" value={supabaseBucket} onChange={setSupabaseBucket} placeholder="storage-bucket" />
      <ErrorBanner />
      <PrimaryButton onClick={() => handleCloudConnect('supabase')} disabled={!supabaseUrl || !supabaseKey || !supabaseBucket}>
        Connect
      </PrimaryButton>
    </div>
  );

  /* ================================================================ */
  /*  Screen: Success                                                  */
  /* ================================================================ */

  const renderSuccess = () => (
    <div className="text-center space-y-6 py-8">
      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30
                      flex items-center justify-center mx-auto">
        <Check className="w-8 h-8 text-emerald-400" />
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white">{connectedName} connected</h2>
        <p className="text-sm text-slate-400">Your files are ready to store.</p>
      </div>

      <PrimaryButton onClick={handleClose}>
        {isFirstRun ? 'Open my files' : 'Done'}
      </PrimaryButton>
    </div>
  );

  /* ================================================================ */
  /*  Screen router                                                    */
  /* ================================================================ */

  const renderScreen = () => {
    switch (screen) {
      case 'CHOOSE_PROVIDER': return renderChooseProvider();
      case 'TELEGRAM_PHONE': return renderTelegramPhone();
      case 'TELEGRAM_CODE': return renderTelegramCode();
      case 'TELEGRAM_2FA': return renderTelegram2FA();
      case 'LOCAL_FOLDER': return renderLocalFolder();
      case 'CLOUD_CHOOSE': return renderCloudChoose();
      case 'CLOUD_R2': return renderCloudR2();
      case 'CLOUD_S3': return renderCloudS3();
      case 'CLOUD_SUPABASE': return renderCloudSupabase();
      case 'SUCCESS': return renderSuccess();
    }
  };

  /* ================================================================ */
  /*  Layout: full-page welcome vs modal overlay                       */
  /* ================================================================ */

  if (isFirstRun) {
    // Full-page welcome — no close button, no backdrop
    return (
      <div className="fixed inset-0 z-50 bg-[#0b0f19] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {renderScreen()}
        </div>
      </div>
    );
  }

  // Standard modal overlay
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md rounded-2xl p-6 bg-[#0d1117] border border-slate-800 shadow-2xl relative">
        {/* Close button — only shown on provider selection, not mid-flow */}
        {screen === 'CHOOSE_PROVIDER' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white
                       hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {renderScreen()}
      </div>
    </div>
  );
}
