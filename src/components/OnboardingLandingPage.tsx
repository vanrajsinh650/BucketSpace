'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  HardDrive,
  Cloud,
  Lock,
  ArrowRight,
  Terminal,
  X,
  AlertCircle,
  Loader2,
  Key,
} from 'lucide-react';
import { PhoneInputWithCountry } from './PhoneInputWithCountry';
import { humanizeError } from '../lib/humanize-error';
import { FloatingClouds } from './FloatingClouds';

interface OnboardingLandingPageProps {
  onConnectProvider: (
    providerId: string,
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; message?: string }>;
  onFinishOnboarding: () => void;
}

export function OnboardingLandingPage({
  onConnectProvider,
  onFinishOnboarding,
}: OnboardingLandingPageProps) {
  // Modal connection state
  const [modalOpen, setModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password2FA, setPassword2FA] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | '2fa'>('phone');
  const [sessionToken, setSessionToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      setStep('code');
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
        setStep('2fa');
        return;
      }

      if (!data.success) {
        throw new Error(data.message || 'Invalid or expired verification code.');
      }

      await onConnectProvider('telegram', { sessionString: data.sessionString, phone });
      onFinishOnboarding();
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
      onFinishOnboarding();
    } catch (err: any) {
      setErrorMessage(humanizeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-50 font-sans selection:bg-stone-50 selection:text-black overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/20">
            <Cloud className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">BucketSpace</span>
        </div>
        
        <div className="hidden lg:flex items-center gap-8 text-sm text-stone-400">
          <a href="#features" className="hover:text-stone-50 transition-colors">Features</a>
          <Link href="/privacy" className="hover:text-stone-50 transition-colors">Privacy Policy</Link>
          <a href="https://github.com/vanrajsinh650/BucketSpace" target="_blank" rel="noreferrer" className="hover:text-stone-50 transition-colors">GitHub</a>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setModalOpen(true);
              setStep('phone');
              setErrorMessage('');
            }}
            className="hidden md:block text-sm font-medium text-stone-300 hover:text-white transition-colors"
          >
            Sign in
          </button>
          <button 
            onClick={() => {
              setModalOpen(true);
              setStep('phone');
              setErrorMessage('');
            }}
            className="bg-white text-black hover:bg-stone-200 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <main id="main-content" className="pt-32 pb-16 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="relative flex flex-col lg:flex-row items-center min-h-[60vh] md:min-h-[70vh]">
          {/* Ethereal Floating Clouds Animation - Procedural & Organic */}
          <FloatingClouds
            preset="hero"
            density={32}
            opacity={1}
            className="right-[-10%] top-[-15%] w-full lg:w-[125%] h-[130%]"
          />

          <div className="relative z-10 lg:w-1/2 flex flex-col items-start text-left mt-12 lg:mt-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white motion-safe:animate-pulse-slow" />
              <span className="text-xs font-medium text-stone-300">Client-side encryption. Telegram-backed storage.</span>
            </div>

            <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl xl:text-[7.5rem] leading-[1.05] tracking-tight mb-8">
              A place for<br />everything.
            </h1>
            
            <p className="text-lg md:text-xl text-stone-400 mb-10 max-w-lg leading-relaxed font-sans">
              A personal storage workspace built on Telegram MTProto. Files are encrypted on this device before upload.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <button 
                onClick={() => {
                  setModalOpen(true);
                  setStep('phone');
                  setErrorMessage('');
                }}
                className="w-full sm:w-auto bg-white text-black hover:bg-stone-200 px-6 py-3.5 rounded-full text-[15px] font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-[1.02]"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button 
                className="w-full sm:w-auto bg-transparent border border-white/20 text-white hover:bg-white/5 px-6 py-3.5 rounded-full text-[15px] font-medium transition-colors"
                onClick={() => {
                  const el = document.getElementById('features');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Explore BucketSpace
              </button>
            </div>
          </div>
        </div>

        {/* ─── Mini Value Props Strip ─── */}
        <div className="mt-24 mb-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-2 rounded-3xl bg-[#111] border border-white/5">
          <div className="p-6 flex flex-col gap-3">
            <HardDrive className="w-6 h-6 text-stone-400" />
            <h3 className="font-medium text-[15px]">Your Files</h3>
            <p className="text-sm text-stone-500 leading-relaxed">Keep your uploaded files in one workspace.</p>
          </div>
          <div className="p-6 flex flex-col gap-3">
            <Lock className="w-6 h-6 text-stone-400" />
            <h3 className="font-medium text-[15px]">Client-Side Encryption</h3>
            <p className="text-sm text-stone-500 leading-relaxed">AES-256-GCM encryption before upload.</p>
          </div>
          <div className="p-6 flex flex-col gap-3">
            <Terminal className="w-6 h-6 text-stone-400" />
            <h3 className="font-medium text-[15px]">Open source</h3>
            <p className="text-sm text-stone-500 leading-relaxed">Source code is available on GitHub.</p>
          </div>
          <div className="p-6 flex flex-col gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h3 className="font-medium text-[15px]">File controls</h3>
            <p className="text-sm text-stone-500 leading-relaxed">Search, preview, download, and share files.</p>
          </div>
        </div>

        {/* ─── UI Showcase Section ─── */}
        <div id="features" className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24 mb-40">
          <div className="lg:w-1/3 flex flex-col">
            <span className="text-sm font-medium text-stone-500 mb-4">Everything in one place</span>
            <h2 className="font-serif text-5xl md:text-6xl tracking-tight leading-[1.1] mb-6">
              All your files.<br />One workspace.
            </h2>
            <p className="text-lg text-stone-400 mb-10 leading-relaxed max-w-sm font-sans">
              Upload, search, preview, download, and share files from the BucketSpace workspace.
            </p>
            
            <div className="flex flex-wrap gap-4 mb-10">
              <div className="flex items-center gap-2 text-sm text-stone-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <HardDrive className="w-4 h-4" /> Files
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Photos
              </div>
              <div className="flex items-center gap-2 text-sm text-stone-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Videos
              </div>
            </div>

            <p className="text-sm text-stone-500">The interface shown is an illustrative example.</p>
          </div>

          <div className="lg:w-2/3 w-full">
            {/* Fake OS Window UI mimicking reference */}
            <div className="w-full bg-[#111] rounded-2xl border border-white/5 shadow-2xl overflow-hidden flex flex-col font-sans">
              {/* Window Header */}
              <div className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-[#0a0a0a]">
                <div className="flex items-center gap-2 text-stone-300">
                  <Cloud className="w-5 h-5" />
                  <span className="font-semibold text-sm">BucketSpace — Example interface</span>
                </div>
                <div className="flex-1 max-w-md mx-6">
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-2">
                    <SearchIcon className="w-4 h-4 text-stone-500" />
                    <span className="text-xs text-stone-500">Search your files...</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#1a1a1a] border border-white/5 text-stone-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Send className="w-3 h-3" /> Upload
                  </span>
                </div>
              </div>
              
              <div className="flex flex-1 min-h-[400px]">
                {/* Sidebar */}
                <div className="w-56 border-r border-white/5 bg-[#0a0a0a]/50 p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-3 px-3 py-2 bg-white/10 rounded-lg text-white text-sm font-medium">
                    <HardDrive className="w-4 h-4" /> All Files
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-stone-400 hover:text-stone-300 hover:bg-white/5 rounded-lg text-sm transition">
                    <ImageIcon className="w-4 h-4" /> Photos
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-stone-400 hover:text-stone-300 hover:bg-white/5 rounded-lg text-sm transition">
                    <FilePdfIcon className="w-4 h-4" /> Documents
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-stone-400 hover:text-stone-300 hover:bg-white/5 rounded-lg text-sm transition">
                    <TrashIcon className="w-4 h-4" /> Trash
                  </div>
                  
                  <div className="mt-auto pt-6 border-t border-white/5">
                    <div className="text-xs text-stone-500 mb-2">Example workspace</div>
                    <div className="text-xs font-medium text-stone-300 mb-2"><span className="text-white">Demo</span> data</div>
                    <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-white w-[0%] rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-[#111] p-6">
                  <h3 className="text-lg font-medium mb-6 text-stone-200">All Files</h3>
                  
                  <div className="grid grid-cols-12 text-xs font-medium text-stone-500 pb-3 border-b border-white/5 mb-3">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-4">Modified</div>
                    <div className="col-span-2">Size</div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-stone-300">
                    {[
                      { icon: <FileDesignIcon className="w-4 h-4 text-blue-400" />, name: 'Project Notes.md', date: 'Example', size: 'Demo File' },
                      { icon: <ImageIcon className="w-4 h-4 text-green-400" />, name: 'Summer Photo.jpg', date: 'Example', size: 'Demo File' },
                      { icon: <FilePdfIcon className="w-4 h-4 text-red-400" />, name: 'Budget.pdf', date: 'Example', size: 'Demo File' },
                      { icon: <FileDesignIcon className="w-4 h-4 text-blue-400" />, name: 'Design System.fig', date: 'Example', size: 'Demo File' },
                      { icon: <FilePdfIcon className="w-4 h-4 text-red-400" />, name: 'Presentation.pdf', date: 'Example', size: 'Demo File' },
                      { icon: <ImageIcon className="w-4 h-4 text-green-400" />, name: 'Screenshot.png', date: 'Example', size: 'Demo File' },
                    ].map((item, i) => (
                      <div key={i} className="grid grid-cols-12 items-center py-3 hover:bg-white/5 rounded-lg px-2 -mx-2 transition cursor-default">
                        <div className="col-span-6 flex items-center gap-3">
                          {item.icon}
                          <span className="font-medium text-stone-200">{item.name}</span>
                        </div>
                        <div className="col-span-4 text-stone-500 text-xs">{item.date}</div>
                        <div className="col-span-2 text-stone-500 text-xs">{item.size}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Powerful Features Section ─── */}
        <div className="mb-40">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div>
              <span className="text-sm font-medium text-stone-500 mb-4 block">Workspace features</span>
              <h2 className="font-serif text-4xl md:text-5xl tracking-tight leading-[1.1] max-w-xl">
                Core workspace<br />features.
              </h2>
            </div>
            <a href="https://github.com/vanrajsinh650/BucketSpace" target="_blank" rel="noreferrer" className="text-sm font-medium text-stone-300 hover:text-white flex items-center gap-1.5 transition-colors mt-6 md:mt-0 font-sans">
              View the project <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
            <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col justify-between min-h-[280px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-12">
                <SearchIcon className="w-5 h-5 text-stone-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 text-stone-200">File search</h3>
                <p className="text-sm text-stone-400 leading-relaxed">Find files in your workspace by name.</p>
              </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col justify-between min-h-[280px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-12">
                <FolderIcon className="w-5 h-5 text-stone-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 text-stone-200">File categories</h3>
                <p className="text-sm text-stone-400 leading-relaxed">Browse photos, videos, documents, archives, and trash.</p>
              </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col justify-between min-h-[280px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-12">
                <ShareIcon className="w-5 h-5 text-stone-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 text-stone-200">Share links</h3>
                <p className="text-sm text-stone-400 leading-relaxed">Create links for downloading individual files.</p>
              </div>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-3xl p-8 flex flex-col justify-between min-h-[280px]">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-12">
                <Terminal className="w-5 h-5 text-stone-300" />
              </div>
              <div>
                <h3 className="text-lg font-medium mb-3 text-stone-200">Open source</h3>
                <p className="text-sm text-stone-400 leading-relaxed">Inspect the implementation and contribute on GitHub.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Bottom CTA Banner ─── */}
        <div className="relative rounded-3xl overflow-hidden bg-[#111] border border-white/5 min-h-[300px] flex items-center">
          {/* Ethereal Floating Clouds Animation */}
          <FloatingClouds
            preset="banner"
            density={20}
            opacity={0.8}
            className="inset-0 w-full h-full"
          />
          
          <div className="relative z-10 p-12 md:p-16 max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4 block font-sans">Built around your files</span>
            <h2 className="font-serif text-4xl md:text-5xl tracking-tight leading-[1.1] mb-6">
              Encryption before upload.
            </h2>
            <p className="text-stone-400 leading-relaxed mb-8 font-sans">
              BucketSpace encrypts file chunks in the browser before they are sent to Telegram storage.
            </p>
          </div>
        </div>

      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 bg-black py-16 px-6 md:px-12 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center border border-white/20">
                <Cloud className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold tracking-tight text-lg">BucketSpace</span>
            </div>
            <p className="text-xs text-stone-500 mb-8 leading-relaxed">
              A Telegram-backed personal storage workspace with client-side file encryption.
            </p>
            <div className="flex gap-4 mb-8">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-white transition"><Terminal className="w-4 h-4" /></div>
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-white transition"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg></div>
            </div>
            <div className="text-[10px] text-stone-600 uppercase tracking-wider">&copy; 2026 BucketSpace. All rights reserved.</div>
          </div>
          
          <div className="flex gap-12 lg:gap-20">
            <div className="flex flex-col gap-4 text-sm">
              <span className="font-medium mb-2 text-stone-200">Product</span>
              <a href="#features" className="text-stone-500 hover:text-stone-300">Features</a>
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <span className="font-medium mb-2 text-stone-200">Legal</span>
              <Link href="/privacy" className="text-stone-500 hover:text-stone-300">Privacy Policy</Link>
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <span className="font-medium mb-2 text-stone-200">Project</span>
              <a href="https://github.com/vanrajsinh650/BucketSpace" target="_blank" rel="noreferrer" className="text-stone-500 hover:text-stone-300">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Modal Overlay (Kept from original) ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
          <div className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-stone-500 hover:text-white"
              aria-label="Close Telegram sign-in"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-6 flex flex-col items-center">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 mb-4">
                <Cloud className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold">Connect to Telegram</h3>
              <p className="text-stone-400 text-sm mt-1 text-center">
                Sign in with your Telegram phone number to connect storage.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {step === 'phone' && (
              <form onSubmit={handleTelegramPhone} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">Phone Number</label>
                  <PhoneInputWithCountry value={phone} onChange={setPhone} />
                  <p className="text-[11px] text-stone-500">
                    Include the country code (for example, +1).
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={!phone || isSubmitting}
                  className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Code'}
                </button>
              </form>
            )}

            {step === 'code' && (
              <form onSubmit={handleTelegramCode} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">Verification Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-lg tracking-widest text-white focus:outline-none focus:border-white/30"
                    placeholder="12345"
                    autoFocus
                  />
                  <p className="text-xs text-stone-500">
                    We sent a code to your Telegram app.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!code || isSubmitting}
                  className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Code'}
                </button>
              </form>
            )}

            {step === '2fa' && (
              <form onSubmit={handleTelegram2FA} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-300">Two-Step Verification Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                    <input
                      type="password"
                      value={password2FA}
                      onChange={(e) => setPassword2FA(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-white/30"
                      placeholder="Enter your 2FA password"
                      autoFocus
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!password2FA || isSubmitting}
                  className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-stone-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Sign In'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Icon Components
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
}
function FolderIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>;
}
function FileDesignIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><circle cx="10" cy="13" r="2"/><path d="M10 17v-8"/></svg>;
}
function FilePdfIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12v6"/><path d="M10 15h2"/><path d="M14 12v6"/><path d="M14 12h2a2 2 0 0 1 0 4h-2"/></svg>;
}
function ImageIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
}
function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>;
}
function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
}
function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
