'use client';

import React, { useState } from 'react';
import { Plus, Sliders, Trash2, X, Eye } from 'lucide-react';
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

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">
              Storage Routing Rules
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
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666] uppercase">
              Routing Policies ({rules.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="border border-[#333] hover:border-white text-white px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors btn-press"
              >
                <Eye className="w-3 h-3" />
                <span>Test Rules</span>
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="bg-white text-black hover:bg-[#e0e0e0] px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors btn-press"
              >
                <Plus className="w-3 h-3" />
                <span>New Rule</span>
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2">
            {sortedRules.length === 0 ? (
              <div className="p-8 text-center border border-[#1e1e1e] rounded text-[#555]">
                No custom routing rules defined. Default provider is "{defaultProviderId}".
              </div>
            ) : (
              sortedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[#121212] border border-[#1e1e1e] p-3 rounded flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">{rule.name}</span>
                      <span className="text-[10px] text-[#555] uppercase">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#888] truncate">
                      Routes to <span className="text-white uppercase font-bold">{rule.action.providerId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleRule(rule.id, !rule.enabled)}
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold transition-colors ${
                        rule.enabled
                          ? 'bg-[#22c55e]/20 text-[#22c55e]'
                          : 'bg-[#333] text-[#888]'
                      }`}
                    >
                      {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                    </button>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="border border-[#333] hover:border-white text-white px-2 py-0.5 rounded text-[10px] uppercase transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="text-[#ff3333] p-1 rounded hover:bg-[#ff3333]/10 transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-end">
          <button
            onClick={onClose}
            className="border border-[#333] hover:border-white text-white px-4 py-1.5 rounded font-mono uppercase tracking-wider text-xs transition-colors btn-press"
          >
            Close
          </button>
        </div>

        {/* Rule Editor Modal */}
        {(isCreating || editingRule) && (
          <RuleEditor
            rule={editingRule}
            availableProviders={availableProviders}
            onSave={(rule) => {
              onSaveRule(rule);
              setIsCreating(false);
              setEditingRule(null);
            }}
            onClose={() => {
              setIsCreating(false);
              setEditingRule(null);
            }}
          />
        )}

        {/* Rule Preview Modal */}
        {isPreviewOpen && (
          <RulePreview
            rules={rules}
            defaultProviderId={defaultProviderId}
            onClose={() => setIsPreviewOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
