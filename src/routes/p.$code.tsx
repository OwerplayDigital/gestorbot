import { createFileRoute } from '@tanstack/react-router';
import { PixPaymentPage, PIX_PAGE_META } from '@/components/PixPaymentPage';

export const Route = createFileRoute('/p/$code')({
  head: () => ({ meta: PIX_PAGE_META }),
  component: ShortPixPage,
});

function ShortPixPage() {
  const { code } = Route.useParams();
  return <PixPaymentPage reference={code} short />;
}
