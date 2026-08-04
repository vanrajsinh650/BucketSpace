'use client';

import React, { useState } from 'react';
import { FileText, Image, Video, Music, HardDrive, Search, UploadCloud, CheckCircle2 } from 'lucide-react';

export interface DriveFileItem {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  telegramChannel: string;
  createdAt: string;
}

const MOCK_TELEGRAM_FILES: DriveFileItem[] = [
  {
    id: 'f1-telegram-001',
    filename: 'architectural_render_4k.png',
    sizeBytes: 15482910,
    mimeType: 'image/png',
    telegramChannel: '@studio_asset_vault',
    createdAt: '2026-08-04T10:00:00Z',
  },
  {
    id: 'f2-telegram-002',
    filename: 'cinematic_trailer_final.mp4',
    sizeBytes: 450920104,
    mimeType: 'video/mp4',
    telegramChannel: '@studio_asset_vault',
    createdAt: '2026-08-04T09:30:00Z',
  },
  {
    id: 'f3-telegram-003',
    filename: 'project_blueprint_specs.pdf',
    sizeBytes: 4210924,
    mimeType: 'application/pdf',
    telegramChannel: '@studio_asset_vault',
    createdAt: '2026-08-04T08:15:00Z',
  },
];

export const FileGrid: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const filteredFiles = MOCK_TELEGRAM_FILES.filter((file) =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-6 w-6 text-cyan-400" />;
    if (mimeType.startsWith('video/')) return <Video className="h-6 w-6 text-indigo-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="h-6 w-6 text-emerald-400" />;
    return <FileText className="h-6 w-6 text-slate-400" />;
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <HardDrive className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Telegram Cloud Drive</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Unlimited Storage Bucket | Connected: <span className="text-emerald-400 font-medium">@studio_asset_vault</span>
            </p>
          </div>
        </div>

        {/* Upload Trigger Button */}
        <button
          onClick={() => alert('Initiating Telegram Chunked Stream Upload Session...')}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-150 active:scale-95"
        >
          <UploadCloud className="h-5 w-5" />
          Upload Asset
        </button>
      </div>

      {/* Hybrid Search & Filter Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files by name or CLIP AI vector concept..."
          className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-150"
        />
      </div>

      {/* Interactive Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredFiles.map((file) => {
          const isSelected = selectedFileId === file.id;
          return (
            <div
              key={file.id}
              onClick={() => setSelectedFileId(file.id)}
              className={`group glass-panel p-4 rounded-xl cursor-pointer transition-all duration-150 relative ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/40'
                  : 'hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              {isSelected && (
                <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-indigo-400" />
              )}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  {getFileIcon(file.mimeType)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-semibold text-slate-200 group-hover:text-white" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    {formatFileSize(file.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
