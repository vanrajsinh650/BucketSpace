'use client';

import React, { useState } from 'react';
import { Eye, Plus, Sliders, Trash2, X } from 'lucide-react';
import { StorageRule } from '@bucketspace/shared';
import { RuleEditor } from './RuleEditor';
import { RulePreview } from './RulePreview';

interface StorageRulesPanelProps {
  rules: StorageRule[];
  availableProviders: string[];
  defaultProviderId: string;
  onSaveRule: (rule: StorageRule) => void;
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  onDeleteRule: (ruleId: string) => void;
  onClose: () => void;
}

export function StorageRulesPanel({
  rules,
  availableProviders,
  defaultProviderId,
  onSaveRule,
  onToggleRule,
  onDeleteRule,
  onClose,
}: StorageRulesPanelProps) {
  const [editingRule, setEditingRule] = useState<StorageRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Sort rules by priority descending
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6 border border-slate-700/80"
        style={{ backgroundColor: '#0d1117' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Storage Policy Rules</h3>
              <p className="text-xs text-slate-400">
                Deterministic placement policy • Highest priority matches first
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> Test Rules
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rule
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {sortedRules.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No rules defined. Unmatched files fallback to default provider ({defaultProviderId}).
            </div>
          ) : (
            sortedRules.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  rule.enabled
                    ? 'bg-slate-900/70 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">{rule.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                      Priority {rule.priority}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      → {rule.action.providerId}
                    </span>
                  </div>

                  {/* Conditions Preview */}
                  <div className="text-xs text-slate-400 flex flex-wrap gap-2 pt-0.5">
                    {rule.conditions.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-[11px] font-mono text-slate-300"
                      >
                        {c.field} {c.operator} &quot;{c.value}&quot;
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => onToggleRule(rule.id, !rule.enabled)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-medium"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => onDeleteRule(rule.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Unmatched files fallback target:</span>
          <span className="font-mono text-cyan-400 font-semibold">{defaultProviderId}</span>
        </div>
      </div>

      {/* Editor Modal */}
      {(isCreating || editingRule) && (
        <RuleEditor
          rule={editingRule}
          availableProviders={availableProviders}
          onSave={(saved) => {
            onSaveRule(saved);
            setIsCreating(false);
            setEditingRule(null);
          }}
          onClose={() => {
            setIsCreating(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Tester / Preview Modal */}
      {isPreviewOpen && (
        <RulePreview
          rules={rules}
          defaultProviderId={defaultProviderId}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
