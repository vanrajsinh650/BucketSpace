'use client';

import React, { useState } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
}

const COUNTRY_CODES = [
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
];

export function PhoneInputWithCountry({ value, onChange, label }: PhoneInputProps) {
  const [selectedCode, setSelectedCode] = useState('+1');

  const handleCodeChange = (newCode: string) => {
    const rawNumber = value.startsWith(selectedCode)
      ? value.slice(selectedCode.length).trim()
      : value.replace(/^\+\d+\s*/, '').trim();
    setSelectedCode(newCode);
    onChange(`${newCode} ${rawNumber}`.trim());
  };

  const currentLocalNumber = value.startsWith(selectedCode)
    ? value.slice(selectedCode.length).trim()
    : value.replace(/^\+\d+\s*/, '').trim();

  return (
    <div className="space-y-1.5 font-mono text-xs">
      {label && <label className="text-[10px] text-[#666] uppercase block">{label}</label>}
      <div className="flex items-center border border-[#1e1e1e] bg-[#0a0a0a] rounded focus-within:border-[#444] transition-colors">
        <select
          value={selectedCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="bg-transparent text-white px-2 py-2 text-xs font-mono focus:outline-none cursor-pointer border-r border-[#1e1e1e]"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={`${c.code}-${c.name}`} value={c.code} className="bg-black text-white">
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <input
          type="tel"
          placeholder="555 0199"
          value={currentLocalNumber}
          onChange={(e) => {
            const sanitized = e.target.value.replace(/[^\d\s-]/g, '');
            onChange(`${selectedCode} ${sanitized}`.trim());
          }}
          className="bg-transparent text-white px-3 py-2 text-xs font-mono flex-1 focus:outline-none placeholder-[#444]"
        />
      </div>
    </div>
  );
}
