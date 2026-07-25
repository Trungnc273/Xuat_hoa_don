'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QuotationDocumentWorkspace from '../_components/QuotationDocumentWorkspace';

function NewQuotationForm() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get('customerId') || undefined;
  return <QuotationDocumentWorkspace mode="create" initialCustomerId={customerId} />;
}

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-muted-foreground">Đang tải...</div>}>
      <NewQuotationForm />
    </Suspense>
  );
}
