import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { toZonedTime, format as formatTz } from 'date-fns-tz'
import { sendFcm } from '@/lib/fcm.server'

export const Route = createFileRoute('/api/public/cron-notifications')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const brTime = toZonedTime(new Date(), 'America/Sao_Paulo');
        const hour = brTime.getHours();
        const minutes = brTime.getMinutes();

        const url = new URL(request.url);
        const isTest = url.searchParams.get('test') === 'true';

        // Mantém o disparo automático restrito à janela configurada.
        if (!isTest) {
          const isCorrectTime = hour === 8 && minutes >= 30 && minutes <= 35;
          if (!isCorrectTime) {
            console.warn(`Tentativa de disparo fora do horário agendado: ${hour}:${minutes} BRT`);
            return new Response(JSON.stringify({
              error: 'Fora do horário agendado (08:30 BRT)',
              currentTime: `${hour}:${minutes}`
            }), { status: 403 });
          }
        }

        const today = formatTz(brTime, 'yyyy-MM-dd');

        // Push Android é independente do Telegram. Assim, os avisos continuam
        // funcionando mesmo quando o bot do Telegram for removido no futuro.
        let pushSent = 0;
        let pushFailed = 0;
        const { data: pushTokens, error: pushTokenError } = await (supabaseAdmin as any)
          .from('push_tokens')
          .select('user_id, token');

        if (pushTokenError) {
          console.error('Erro ao buscar tokens push:', pushTokenError.message);
        } else if (pushTokens?.length) {
          const tokensByUser = new Map<string, Set<string>>();
          for (const row of pushTokens as { user_id: string; token: string }[]) {
            if (!row.user_id || !row.token) continue;
            if (!tokensByUser.has(row.user_id)) tokensByUser.set(row.user_id, new Set());
            tokensByUser.get(row.user_id)!.add(row.token);
          }

          for (const [userId, tokens] of tokensByUser) {
            const { count, error: countError } = await supabaseAdmin
              .from('clientes')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('vencimento', today);

            if (countError) {
              console.error('Erro ao contar vencimentos para push:', countError.message);
              continue;
            }

            const dueToday = count || 0;
            if (dueToday === 0) continue;

            const title = dueToday === 1 ? '1 cliente vencendo hoje' : `${dueToday} clientes vencendo hoje`;
            const body = 'Toque para visualizar.';

            for (const token of tokens) {
              try {
                const result = await sendFcm(token, title, body);
                if (result.ok) pushSent++;
                else {
                  pushFailed++;
                  console.error('FCM recusou notificação:', result.status, result.body);
                }
              } catch (error) {
                pushFailed++;
                console.error('Erro ao enviar push de vencimentos:', error);
              }
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          pushSent,
          pushFailed
        }));
      }
    }
  }
})
