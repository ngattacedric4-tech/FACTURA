import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import type { SelectOption } from '@/lib/selectOptions';

export type { SelectOption };

export interface SelectFieldProps {
  name?: string;
  label: string;
  placeholder?: string;
  options: SelectOption[];
  required?: boolean;
  disabled?: boolean;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  defaultValue?: string;
}

export function SelectField({
  name,
  label,
  placeholder = 'Sélectionner...',
  options,
  required = false,
  disabled = false,
  className = '',
  value,
  onValueChange,
  error,
  defaultValue,
}: SelectFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <Label htmlFor={name} className="text-[11px] font-bold text-[#374151] uppercase tracking-widest ml-0.5">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
      )}
      <Select
        name={name}
        disabled={disabled}
        onValueChange={onValueChange}
        value={value}
        defaultValue={defaultValue}
      >
        <SelectTrigger
          translate="no"
          id={name}
          className={`w-full h-[44px] rounded-xl border border-[#E5E7EB] bg-white hover:border-[#111827] focus:ring-1 focus:ring-[#111827] focus:border-[#111827] transition-all text-[#0A0A0A] ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          }`}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          translate="no"
          className="rounded-xl shadow-lg border border-[#E5E7EB] p-1 animate-in fade-in-0 zoom-in-95 bg-white text-[#0A0A0A]"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-lg px-3 py-2.5 cursor-pointer hover:bg-[#F9FAFB] hover:text-[#0A0A0A] focus:bg-[#F9FAFB] focus:text-[#0A0A0A] data-[state=checked]:bg-[#111827] data-[state=checked]:text-white data-[state=checked]:font-medium transition-colors"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-red-500 font-medium ml-1">{error}</p>
      )}
    </div>
  );
}

export interface FormSelectProps<T extends FieldValues> extends Omit<SelectFieldProps, 'value' | 'onValueChange' | 'error'> {
  name: Path<T>;
  control: Control<T>;
}

export function FormSelect<T extends FieldValues>({ name, control, ...props }: FormSelectProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <SelectField
          {...props}
          name={name}
          value={field.value}
          onValueChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

export default SelectField;
