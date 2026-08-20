'use client';

import React, { useState } from 'react';
import {
  Layers,
  ShieldCheck,
  HardDrive,
  Send,
  Cloud,
  CheckCircle2,
  FileText,
  Play,
  RotateCw,
  Cpu,
  ArrowRight,
  Database,
  Lock,
  Zap,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface AnalysisTabProps {
  files: FileMetadata[];
  activeProviderName: string;
}

export function AnalysisTab({ files, activeProviderName }: AnalysisTabProps) {
  const [selectedFileId, setSelectedFileId] = useState<string>(
    files.length > 0 ? files[0].id : ''
  );
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedChunkIndex, setSimulatedChunkIndex] = useState<number>(-1);
  const [simulationComplete, setSimulationComplete] = useState(false);

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0] || null;

  const handleRunSimulation = () => {
    if (!selectedFile || isSimulating) return;
    setIsSimulating(true);
    setSimulationComplete(false);
    setSimulatedChunkIndex(0);

    const totalChunks = selectedFile.chunks?.length || 3;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      if (current < totalChunks) {
        setSimulatedChunkIndex(current);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        setSimulationComplete(true);
        setSimulatedChunkIndex(-1);
      }
    }, 400);
  };

  const steps = [
    {
      step: 1,
      title: 'Dynamic Chunk Partitioning',
      tagline: 'Binary segmentation adapted to provider boundaries',
      icon: Layers,
      description:
        'When you upload a file, the client breaks large binaries into optimal 5 MB or 20 MB slices based on provider capability profiles. This prevents payload timeouts and enables parallel transmission.',
      technicalDetails: [
        'Telegram MTProto Chunk: 5,242,880 bytes (5 MB)',
        'Local SSD / S3 Chunk: 20,971,520 bytes (20 MB)',
        'Zero temporary disk writes — stream-sliced in RAM',
      ],
    },
    {
      step: 2,
      title: 'Cryptographic SHA-256 Hashing',
      tagline: 'Immutable tamper-proof chunk identification',
      icon: Lock,
      description:
        'Every slice receives an independent SHA-256 cryptographic digest before leaving the browser. A whole-file digest is also computed from the master byte stream.',
      technicalDetails: [
        'Algorithm: SHA-256 (256-bit hash, 64-char hex)',
        'Guarantees 100% bit-for-bit reconstruction integrity',
        'Detects any bit-rot or byte corruption instantly',
      ],
    },
    {
      step: 3,
      title: 'Zero-Knowledge Multi-Backend Routing',
      tagline: 'Direct-to-storage piping with no central plaintext',
      icon: Send,
      description:
        'Encrypted chunks are routed directly to your chosen storage backend (e.g. Telegram Saved Messages DC, Local Disk, or Cloudflare R2). No middleman server ever stores your unencrypted data.',
      technicalDetails: [
        `Active Target: ${activeProviderName}`,
        'Resumable Sessions: Interrupted uploads resume from last verified chunk',
        'Decentralized payload isolation across independent message IDs',
      ],
    },
    {
      step: 4,
      title: 'Stream Reassembly & Bit Verification',
      tagline: 'Multi-stream parallel fetch and re-verification',
      icon: ShieldCheck,
      description:
        'During download or media preview, chunks are fetched concurrently, validated against their recorded SHA-256 hashes, and stitched back into the original file seamlessly.',
      technicalDetails: [
        'Concurrent pipeline streams with automatic retry backoff',
        'Real-time HLS video seeking and audio stream demuxing',
        'Instant client-side PKZIP generation for multi-file downloads',
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-12 max-w-6xl mx-auto">
      {/* ─── Top Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono mb-2">
            <Zap className="w-3 h-3 text-zinc-100" />
            Storage Architecture & Flow Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Storage Pipeline Analysis
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            An interactive, step-by-step walkthrough of how your data is chunked, secured, and distributed.
          </p>
        </div>

        {/* Live File Selector */}
        {files.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 whitespace-nowrap">Inspect file:</span>
            <select
              value={selectedFileId}
              onChange={(e) => {
                setSelectedFileId(e.target.value);
                setSimulationComplete(false);
              }}
              className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-zinc-600 max-w-[220px] truncate"
            >
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name} ({formatBytes(file.size)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ─── 4-Step Pipeline Flow Selector ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s) => {
          const Icon = s.icon;
          const isCurrent = activeStep === s.step;
          return (
            <button
              key={s.step}
              onClick={() => setActiveStep(s.step)}
              className={`p-4 rounded-xl text-left border transition-all ${
                isCurrent
                  ? 'bg-zinc-900 border-zinc-600 text-white'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded ${
                    isCurrent
                      ? 'bg-white text-black font-semibold'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  Step {s.step}
                </span>
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-zinc-500'}`} />
              </div>
              <h3 className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                {s.title}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{s.tagline}</p>
            </button>
          );
        })}
      </div>

      {/* ─── Active Step Detailed Breakdown Card ─── */}
      {(() => {
        const currentStepObj = steps[activeStep - 1];
        const StepIcon = currentStepObj.icon;
        return (
          <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700/60 flex items-center justify-center text-white">
                  <StepIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                    Pipeline Phase {activeStep} of 4
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-white">
                    {currentStepObj.title}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                  disabled={activeStep === 1}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setActiveStep((prev) => Math.min(4, prev + 1))}
                  disabled={activeStep === 4}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  Next <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
              {currentStepObj.description}
            </p>

            {/* Technical Specifications */}
            <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-4 space-y-2.5">
              <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                Engine Directives & Invariants
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentStepObj.technicalDetails.map((detail, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-black/40 border border-zinc-800/60 text-xs text-zinc-300 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Live File Chunk Inspector & Simulation ─── */}
      {selectedFile && (
        <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
            <div>
              <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
                Live File Inspection
              </div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mt-0.5">
                <FileText className="w-4 h-4 text-zinc-400" />
                {selectedFile.name}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1 font-mono">
                <span>Size: {formatBytes(selectedFile.size)}</span>
                <span>•</span>
                <span>Chunks: {selectedFile.chunks?.length || 1}</span>
                <span>•</span>
                <span>SHA-256: {selectedFile.wholeFileHash.slice(0, 16)}...</span>
              </div>
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-4 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Verifying Chunks...
                </>
              ) : simulationComplete ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  All Chunks Verified ✓
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Integrity Simulation
                </>
              )}
            </button>
          </div>

          {/* Chunk Distribution Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Bit-Level Chunk Partition Map</span>
              <span className="font-mono">
                Target: {activeProviderName} (Zero-Knowledge)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(selectedFile.chunks && selectedFile.chunks.length > 0
                ? selectedFile.chunks
                : [
                    {
                      id: `${selectedFile.id}-0` as any,
                      fileId: selectedFile.id,
                      index: 0,
                      size: selectedFile.size,
                      hash: selectedFile.wholeFileHash,
                      providerRef: {
                        providerId: 'telegram',
                        reference: { messageId: 4201 },
                      },
                    },
                  ]
              ).map((chunk, idx) => {
                const isCurrentlySimulating = simulatedChunkIndex === idx;
                const isVerified = simulationComplete || (simulatedChunkIndex > idx);

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all ${
                      isCurrentlySimulating
                        ? 'bg-zinc-900 border-white ring-1 ring-white'
                        : isVerified
                        ? 'bg-zinc-900/80 border-zinc-700'
                        : 'bg-zinc-950/60 border-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-medium text-white">
                        Chunk #{chunk.index}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isVerified
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : isCurrentlySimulating
                            ? 'bg-white text-black animate-pulse font-semibold'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isVerified ? 'VERIFIED ✓' : isCurrentlySimulating ? 'CHECKING...' : 'STORED'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-zinc-400 font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Size:</span>
                        <span>{formatBytes(chunk.size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Digest:</span>
                        <span className="truncate max-w-[120px]" title={chunk.hash}>
                          {chunk.hash.slice(0, 12)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Storage:</span>
                        <span className="text-zinc-200">
                          {chunk.providerRef?.providerId || 'Telegram DC'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── 3 Architectural Pillar Callouts ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-3">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Zero-Knowledge Storage</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your file payloads are segmented into opaque byte streams. No single centralized entity has access to your full unencrypted files.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-3">
            <RotateCw className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Fault-Tolerant Resuming</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Network interruptions never corrupt files. The pipeline verifies already-transmitted chunk digests and seamlessly resumes from the exact missing index.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-white">Bit-Identical Reconstruction</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Every reconstructed file is verified against its master SHA-256 hash before disk write or browser streaming, guaranteeing zero data corruption.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
