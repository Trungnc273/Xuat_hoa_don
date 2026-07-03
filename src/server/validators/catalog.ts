import { z } from 'zod';
import { optionalStr, percent } from './common';

/** POST /api/customers và /api/suppliers dùng chung shape đối tác. */
export const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Tên là bắt buộc'),
  company: optionalStr,
  taxCode: optionalStr,
  address: optionalStr,
  email: z.string().trim().email('Email không hợp lệ').nullish().or(z.literal('').transform(() => undefined)),
  phone: optionalStr,
  contactPerson: optionalStr,
  note: optionalStr,
});

/** POST /api/products */
export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Tên sản phẩm là bắt buộc'),
  sku: optionalStr,
  barcode: optionalStr,
  categoryId: z.string().uuid('categoryId không hợp lệ').nullish(),
  importPrice: z.coerce.number({ message: 'Phải là số' }).min(0, 'Giá nhập không được âm'),
  salePrice: z.coerce.number({ message: 'Phải là số' }).min(0, 'Giá bán không được âm'),
  vatRate: percent.default(10),
  unit: z.string().trim().default('Cái'),
  images: z.array(z.string()).default([]),
  description: optionalStr,
  stock: z.coerce.number({ message: 'Phải là số' }).int().min(0, 'Tồn ban đầu không âm').default(0),
});

/** POST /api/stock/adjust */
export const stockAdjustSchema = z.object({
  productId: z.string().uuid('productId không hợp lệ'),
  warehouseId: z.string().uuid('warehouseId không hợp lệ').nullish(),
  type: z.enum(['IN', 'OUT', 'CHECK', 'ADJUST']),
  quantity: z.coerce.number({ message: 'Phải là số' }).int('Phải là số nguyên'),
  reason: optionalStr,
  note: optionalStr,
});

/** POST /api/auth/login */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tài khoản'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

/** POST /api/auth/register */
export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Tài khoản tối thiểu 3 ký tự').max(50, 'Tài khoản quá dài'),
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  roleName: z.enum(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF']).default('STAFF'),
});
