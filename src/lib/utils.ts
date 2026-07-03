import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import prisma from './prisma';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Định dạng số tiền sang dạng VND (e.g. 1.500.000 ₫)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

/**
 * Định dạng ngày tháng năm (e.g. 29/06/2026)
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Tự động tạo mã chứng từ tăng dần: HD000001, BG000001, PT000001, PC000001...
 * Bằng cách đếm số bản ghi hiện tại và sinh mã tiếp theo.
 */
export async function generateDocumentCode(
  prefix: 'HD' | 'BG' | 'PT' | 'PC' | 'SP' | 'KH' | 'NCC' | 'KHO' | 'CP',
  modelName: 'invoice' | 'quotation' | 'receipt' | 'payment' | 'product' | 'customer' | 'supplier' | 'warehouse' | 'expense'
): Promise<string> {
  let count = 0;
  
  try {
    switch (modelName) {
      case 'invoice':
        count = await prisma.invoice.count();
        break;
      case 'quotation':
        count = await prisma.quotation.count();
        break;
      case 'receipt':
        count = await prisma.receipt.count();
        break;
      case 'payment':
        count = await prisma.payment.count();
        break;
      case 'product':
        count = await prisma.product.count();
        break;
      case 'customer':
        count = await prisma.customer.count();
        break;
      case 'supplier':
        count = await prisma.supplier.count();
        break;
      case 'warehouse':
        count = await prisma.warehouse.count();
        break;
      case 'expense':
        count = await prisma.expense.count();
        break;
    }
  } catch (error) {
    console.error('Lỗi khi đếm số bản ghi để sinh mã:', error);
  }

  const nextNumber = count + 1;
  const paddedNumber = String(nextNumber).padStart(6, '0');
  return `${prefix}${paddedNumber}`;
}
