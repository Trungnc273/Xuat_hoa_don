'use client';

import { useParams } from 'next/navigation';
import QuotationDocumentWorkspace from '../_components/QuotationDocumentWorkspace';

export default function QuotationDetailPage() {
  const { id } = useParams() as { id: string };

  return <QuotationDocumentWorkspace mode="view" quotationId={id} />;
}
