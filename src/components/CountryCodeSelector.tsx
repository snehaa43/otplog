"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

export interface Country {
  name: string;
  dial_code: string;
  code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "India", dial_code: "+91", code: "IN", flag: "🇮🇳" },
  { name: "United States", dial_code: "+1", code: "US", flag: "🇺🇸" },
  { name: "United Kingdom", dial_code: "+44", code: "GB", flag: "🇬🇧" },
  { name: "Canada", dial_code: "+1", code: "CA", flag: "🇨🇦" },
  { name: "Australia", dial_code: "+61", code: "AU", flag: "🇦🇺" },
  { name: "Germany", dial_code: "+49", code: "DE", flag: "🇩🇪" },
  { name: "France", dial_code: "+33", code: "FR", flag: "🇫🇷" },
  { name: "Japan", dial_code: "+81", code: "JP", flag: "🇯🇵" },
  { name: "Singapore", dial_code: "+65", code: "SG", flag: "🇸🇬" },
  { name: "United Arab Emirates", dial_code: "+971", code: "AE", flag: "🇦🇪" },
  { name: "Brazil", dial_code: "+55", code: "BR", flag: "🇧🇷" },
  { name: "South Africa", dial_code: "+27", code: "ZA", flag: "🇿🇦" },
];

interface CountryCodeSelectorProps {
  selected: Country;
  onSelect: (country: Country) => void;
  disabled?: boolean;
}

export default function CountryCodeSelector({
  selected,
  onSelect,
  disabled = false,
}: CountryCodeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial_code.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-11 px-3 bg-zinc-50 border border-zinc-300 rounded-l-lg text-xs font-medium text-zinc-800 hover:bg-zinc-100 focus:outline-none focus:border-black transition-colors"
      >
        <span>{selected.flag}</span>
        <span className="font-semibold text-zinc-900">{selected.dial_code}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b border-zinc-100 bg-zinc-50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-md focus:outline-none focus:border-black"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-zinc-50">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-400">
                No country found
              </div>
            ) : (
              filtered.map((country) => (
                <button
                  key={`${country.code}-${country.dial_code}`}
                  type="button"
                  onClick={() => {
                    onSelect(country);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-zinc-50 transition-colors ${
                    selected.code === country.code ? "bg-zinc-100 font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{country.flag}</span>
                    <span className="text-zinc-800">{country.name}</span>
                  </div>
                  <span className="font-mono text-zinc-500">{country.dial_code}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
