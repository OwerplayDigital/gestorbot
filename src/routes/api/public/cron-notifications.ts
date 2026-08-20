import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
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
    console.error("Erro ao enviar notificação diária:", err);
  }
}

function formatBRDate(date: Date): string {
  const brDate = toZonedTime(date, 'America/Sao_Paulo');
  return formatTz(brDate, 'dd/MM/yyyy');
}

export const Route = createFileRoute('/api/public/cron-notifications')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Validação de segurança: bloquear disparos manuais inesperados (exceto se for localhost para desenvolvimento/dashboard ou tiver um header específico que o cron enviaria, se configurado)
        // No Lovable Cloud, o cron job chama via HTTP. 
        // Para simplificar a validação conforme pedido ("não dispare o resumo fora desse horário"),
        // vamos checar se a hora atual está na janela permitida (08:30 às 08:35 BRT).
        
        const brTime = toZonedTime(new Date(), 'America/Sao_Paulo');
        const hour = brTime.getHours();
        const minutes = brTime.getMinutes();
        
        const url = new URL(request.url);
        const isTest = url.searchParams.get('test') === 'true';

        if (!isTest) {
          const isCorrectTime = (hour === 8 && minutes >= 30 && minutes <= 35);
          if (!isCorrectTime) {
            console.warn(`Tentativa de disparo fora do horário agendado: ${hour}:${minutes} BRT`);
            return new Response(JSON.stringify({ 
              error: "Fora do horário agendado (08:30 BRT)", 
              currentTime: `${hour}:${minutes}` 
            }), { status: 403 });
          }
        }

        console.log("Executando rotina de notificações via Cron...");
        
        const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
        nowBr.setHours(0, 0, 0, 0);
        
        const { data: authUsers, error: authError } = await supabaseAdmin
          .from("telegram_authorized_users")
          .select("telegram_chat_id, user_id");

        if (authError || !authUsers) {
          return new Response(JSON.stringify({ error: authError }), { status: 500 });
        }

        const parseDate = (d: any): Date | null => {
          if (!d || typeof d !== 'string') return null;
          const parts = d.split(/[/-]/);
          if (parts.length !== 3) return null;
          const s0 = parts[0], s1 = parts[1], s2 = parts[2];
          if (s0 === undefined || s1 === undefined || s2 === undefined) return null;
          const p0 = Number(s0), p1 = Number(s1), p2 = Number(s2);
          let res: Date | null = null;
          if (d.includes('/') || (d.includes('-') && s0.length === 2)) res = new Date(p2, p1 - 1, p0);
          else if (d.includes('-') && s0.length === 4) res = new Date(p0, p1 - 1, p2);
          if (res && !isNaN(res.getTime())) { res.setHours(0, 0, 0, 0); return res; }
          return null;
        };

        let totalSent = 0;
        let totalNotified = 0;

        for (const user of authUsers) {
          if (!user.user_id || !user.telegram_chat_id) continue;

          const { data: allClientes, error: clientError } = await supabaseAdmin
            .from("clientes")
            .select("id, nome, vencimento")
            .eq("user_id", user.user_id);

          if (clientError || !Array.isArray(allClientes)) continue;

          const seenIds = new Set();
          const expiringToday = allClientes.filter(c => {
            if (seenIds.has(c.id)) return false;
            const vDate = parseDate(c.vencimento);
            const isToday = vDate && vDate.getTime() === nowBr.getTime();
            if (isToday) {
              seenIds.add(c.id);
              return true;
            }
            return false;
          });

          if (expiringToday.length === 0) continue;

          const brDateStr = formatBRDate(new Date());
          const msg = `🔔 <b>LEMBRETE DIÁRIO DE VENCIMENTOS (${brDateStr})</b>\n\n` +
                      `Você tem <b>${expiringToday.length}</b> cliente(s) vencendo hoje:\n\n` +
                      `Clique no cliente abaixo para cobrar ou renovar:`;
          
          const buttons = expiringToday.map(c => ([{ 
            text: `👤 ${c.nome}`, 
            callback_data: `view_client:${c.nome}` 
          }]));

          await sendMessage(Number(user.telegram_chat_id), msg, { inline_keyboard: buttons });
          totalSent++;
          totalNotified += expiringToday.length;
        }

        console.log(`[DIAGNOSTICO] Cron finalizada. Usuários notificados: ${totalSent}. Clientes alertados: ${totalNotified}.`);
        return new Response(JSON.stringify({ success: true, processed: authUsers.length, sent: totalSent, notifiedClients: totalNotified }));
      }
    }
  }
})
