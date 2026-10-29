import { supabase } from '@/integrations/supabase/client';
import { getPixPaymentUrl, getShortPixPaymentUrl, withPixPaymentLink } from '@/lib/pix-payment';

const pendingLinks = new Map<string, Promise<string>>();

/** O código pertence ao cliente e é reutilizado nas cobranças seguintes. */
export async function getClientPixPaymentUrl(clientId: string): Promise<string> {
  const existing = pendingLinks.get(clientId);
  if (existing) return existing;
  const request = (async () => {
    const { data, error } = await supabase.rpc('get_or_create_pix_link' as any, { p_client_id: clientId });
    if (error) {
      // Mantém cobranças funcionando enquanto a migração ainda não foi aplicada.
      if (error.code === 'PGRST202' || error.code === '42883') {
        console.warn('Links curtos Pix aguardam aplicação da migração.');
        return getPixPaymentUrl(clientId);
      }
      throw error;
    }
    return getShortPixPaymentUrl(String(data));
  })();
  pendingLinks.set(clientId, request);
  try { return await request; }
  finally { pendingLinks.delete(clientId); }
}

export async function withClientPixPaymentLink(message: string, clientId: string): Promise<string> {
  return withPixPaymentLink(message, clientId, await getClientPixPaymentUrl(clientId));
}
