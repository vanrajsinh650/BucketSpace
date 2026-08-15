'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface CountryInfo {
  name: string;
  code: string; // ISO 2-letter
  dial: string; // e.g. "+91"
  flag: string; // Flag emoji
}

export const COUNTRIES: CountryInfo[] = [
  { name: 'India', code: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'United States', code: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'Canada', code: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Germany', code: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'France', code: 'FR', dial: '+33', flag: '🇫🇷' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966', flag: '🇸🇦' },
  { name: 'Singapore', code: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'Japan', code: 'JP', dial: '+81', flag: '🇯🇵' },
  { name: 'China', code: 'CN', dial: '+86', flag: '🇨🇳' },
  { name: 'South Korea', code: 'KR', dial: '+82', flag: '🇰🇷' },
  { name: 'Brazil', code: 'BR', dial: '+55', flag: '🇧🇷' },
  { name: 'Russia', code: 'RU', dial: '+7', flag: '🇷🇺' },
  { name: 'Turkey', code: 'TR', dial: '+90', flag: '🇹🇷' },
  { name: 'Spain', code: 'ES', dial: '+34', flag: '🇪🇸' },
  { name: 'Italy', code: 'IT', dial: '+39', flag: '🇮🇹' },
  { name: 'Netherlands', code: 'NL', dial: '+31', flag: '🇳🇱' },
  { name: 'Switzerland', code: 'CH', dial: '+41', flag: '🇨🇭' },
  { name: 'Sweden', code: 'SE', dial: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', dial: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: 'DK', dial: '+45', flag: '🇩🇰' },
  { name: 'Finland', code: 'FI', dial: '+358', flag: '🇫🇮' },
  { name: 'Poland', code: 'PL', dial: '+48', flag: '🇵🇱' },
  { name: 'Austria', code: 'AT', dial: '+43', flag: '🇦🇹' },
  { name: 'Belgium', code: 'BE', dial: '+32', flag: '🇧🇪' },
  { name: 'Ireland', code: 'IE', dial: '+353', flag: '🇮🇪' },
  { name: 'Portugal', code: 'PT', dial: '+351', flag: '🇵🇹' },
  { name: 'Greece', code: 'GR', dial: '+30', flag: '🇬🇷' },
  { name: 'New Zealand', code: 'NZ', dial: '+64', flag: '🇳🇿' },
  { name: 'South Africa', code: 'ZA', dial: '+27', flag: '🇿🇦' },
  { name: 'Egypt', code: 'EG', dial: '+20', flag: '🇪🇬' },
  { name: 'Nigeria', code: 'NG', dial: '+234', flag: '🇳🇬' },
  { name: 'Kenya', code: 'KE', dial: '+254', flag: '🇰🇪' },
  { name: 'Pakistan', code: 'PK', dial: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: 'BD', dial: '+880', flag: '🇧🇩' },
  { name: 'Indonesia', code: 'ID', dial: '+62', flag: '🇮🇩' },
  { name: 'Malaysia', code: 'MY', dial: '+60', flag: '🇲🇾' },
  { name: 'Philippines', code: 'PH', dial: '+63', flag: '🇵🇭' },
  { name: 'Thailand', code: 'TH', dial: '+66', flag: '🇹🇭' },
  { name: 'Vietnam', code: 'VN', dial: '+84', flag: '🇻🇳' },
  { name: 'Mexico', code: 'MX', dial: '+52', flag: '🇲🇽' },
  { name: 'Argentina', code: 'AR', dial: '+54', flag: '🇦🇷' },
  { name: 'Colombia', code: 'CO', dial: '+57', flag: '🇨🇴' },
  { name: 'Chile', code: 'CL', dial: '+56', flag: '🇨🇱' },
  { name: 'Ukraine', code: 'UA', dial: '+380', flag: '🇺🇦' },
  { name: 'Israel', code: 'IL', dial: '+972', flag: '🇮🇱' },
  { name: 'Qatar', code: 'QA', dial: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', code: 'KW', dial: '+965', flag: '🇰🇼' },
  { name: 'Oman', code: 'OM', dial: '+968', flag: '🇴🇲' },
  { name: 'Bahrain', code: 'BH', dial: '+973', flag: '🇧🇭' },
  { name: 'Czech Republic', code: 'CZ', dial: '+420', flag: '🇨🇿' },
  { name: 'Romania', code: 'RO', dial: '+40', flag: '🇷🇴' },
  { name: 'Hungary', code: 'HU', dial: '+36', flag: '🇭🇺' },
  { name: 'Sri Lanka', code: 'LK', dial: '+94', flag: '🇱🇰' },
  { name: 'Nepal', code: 'NP', dial: '+977', flag: '🇳🇵' },
];

interface PhoneInputWithCountryProps {
  value: string; // Full formatted or raw number e.g. "+919876543210"
  onChange: (fullNumber: string) => void;
  label?: string;
  autoFocus?: boolean;
}

export function PhoneInputWithCountry({
  value,
  onChange,
  label = 'Phone number',
  autoFocus = true,
}: PhoneInputWithCountryProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(COUNTRIES[0]); // Default to India (+91)
  const [nationalNumber, setNationalNumber] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Parse incoming value on mount or change if it starts with '+'
  useEffect(() => {
    if (!value) return;

    if (value.startsWith('+')) {
      // Find matching country by dial code (sort by longest dial code first to match +358 before +3)
      const sortedCountries = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
      const match = sortedCountries.find((c) => value.startsWith(c.dial));

      if (match) {
        setSelectedCountry(match);
        const rest = value.slice(match.dial.length).trim();
        setNationalNumber(rest);
        return;
      }
    }

    setNationalNumber(value);
  }, []);

  // Filter countries by name or dial code
  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setDropdownOpen(false);
    setSearchQuery('');

    // Emit combined full phone number
    const cleanNational = nationalNumber.replace(/\D/g, '');
    const combined = cleanNational ? `${country.dial}${cleanNational}` : country.dial;
    onChange(combined);

    setTimeout(() => phoneInputRef.current?.focus(), 50);
  };

  const handleNumberChange = (raw: string) => {
    // If user pasted a full number with leading '+'
    if (raw.startsWith('+')) {
      const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
      const match = sorted.find((c) => raw.startsWith(c.dial));
      if (match) {
        setSelectedCountry(match);
        const rest = raw.slice(match.dial.length).replace(/\D/g, '');
        setNationalNumber(rest);
        onChange(`${match.dial}${rest}`);
        return;
      }
    }

    // Keep only digits and spaces for display
    const cleanedDigits = raw.replace(/\D/g, '');
    setNationalNumber(cleanedDigits);

    const combined = cleanedDigits ? `${selectedCountry.dial}${cleanedDigits}` : '';
    onChange(combined);
  };

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <label className="block text-sm text-slate-300 font-medium">{label}</label>

      <div className="relative flex items-center">
        {/* Country Selector Trigger */}
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-3 rounded-l-xl bg-slate-800/90 border border-r-0 border-slate-700
                     hover:bg-slate-800 hover:border-slate-600 text-slate-200 transition-colors shrink-0"
        >
          <span className="text-lg leading-none">{selectedCountry.flag}</span>
          <span className="font-mono text-sm font-semibold text-white">{selectedCountry.dial}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* National Number Input */}
        <input
          ref={phoneInputRef}
          type="tel"
          value={nationalNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder="98765 43210"
          autoFocus={autoFocus}
          className="w-full bg-slate-900 border border-slate-700 rounded-r-xl px-4 py-3
                     text-white placeholder:text-slate-500 font-mono text-base tracking-wide
                     focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
        />

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 max-h-80 rounded-2xl bg-[#0f172a] border border-slate-700/80
                          shadow-2xl z-50 flex flex-col overflow-hidden backdrop-blur-xl animate-fadeIn">
            {/* Search Box */}
            <div className="p-2.5 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Country List */}
            <div className="overflow-y-auto max-h-64 p-1.5 space-y-0.5 custom-scrollbar">
              {filteredCountries.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 font-mono">
                  No matching countries
                </div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = country.code === selectedCountry.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                          : 'hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-base">{country.flag}</span>
                        <span className="truncate">{country.name}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-400 font-semibold shrink-0 ml-2">
                        {country.dial}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper text with formatted preview */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Includes international country code</span>
        {nationalNumber && (
          <span className="font-mono text-cyan-400/90 font-medium">
            {selectedCountry.dial} {nationalNumber}
          </span>
        )}
      </div>
    </div>
  );
}
