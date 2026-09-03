'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { UploadProgressState } from '../lib/storage-store';
import { humanizeError } from '../lib/humanize-error';

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
  const [dragActive, setDragActive] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const startUpload = (file: File) => {
    setLastFile(file);
    onUploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      startUpload(e.target.files[0]);
    }
  };

  const handleRetry = () => {
    if (lastFile) {
      startUpload(lastFile);
    }
  };

  // Humanize stage status
  const getStageLabel = () => {
    if (!uploadState) return '';
    if (uploadState.status === 'COMPLETE') return 'Finishing and verifying...';
    if (uploadState.status === 'FAILED') return 'Upload interrupted';
    if (uploadState.percent < 5) return 'Preparing and encrypting file...';
    if (uploadState.percent >= 98) return 'Finalizing in private vault...';
    return 'Uploading to private vault...';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-opacity font-sans"
    >
      <div className="w-full sm:max-w-lg bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl shadow-black text-zinc-100 animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <h2 id="upload-modal-title" className="text-sm font-semibold tracking-wide text-zinc-100">
            Upload File
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close upload dialog"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleChange}
            className="hidden"
            aria-label="Choose file to upload"
          />

          {!uploadState ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-10 text-center rounded-2xl cursor-pointer transition-colors ${
                dragActive
                  ? 'border-zinc-300 bg-zinc-800/40'
                  : 'border-zinc-700 hover:border-zinc-500 bg-[#161616]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-4 text-zinc-300">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-sm text-zinc-200 font-medium mb-1.5">
                Drop file here or click to browse
              </div>
              <div className="text-xs text-zinc-400">
                Client-side encrypted before transfer to your Telegram vault
              </div>
            </div>
          ) : (
            <div className="bg-[#161616] border border-[#262626] p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-100 font-medium truncate max-w-[280px]">
                  {uploadState.fileName}
                </span>
                <span className="text-sm font-semibold text-zinc-300 tabular-nums">
                  {uploadState.percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    uploadState.status === 'FAILED' ? 'bg-rose-500' : 'bg-white'
                  }`}
                  style={{ width: `${Math.max(3, uploadState.percent)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className={uploadState.status === 'FAILED' ? 'text-rose-400 font-medium' : 'text-zinc-300'}>
                  {getStageLabel()}
                </span>
                {uploadState.totalChunks > 1 && (
                  <span className="tabular-nums text-zinc-400">
                    Part {uploadState.currentChunk} of {uploadState.totalChunks}
                  </span>
                )}
              </div>

              {uploadState.status === 'FAILED' && (
                <div
                  role="alert"
                  className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-xs flex flex-col gap-3 mt-2"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {humanizeError(uploadState.errorMessage)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[36px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Upload
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors min-h-[36px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
