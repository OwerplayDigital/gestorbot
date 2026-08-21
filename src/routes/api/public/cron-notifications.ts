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
        
        // Checar se a requisição vem do botão de teste (usando um query param)
        const url = new URL(request.url);
        const isTest = url.searchParams.get('test') === 'true';

        // Se não for teste e não estiver na janela de 08:30-08:35, bloquear.
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
        
        // Data atual em Brasília para o filtro de vencimento
        const today = formatTz(brTime, 'yyyy-MM-dd');
        
        let authUsers: { telegram_chat_id: string | number; user_id: string }[] = [];
        const { data: dbAuthUsers, error: authError } = await supabaseAdmin
          .from("telegram_authorized_users")
          .select("telegram_chat_id, user_id");

        if (dbAuthUsers && dbAuthUsers.length > 0) {
          authUsers = dbAuthUsers;
        } else {
          // Fallback: Usar TELEGRAM_ALLOWED_USER_ID ou TELEGRAM_ADMIN_ID
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
          return new Response(JSON.stringify({ error: "Nenhum administrador configurado ou encontrado." }), { status: 404 });
        }

        let totalSent = 0;

        for (const user of authUsers) {
          const { data: clientes, error: clientError } = await supabaseAdmin
            .from("clientes")
            .select("id, nome")
            .eq("user_id", user.user_id)
            .eq("vencimento", today as string);

          if (clientError || !clientes || clientes.length === 0) continue;

          const msg = `🗓️ <b>Vencem hoje:</b>`;
          
          const buttons = clientes.map(c => ([{ 
            text: `👤 ${c.nome}`, 
            callback_data: `view_client:${c.nome}` 
          }]));

          await sendMessage(Number(user.telegram_chat_id), msg, { inline_keyboard: buttons });
          totalSent++;
        }

        return new Response(JSON.stringify({ success: true, processed: authUsers.length, sent: totalSent }));
      }
    }
  }
})
