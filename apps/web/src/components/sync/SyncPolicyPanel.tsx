'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, Shield, Layers, Plus, CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react';
import { ProviderType } from '@bucketspace/shared';

export interface SyncPolicyPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface SyncPolicyItem {
  id: string;
  name: string;
  sourceBucket: string;
  sourceProvider: ProviderType;
  destBucket: string;
  destProvider: ProviderType;
  scheduleCron?: string;
  conflictStrategy: string;
  enabled: boolean;
  lastJob?: {
    status: 'COMPLETED' | 'RUNNING' | 'FAILED' | 'PENDING';
    itemsSynced: number;
    itemsTotal: number;
    bytesTransferred: string;
  };
}

const MOCK_POLICIES: SyncPolicyItem[] = [
  {
    id: 'policy-001',
    name: 'Telegram Drive -> GCP Production Backup',
    sourceBucket: '@studio_asset_vault',
    sourceProvider: ProviderType.TELEGRAM_DRIVE,
    destBucket: 'bucketspace-gcp-prod',
    destProvider: ProviderType.GCP_STORAGE,
    scheduleCron: 'Every 6 hours',
    conflictStrategy: 'LWW',
    enabled: true,
    lastJob: {
      status: 'COMPLETED',
      itemsSynced: 14,
      itemsTotal: 14,
      bytesTransferred: '590.4 MB',
    },
  },
  {
    id: 'policy-002',
    name: 'GCP Analytics -> Azure Blob Archive',
    sourceBucket: 'bucketspace-gcp-prod',
    sourceProvider: ProviderType.GCP_STORAGE,
    destBucket: 'bucketspace-azure-container',
    destProvider: ProviderType.AZURE_BLOB,
    scheduleCron: 'Daily at 00:00 UTC',
    conflictStrategy: 'SKIP',
    enabled: true,
    lastJob: {
      status: 'COMPLETED',
      itemsSynced: 8,
      itemsTotal: 8,
      bytesTransferred: '1.2 GB',
    },
  },
];

export const SyncPolicyPanel: React.FC<SyncPolicyPanelProps> = ({ isOpen, onClose }) => {
  const [policies, setPolicies] = useState<SyncPolicyItem[]>(MOCK_POLICIES);
  const [isTriggering, setIsTriggering] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New policy state
  const [policyName, setPolicyName] = useState('');
  const [sourceProvider, setSourceProvider] = useState<ProviderType>(ProviderType.TELEGRAM_DRIVE);
  const [destProvider, setDestProvider] = useState<ProviderType>(ProviderType.GCP_STORAGE);

  const handleTriggerSync = (policyId: string) => {
    setIsTriggering(policyId);
    setTimeout(() => {
      setPolicies((prev) =>
        prev.map((p) =>
          p.id === policyId
            ? {
                ...p,
                lastJob: {
                  status: 'COMPLETED',
                  itemsSynced: (p.lastJob?.itemsTotal || 10),
                  itemsTotal: (p.lastJob?.itemsTotal || 10),
                  bytesTransferred: '650.0 MB',
                },
              }
            : p
        )
      );
      setIsTriggering(null);
    }, 1500);
  };

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName.trim()) return;

    const newPolicy: SyncPolicyItem = {
      id: `policy-${Date.now()}`,
      name: policyName,
      sourceBucket: `${sourceProvider.toLowerCase()}-source-bucket`,
      sourceProvider,
      destBucket: `${destProvider.toLowerCase()}-target-bucket`,
      destProvider,
      conflictStrategy: 'LWW',
      enabled: true,
      lastJob: {
        status: 'PENDING',
        itemsSynced: 0,
        itemsTotal: 0,
        bytesTransferred: '0 B',
      },
    };

    setPolicies([newPolicy, ...policies]);
    setPolicyName('');
    setShowCreateModal(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-full max-h-[92vh] rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl overflow-hidden flex flex-col glass-panel">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Cross-Cloud Bucket Sync Engine</h2>
              <p className="text-xs text-slate-400">Automated multi-cloud chunk replication & backup policies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Transactional Chunk Synchronization
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Sync Policy
          </button>
        </div>

        {/* Policy Cards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-950/40 flex flex-col space-y-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{policy.name}</h3>
                  <span className="text-xs text-slate-400 mt-0.5 inline-block">
                    Strategy: <span className="font-mono text-indigo-300">{policy.conflictStrategy} (Last-Write-Wins)</span>
                  </span>
                </div>

                <button
                  onClick={() => handleTriggerSync(policy.id)}
                  disabled={isTriggering === policy.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium rounded-xl text-xs transition-colors active:scale-95 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isTriggering === policy.id ? 'animate-spin' : ''}`} />
                  <span>{isTriggering === policy.id ? 'Syncing...' : 'Trigger Sync'}</span>
                </button>
              </div>

              {/* Source -> Destination Visual Flow */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Source Bucket</span>
                  <span className="font-semibold text-slate-200">{policy.sourceBucket}</span>
                  <span className="text-[10px] text-indigo-400 font-mono">{policy.sourceProvider}</span>
                </div>

                <ArrowRight className="w-5 h-5 text-slate-600" />

                <div className="flex flex-col text-right">
                  <span className="text-[10px] text-slate-500 font-mono">Target Destination</span>
                  <span className="font-semibold text-slate-200">{policy.destBucket}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{policy.destProvider}</span>
                </div>
              </div>

              {/* Job Progress */}
              {policy.lastJob && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    {policy.lastJob.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    )}
                    <span>
                      {policy.lastJob.itemsSynced}/{policy.lastJob.itemsTotal} Files Synced ({policy.lastJob.bytesTransferred})
                    </span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                    {policy.lastJob.status}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create Modal Overlay */}
        {showCreateModal && (
          <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col justify-center animate-in fade-in">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-100">Create Cross-Cloud Replication Policy</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Policy Name</label>
                  <input
                    type="text"
                    required
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
                    placeholder="e.g. Telegram -> AWS S3 Daily Mirror"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Source Provider</label>
                    <select
                      value={sourceProvider}
                      onChange={(e) => setSourceProvider(e.target.value as ProviderType)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={ProviderType.TELEGRAM_DRIVE}>Telegram Drive</option>
                      <option value={ProviderType.GCP_STORAGE}>GCP Storage</option>
                      <option value={ProviderType.AZURE_BLOB}>Azure Blob</option>
                      <option value={ProviderType.AWS_S3}>AWS S3 / R2</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Destination Provider</label>
                    <select
                      value={destProvider}
                      onChange={(e) => setDestProvider(e.target.value as ProviderType)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={ProviderType.GCP_STORAGE}>GCP Storage</option>
                      <option value={ProviderType.AZURE_BLOB}>Azure Blob</option>
                      <option value={ProviderType.AWS_S3}>AWS S3 / R2</option>
                      <option value={ProviderType.TELEGRAM_DRIVE}>Telegram Drive</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/30"
                  >
                    Save & Enable Policy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
