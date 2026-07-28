'use client';

import React from 'react';

function formatWithDots(digitsOnly: string): string {
  if (!digitsOnly) return '';
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Bóc số thô từ chuỗi đã định dạng (chấp nhận cả có dấu chấm lẫn không). */
export function parseMoneyInput(value: string): number {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  autoFocus?: boolean;
}

/**
 * Ô nhập số tiền: tự chèn dấu chấm phân cách nghìn khi gõ (1.350.000),
 * nhưng vẫn nhận đúng nếu người dùng dán/gõ số thô không dấu chấm (1350000).
 */
export default function MoneyInput({ value, onChange, className, placeholder, required, disabled, id, autoFocus }: MoneyInputProps) {
  const display = value ? formatWithDots(String(value)) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseMoneyInput(e.target.value));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}
