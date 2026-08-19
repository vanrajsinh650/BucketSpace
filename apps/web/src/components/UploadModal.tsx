'use client';

import React, { useRef, useState } from 'react';
import { CheckCircle2, CloudUpload, HardDrive, X } from 'lucide-react';
import { UploadProgressState } from '../lib/storage-store';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: (file: File) => Promise<void>;
  uploadState: UploadProgressState | null;
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadFile,
  uploadState,
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="glass-modal w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-6 relative border border-slate-700/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Upload File to BucketSpace</h3>
              <p className="text-xs text-slate-400">Stream chunked & SHA-256 byte verified</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!uploadState || uploadState.status === 'COMPLETE' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-800 hover:border-slate-600 bg-slate-900/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <CloudUpload className="w-12 h-12 text-cyan-400 mx-auto mb-4 animate-bounce" />
            <p className="text-sm font-medium text-slate-200">
              Drag and drop your file here, or <span className="text-cyan-400 underline">browse</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Files are dynamically chunked according to provider capabilities, hashed with SHA-256, and verified at rest.
            </p>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200 truncate max-w-[240px]">
                {uploadState.fileName}
              </span>
              <span className="font-mono text-xs text-cyan-400 font-semibold">
                {uploadState.percent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full transition-all duration-300 shadow-md shadow-cyan-500/50"
                style={{ width: `${uploadState.percent}%` }}
              />
            </div>

            {/* Status & Details */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                {uploadState.status === 'RESUMING' ? (
                  <span className="text-cyan-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    Resuming upload...
                  </span>
                ) : uploadState.status === 'FAILED' ? (
                  <span className="text-rose-400 font-medium">Upload interrupted</span>
                ) : (
                  <span className="capitalize text-slate-300 font-mono">
                    Status: {uploadState.status.toLowerCase()}
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-400">
                Chunk {uploadState.currentChunk} of {uploadState.totalChunks}
              </span>
            </div>

            {uploadState.status === 'FAILED' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <p>{uploadState.errorMessage || 'Network interrupted. Your uploaded chunks are safely preserved.'}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-medium text-xs transition-colors"
                >
                  Select File to Resume Upload
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
