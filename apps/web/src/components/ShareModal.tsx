'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Shield } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';
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
    const hours = expiresIn === '1h' ? 1 : expiresIn === '24h' ? 24 : 24 * 7;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md flex flex-col overflow-hidden shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <Share2 className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">
              Create Share Link
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <div className="text-[10px] text-[#666] uppercase">File</div>
            <div className="text-white font-medium truncate">{file.name}</div>
          </div>

          {/* Expiration Select */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#666] uppercase block">
              Link Expiration
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {['1h', '24h', '7d'].map((time) => (
                <button
                  key={time}
                  onClick={() => setExpiresIn(time)}
                  className={`py-1.5 rounded border text-xs font-mono uppercase transition-colors btn-press ${
                    expiresIn === time
                      ? 'border-white bg-[#1a1a1a] text-white font-bold'
                      : 'border-[#1e1e1e] bg-[#121212] text-[#888] hover:text-white'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* Generated Share URL */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-[#666] uppercase block">
              Public Secure URL
            </label>
            <div className="flex items-center gap-2 bg-[#121212] border border-[#1e1e1e] rounded p-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-white text-xs font-mono flex-1 focus:outline-none truncate"
              />
              <button
                onClick={copyToClipboard}
                className="bg-white text-black hover:bg-[#e0e0e0] px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors btn-press shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] text-[#555] flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-[#666]" />
            <span>Recipients stream directly from encrypted chunks.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-end">
          <button
            onClick={onClose}
            className="border border-[#333] hover:border-white text-white px-4 py-1.5 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
