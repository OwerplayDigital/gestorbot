import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const TELEGRAM_TOKEN = process.env['TELEGRAM_BOT_TOKEN'];
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
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
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

async function runDailyNotification() {
  console.log("Iniciando processamento de notificações diárias...");
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. Buscar todos os usuários autorizados
  const { data: authUsers, error: authError } = await supabaseAdmin
    .from("telegram_authorized_users")
    .select("telegram_chat_id, user_id");

  if (authError || !authUsers) {
    console.error("Erro ao buscar usuários autorizados:", authError);
    return;
  }

  for (const user of authUsers) {
    // 2. Buscar clientes que vencem hoje para este user_id
    const { data: clientes, error: clientError } = await supabaseAdmin
      .from("clientes")
      .select("id, nome")
      .eq("user_id", user.user_id)
      .eq("vencimento", today);

    if (clientError) {
      console.error(`Erro ao buscar clientes para o chat ${user.telegram_chat_id}:`, clientError);
      continue;
    }

    if (clientes && clientes.length > 0) {
      const brDate = formatBRDate(new Date());
      const msg = `🔔 <b>LEMBRETE DIÁRIO DE VENCIMENTOS (${brDate})</b>\n\n` +
                  `Você tem <b>${clientes.length}</b> cliente(s) vencendo hoje:\n\n` +
                  `Clique no cliente abaixo para cobrar ou renovar:`;
      
      const buttons = clientes.map(c => ([{ 
        text: `👤 ${c.nome}`, 
        callback_data: `view_client:${c.nome}` 
      }]));

      await sendMessage(user.telegram_chat_id, msg, { inline_keyboard: buttons });
      console.log(`Notificação enviada para ${user.telegram_chat_id} (${clientes.length} clientes)`);
    } else {
      console.log(`Nenhum vencimento hoje para o chat ${user.telegram_chat_id}`);
    }
  }
}

runDailyNotification().catch(console.error);
