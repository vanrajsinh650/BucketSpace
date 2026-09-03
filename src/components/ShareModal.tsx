'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, ShieldCheck } from 'lucide-react';
import { FileMetadata } from '@/shared';
import { StorageStore } from '../lib/storage-store';

interface ShareModalProps {
  file: FileMetadata | null;
  onClose: () => void;
}

export function ShareModal({ file, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('24h');
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (!file) return;
    const store = StorageStore.getInstance();
    const hours =
      expiresIn === '1h'
        ? 1
        : expiresIn === '24h'
        ? 24
        : expiresIn === '7d'
        ? 24 * 7
        : undefined; // undefined = Never / Unlimited duration
    const share = store.createShareLink(file.id, { expiresInHours: hours });
    setShareUrl(share.url);
  }, [file, expiresIn]);

  if (!file) return null;

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-zinc-300" />
            <h2 id="share-modal-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              Share File
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-[#161616] border border-[#262626] rounded-xl space-y-1">
            <div className="text-[11px] text-zinc-500 font-medium">Shared item</div>
            <div className="text-zinc-100 font-medium truncate text-xs">{file.name}</div>
          </div>

          {/* Expiration Select */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block font-medium">
              Link expiration
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '1 hour', value: '1h' },
                { label: '24 hours', value: '24h' },
                { label: '7 days', value: '7d' },
                { label: 'Never', value: 'Never' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setExpiresIn(opt.value)}
                  className={`py-2 rounded-xl text-xs transition-colors min-h-[40px] font-medium ${
                    expiresIn === opt.value
                      ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                      : 'bg-[#161616] border border-[#262626] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generated Share URL */}
          <div className="space-y-2">
            <label htmlFor="share-link-input" className="text-xs text-zinc-400 block font-medium">
              Share link
            </label>
            <div className="flex items-center gap-2 bg-[#161616] border border-[#262626] rounded-xl p-2.5">
              <input
                id="share-link-input"
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-zinc-200 text-xs flex-1 focus:outline-none truncate px-1"
              />
              <button
                type="button"
                onClick={copyToClipboard}
                className="bg-white text-zinc-950 hover:bg-zinc-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 min-h-[36px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-zinc-500 flex items-center gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500/80 shrink-0" />
            <span>Recipients download directly from encrypted cloud chunks.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors min-h-[40px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
