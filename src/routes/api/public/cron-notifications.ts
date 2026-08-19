import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const TELEGRAM_TOKEN = process.env['TELEGRAM_BOT_TOKEN'];
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
  // Ajuste para fuso de Brasília (UTC-3)
  const brDate = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  const day = String(brDate.getUTCDate()).padStart(2, '0');
  const month = String(brDate.getUTCMonth() + 1).padStart(2, '0');
  const year = brDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export const Route = createFileRoute('/api/public/cron-notifications')({
  server: {
    handlers: {
      GET: async () => {
        console.log("Executando rotina de notificações via Cron...");
        
        // Data atual em Brasília para o filtro de vencimento
        const now = new Date();
        const brTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        const today = brTime.toISOString().split('T')[0];
        
        const { data: authUsers, error: authError } = await supabaseAdmin
          .from("telegram_authorized_users")
          .select("telegram_chat_id, user_id");

        if (authError || !authUsers) {
          return new Response(JSON.stringify({ error: authError }), { status: 500 });
        }

        let totalSent = 0;

        for (const user of authUsers) {
          const { data: clientes, error: clientError } = await supabaseAdmin
            .from("clientes")
            .select("id, nome")
            .eq("user_id", user.user_id)
            .eq("vencimento", today);

          if (clientError || !clientes || clientes.length === 0) continue;

          const brDateStr = formatBRDate(new Date());
          const msg = `🔔 <b>LEMBRETE DIÁRIO DE VENCIMENTOS (${brDateStr})</b>\n\n` +
                      `Você tem <b>${clientes.length}</b> cliente(s) vencendo hoje:\n\n` +
                      `Clique no cliente abaixo para cobrar ou renovar:`;
          
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
