'use client';

import React, { useRef } from 'react';

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
 * Ô nhập số tiền: tự chèn dấu chấm phân cách nghìn ngay khi gõ (1000 → 1.000),
 * vẫn nhận đúng nếu dán/gõ số thô không dấu chấm. Giữ đúng vị trí con trỏ sau khi
 * chèn dấu chấm — nếu không, gõ chen giữa số sẽ bị bắn con trỏ ra cuối ô.
 */
export default function MoneyInput({ value, onChange, className, placeholder, required, disabled, id, autoFocus }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value ? formatWithDots(String(value)) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, cursorPos).replace(/\D/g, '').length;

    const numeric = parseMoneyInput(input.value);
    onChange(numeric);

    // Đặt lại con trỏ đúng sau đúng số chữ số đã gõ (bỏ qua dấu chấm vừa chèn thêm)
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const newDisplay = formatWithDots(String(numeric));
      let digitsSeen = 0;
      let pos = 0;
      while (pos < newDisplay.length && digitsSeen < digitsBeforeCursor) {
        if (/\d/.test(newDisplay[pos])) digitsSeen++;
        pos++;
      }
      inputRef.current.setSelectionRange(pos, pos);
    });
  };

  return (
    <input
      ref={inputRef}
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
