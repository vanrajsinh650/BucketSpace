'use client';

import React, { useState } from 'react';
import { Plus, Sliders, Trash2, X } from 'lucide-react';
import {
  ConditionField,
  ConditionOperator,
  RuleCondition,
  StorageRule,
} from '@bucketspace/shared';

interface RuleEditorProps {
  rule?: StorageRule | null;
  availableProviders: string[];
  onSave: (rule: StorageRule) => void;
  onClose: () => void;
}

export function RuleEditor({ rule, availableProviders, onSave, onClose }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 10);
  const [targetProviderId, setTargetProviderId] = useState(
    rule?.action.providerId ?? availableProviders[0] ?? 'local-disk'
  );
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions ?? [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }]
  );

  const handleAddCondition = () => {
    setConditions((prev) => [...prev, { field: 'mimeType', operator: 'startsWith', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    key: keyof RuleCondition,
    val: string
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter a rule name');
    if (conditions.length === 0) return alert('Please add at least one condition');

    const updatedRule: StorageRule = {
      id: rule?.id ?? `rule-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      priority: Number(priority) || 0,
      enabled: rule?.enabled ?? true,
      conditions,
      action: { type: 'STORE', providerId: targetProviderId },
      createdAt: rule?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    onSave(updatedRule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-700/80"
        style={{ backgroundColor: '#0d1117' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">
                {rule ? 'Edit Storage Rule' : 'Create Storage Rule'}
              </h3>
              <p className="text-xs text-slate-400">Deterministic routing condition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Rule Name & Priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 font-medium block mb-1">Rule Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Photos to Telegram"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                placeholder="10"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Target Provider Selection */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Target Storage Provider</label>
            <select
              value={targetProviderId}
              onChange={(e) => setTargetProviderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            >
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Conditions List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-medium">Conditions (AND logic)</label>
              <button
                type="button"
                onClick={handleAddCondition}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Condition
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {conditions.map((cond, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 border border-slate-800"
                >
                  <select
                    value={cond.field}
                    onChange={(e) =>
                      handleConditionChange(index, 'field', e.target.value as ConditionField)
                    }
                    className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                  >
                    <option value="mimeType">MIME Type</option>
                    <option value="extension">Extension</option>
                    <option value="size">Size (bytes)</option>
                  </select>

                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      handleConditionChange(index, 'operator', e.target.value as ConditionOperator)
                    }
                    className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                  >
                    {cond.field === 'size' ? (
                      <>
                        <option value="gt">greater than (&gt;)</option>
                        <option value="gte">greater/equal (&ge;)</option>
                        <option value="lt">less than (&lt;)</option>
                        <option value="lte">less/equal (&le;)</option>
                      </>
                    ) : (
                      <>
                        <option value="startsWith">starts with</option>
                        <option value="equals">equals</option>
                        <option value="endsWith">ends with</option>
                        <option value="contains">contains</option>
                      </>
                    )}
                  </select>

                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                    placeholder={cond.field === 'size' ? '1073741824 (1GB)' : 'image/'}
                    className="flex-1 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    className="p-1 rounded text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20"
            >
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
