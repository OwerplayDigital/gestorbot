import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PixCheckout } from '@/components/PixCheckout';
import { pixAmount, type PixCheckoutInfo } from '@/lib/pix-payment';

export const PIX_PAGE_META = [
  { title: 'Pagamento via Pix | Owerplay' },
  { name: 'description', content: 'Renove seu acesso Owerplay com Pix.' },
  { name: 'robots', content: 'noindex, nofollow' },
  { property: 'og:title', content: 'Pagamento via Pix | Owerplay' },
  { property: 'og:description', content: 'Acesse para copiar sua chave Pix.' },
];

export function PixPaymentPage({ reference, short = false }: { reference: string; short?: boolean }) {
  const [info, setInfo] = useState<PixCheckoutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setInfo(null);
    setError(null);
    async function load() {
      try {
        const valid = short ? /^[A-Za-z0-9_-]{10}$/.test(reference) : /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reference);
        if (!valid) {
          if (active) setError('Este link de pagamento não é válido.');
          return;
        }
        const { data, error: queryError } = short
          ? await supabase.rpc('get_pix_checkout' as any, { p_code: reference })
          : await supabase.rpc('get_checkout_info', { p_ref: reference });
        if (queryError) throw queryError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          if (active) setError('Esta cobrança não está mais disponível.');
          return;
        }
        pixAmount(row as PixCheckoutInfo);
        if (active) setInfo(row as PixCheckoutInfo);
      } catch (cause) {
        console.error('Falha ao carregar pagamento Pix:', cause);
        if (active) setError('Não foi possível carregar esta cobrança. Tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [reference, short, attempt]);
  return <PixCheckout info={info} loading={loading} error={error} onRetry={() => setAttempt(value => value + 1)} />;
}
