import { z } from 'zod';

/** Số tiền: bắt buộc dương (CONSTITUTION + .sdd/constraints/bao-mat-tai-chinh.md điều 4). */
export const money = z.coerce.number({ message: 'Phải là số' }).positive('Số tiền phải lớn hơn 0');

/** Số lượng: nguyên dương. */
export const quantity = z.coerce
  .number({ message: 'Phải là số' })
  .int('Số lượng phải là số nguyên')
  .positive('Số lượng phải lớn hơn 0');

/** Phần trăm 0–100 (VAT, chiết khấu). */
export const percent = z.coerce
  .number({ message: 'Phải là số' })
  .min(0, 'Không được âm')
  .max(100, 'Không vượt quá 100%');

/** Chuỗi tùy chọn: '' hoặc null → undefined cho đồng nhất. */
export const optionalStr = z
  .string()
  .trim()
  .max(1000, 'Quá dài')
  .nullish()
  .transform((v) => (v ? v : undefined));

/** Ngày tùy chọn nhận từ client (ISO string). */
export const optionalDate = z.coerce.date().optional().nullable();

/** Dòng hàng trong hóa đơn/báo giá. */
export const lineItem = z.object({
  productId: z.string().uuid('productId không hợp lệ').nullish(),
  productName: z.string().trim().min(1, 'Tên sản phẩm là bắt buộc'),
  productSku: optionalStr,
  unitPrice: z.coerce.number({ message: 'Phải là số' }).min(0, 'Đơn giá không được âm'),
  vatRate: percent.default(10),
  discountRate: percent.default(0),
  quantity,
});
export type LineItemInput = z.infer<typeof lineItem>;
