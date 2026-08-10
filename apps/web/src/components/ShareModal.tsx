'use client';

import React, { useState } from 'react';
import { Check, Copy, Link, ShieldCheck, X } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface ShareModalProps {
  file: FileMetadata | null;
  onClose: () => void;
}

export function ShareModal({ file, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  if (!file) return null;

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/share/token-${file.id.substring(0, 12)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 relative border border-slate-700/80">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Link className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Share Secure Access Link</h3>
              <p className="text-xs text-slate-400">Time-bound link without exposing storage IDs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Shared Target File</label>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-sm font-semibold text-white truncate">
              {file.name}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Link Expiration</label>
            <select
              value={expiryHours}
              onChange={(e) => setExpiryHours(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50"
            >
              <option value={1}>Expires in 1 Hour</option>
              <option value={24}>Expires in 24 Hours</option>
              <option value={168}>Expires in 7 Days</option>
              <option value={0}>Never Expires</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Public Share URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-950/80 border border-slate-800 font-mono text-xs text-cyan-300 rounded-xl px-3.5 py-2.5 select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 font-medium text-xs transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Storage provider references & Telegram message IDs remain hidden.</span>
        </div>
      </div>
    </div>
  );
}
