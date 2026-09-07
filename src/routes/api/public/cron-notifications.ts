import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { BOT_TEMPLATES, isoToBR } from '@/lib/telegram.server'
import { toZonedTime, format as formatTz } from 'date-fns-tz'

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const TELEGRAM_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || '';
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      }),
    });
  } catch (err) {
    console.error('Erro ao enviar notificação diária:', err);
  }
}

function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

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

        let authUsers: { telegram_chat_id: string | number; user_id: string }[] = [];
        const { data: dbAuthUsers } = await supabaseAdmin
          .from('telegram_authorized_users')
          .select('telegram_chat_id, user_id');

        if (dbAuthUsers && dbAuthUsers.length > 0) {
          authUsers = dbAuthUsers;
        } else {
          const adminChatId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
          if (adminChatId) {
            const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
            const firstUser = userData?.users?.[0];
            if (firstUser) {
              authUsers = [{ telegram_chat_id: adminChatId, user_id: firstUser.id }];
            }
          }
        }

        if (authUsers.length === 0) {
          return new Response(JSON.stringify({ error: 'Nenhum administrador configurado ou encontrado.' }), { status: 404 });
        }

        let totalSent = 0;
        let totalClients = 0;

        for (const user of authUsers) {
          const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
          if (allowedId && user.telegram_chat_id.toString() !== allowedId) {
            console.warn(`Tentativa de envio de notificação para ID não autorizado: ${user.telegram_chat_id}`);
            continue;
          }

          const { data: clientes, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('id, nome, whatsapp, vencimento')
            .eq('user_id', user.user_id)
            .eq('vencimento', today);

          if (clientError || !clientes || clientes.length === 0) continue;

          await sendMessage(
            Number(user.telegram_chat_id),
            `🗓️ <b>Vencimentos de hoje</b>\nVocê tem <b>${clientes.length}</b> cliente(s) vencendo hoje.`
          );

          for (const cliente of clientes) {
            const brDate = isoToBR(cliente.vencimento);
            const primeiroNome = (cliente.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
            const paymentUrl = `https://gestorbot.lovable.app/pagar/${cliente.id}`;
            const cobranca = BOT_TEMPLATES.COBRANCA(primeiroNome, brDate, paymentUrl);
            const phone = cleanPhone(cliente.whatsapp || '');

            const buttons: any[][] = [];
            if (phone) {
              buttons.push([
                { text: 'Cobrar', url: `https://wa.me/${phone}?text=${encodeURIComponent(cobranca)}` },
                { text: 'Renovar', callback_data: `renew_init:${cliente.id}` }
              ]);
            } else {
              buttons.push([
                { text: 'Renovar', callback_data: `renew_init:${cliente.id}` }
              ]);
            }

            await sendMessage(
              Number(user.telegram_chat_id),
              `👤 <b>${cliente.nome}</b>\n📅 Vencimento: ${brDate}`,
              { inline_keyboard: buttons }
            );
            totalClients++;
          }

          totalSent++;
        }

        return new Response(JSON.stringify({
          success: true,
          processed: authUsers.length,
          sent: totalSent,
          clients: totalClients
        }));
      }
    }
  }
})
