import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: { label: string; color: string };
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function CustomSelect({
  value, onChange, options, placeholder = 'Sélectionner…',
  className = '', size = 'md', disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Flip upward if not enough space below
  const [flipUp, setFlipUp] = useState(false);
  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setFlipUp(spaceBelow < 200 && rect.top > 200);
    }
  }, [open]);

  const heights: Record<string, string> = { sm: 'h-8', md: 'h-10', lg: 'h-11' };
  const textSizes: Record<string, string> = { sm: 'text-[12px]', md: 'text-[13px]', lg: 'text-[14px]' };
  const paddings: Record<string, string> = { sm: 'px-2.5', md: 'px-3.5', lg: 'px-4' };

  return (
    <div ref={ref} className={`relative select-none ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-2
          ${heights[size]} ${paddings[size]} ${textSizes[size]}
          border rounded-xl bg-white text-left
          transition-all duration-150 outline-none
          ${disabled
            ? 'border-[#F3F4F6] bg-[#F9FAFB] text-[#9CA3AF] cursor-not-allowed'
            : open
              ? 'border-[#111827] ring-1 ring-[#111827] shadow-sm'
              : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:shadow-sm cursor-pointer'
          }
        `}
      >
        <span className={`truncate font-medium ${selected ? 'text-[#0A0A0A]' : 'text-[#9CA3AF] font-normal'}`}>
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected.badge.color}`}>
                  {selected.badge.label}
                </span>
              )}
              {selected.label}
            </span>
          ) : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-[#9CA3AF] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: flipUp ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: flipUp ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
            className={`
              absolute left-0 right-0 z-[200]
              bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden
              ${flipUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}
            `}
          >
            <div className="max-h-52 overflow-y-auto py-1 overscroll-contain">
              {options.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`
                      w-full flex items-center justify-between gap-3
                      px-3.5 py-2.5 text-left transition-colors duration-100
                      ${isSelected
                        ? 'bg-[#F3F4F6]'
                        : 'hover:bg-[#F9FAFB] active:bg-[#F3F4F6]'}
                    `}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {opt.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${opt.badge.color}`}>
                          {opt.badge.label}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className={`text-[13px] truncate ${isSelected ? 'font-semibold text-[#111827]' : 'font-medium text-[#374151]'}`}>
                          {opt.label}
                        </p>
                        {opt.description && (
                          <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">{opt.description}</p>
                        )}
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-[#111827]' : ''}`}>
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
