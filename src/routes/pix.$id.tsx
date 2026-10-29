import { createFileRoute } from '@tanstack/react-router';
import { PixPaymentPage, PIX_PAGE_META } from '@/components/PixPaymentPage';

export const Route = createFileRoute('/pix/$id')({
  head: () => ({ meta: PIX_PAGE_META }),
  component: LegacyPixPage,
});

function LegacyPixPage() {
  const { id } = Route.useParams();
  return <PixPaymentPage reference={id} />;
}
