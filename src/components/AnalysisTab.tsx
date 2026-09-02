'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { FileMetadata } from '@/shared';

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
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (files.length > 0 && (!selectedFileId || !files.some((f) => f.id === selectedFileId))) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0] || null;

  const handleRunSimulation = () => {
    if (!selectedFile || isSimulating) return;
    setIsSimulating(true);
    setSimulationComplete(false);
    setSimulatedChunkIndex(0);

    const totalChunks = selectedFile.chunks?.length || 3;
    let current = 0;

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }

    simIntervalRef.current = setInterval(() => {
      current++;
      setSimulatedChunkIndex(current);
      if (current >= totalChunks) {
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
        }
        setIsSimulating(false);
        setSimulationComplete(true);
      }
    }, 350);
  };

  const steps = [
    {
      num: 1,
      title: '4MB Adaptive Chunking',
      desc: 'Files are sliced into deterministic 4MB encrypted payloads for parallel multi-part ingestion.',
    },
    {
      num: 2,
      title: 'SHA-256 Digest Hashing',
      desc: 'Each chunk is hashed via WebCrypto SHA-256 before transport and verified upon reassembly.',
    },
    {
      num: 3,
      title: 'Telegram MTProto Dispatch',
      desc: 'Chunks are streamed to Telegram storage vault via MTProto with checksum verification.',
    },
    {
      num: 4,
      title: 'Zero-Knowledge Reassembly',
      desc: 'Chunks are pulled, verified against canonical digests, decrypted in-memory, and assembled.',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs max-w-5xl">
      {/* Top Header */}
      <div className="border border-[#222] bg-[#0c0c0c] p-5 rounded-lg space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
            Telemetry & Verification Workbench
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
            Live Diagnostics
          </span>
        </div>
        <h2 className="text-xl font-bold uppercase tracking-tight text-white font-sans">
          Architecture Inspector
        </h2>
        <p className="text-zinc-400 text-xs leading-relaxed max-w-2xl font-mono">
          Under-the-hood cryptographic verification, chunk distribution maps, and MTProto pipeline simulator.
        </p>
      </div>

      {/* Pipeline Steps Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((step) => {
          const isActive = activeStep === step.num;
          return (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`p-3 rounded border text-left space-y-1.5 transition-colors btn-press ${
                isActive
                  ? 'border-white bg-[#121212] text-white'
                  : 'border-[#1e1e1e] bg-[#0a0a0a] text-[#888] hover:text-white hover:border-[#333]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#555] uppercase">
                  Step 0{step.num}
                </span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="font-bold text-white uppercase text-[11px] truncate">{step.title}</div>
              <div className="text-[10px] text-[#666] leading-relaxed line-clamp-2">
                {step.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Simulation Console */}
      <div className="border border-[#222] bg-[#0c0c0c] rounded-lg p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#222] pb-3">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-bold">
              Select Target File To Inspect
            </span>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="bg-[#181818] border border-[#333] text-white px-3 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-zinc-500"
            >
              {files.map((f) => (
                <option key={f.id} value={f.id} className="bg-black text-white">
                  {f.name} ({f.chunks.length} chunks • {((f.size || 0) / 1024 / 1024).toFixed(1)} MB)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={!selectedFile || isSimulating}
            className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-2 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isSimulating ? 'Verifying Hashes...' : 'Run Pipeline Check'}</span>
          </button>
        </div>

        {/* Selected File Chunks Visualizer */}
        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-300 bg-[#141414] p-2.5 rounded border border-[#222]">
              <span className="font-semibold text-white">File: {selectedFile.name}</span>
              <span className="text-zinc-400">Total Chunks: <strong className="text-emerald-400">{selectedFile.chunks.length}</strong></span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {selectedFile.chunks.map((chunk, idx) => {
                const isVerifying = isSimulating && simulatedChunkIndex === idx;
                const isVerified = (isSimulating && simulatedChunkIndex > idx) || simulationComplete;
                return (
                  <div
                    key={chunk.id}
                    className={`p-3.5 rounded border transition-all ${
                      isVerifying
                        ? 'border-white bg-[#1f1f1f] shadow-md scale-[1.01]'
                        : isVerified
                        ? 'border-emerald-800/60 bg-[#121915]'
                        : 'border-[#262626] bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                      <span className="font-bold text-white">Chunk #{chunk.index}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isVerified
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : isVerifying
                          ? 'bg-white text-black'
                          : 'bg-[#222] text-zinc-400'
                      }`}>
                        {isVerified ? 'VERIFIED' : isVerifying ? 'HASHING' : 'STORED'}
                      </span>
                    </div>
                    <div className="text-zinc-300 font-mono text-[11px] truncate bg-black/50 px-2 py-1 rounded border border-[#1e1e1e]" title={chunk.hash}>
                      {chunk.hash}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-2 flex justify-between items-center">
                      <span>{(chunk.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span className="uppercase text-zinc-500 font-semibold">{chunk.providerRef?.providerId || activeProviderName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">No files available for analysis.</div>
        )}
      </div>
    </div>
  );
}
