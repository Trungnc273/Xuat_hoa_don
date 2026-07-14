import React from 'react';

export interface CustomerTagInfo {
  tagName?: string | null;
  tagColor?: string | null;
  priceTier?: { id: string; name: string; color: string } | null;
}

/** Hiện tag tự do + phân loại giá của khách hàng (nếu có) dạng chip màu, dùng chung ở các danh sách. */
export default function CustomerTagChip({ customer }: { customer: CustomerTagInfo }) {
  if (!customer.tagName && !customer.priceTier) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {customer.tagName && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{
            backgroundColor: `${customer.tagColor || '#2563eb'}1a`,
            color: customer.tagColor || '#2563eb',
          }}
        >
          {customer.tagName}
        </span>
      )}
      {customer.priceTier && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
          style={{
            backgroundColor: `${customer.priceTier.color}1a`,
            color: customer.priceTier.color,
          }}
        >
          {customer.priceTier.name}
        </span>
      )}
    </span>
  );
}
