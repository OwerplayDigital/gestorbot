import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  getAuthorizedUser, 
  listPlans, 
  listServers, 
  getClientsSummary, 
  createClientWithDetails,
  findClientByName,
  setUserStep,
  getUserStep,
  listExpiredClients,
  listClientsExpiringToday,
  renewClient,
  BOT_TEMPLATES,
  listUserTemplates,
  fillTemplate,
  getTemplateByType,
  getFinancialSummary
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

function formatBRDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

const mainMenu = {
  inline_keyboard: [
    [{ text: 'Vence Hoje', callback_data: 'vencendo_hoje' }, { text: 'Vencidos', callback_data: 'vencidos' }],
    [{ text: 'Buscar', callback_data: 'search_direct' }],
    [{ text: 'Financeiro', callback_data: 'financeiro' }],
    [{ text: 'Templates', callback_data: 'list_templates_root' }]
  ]
};

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const cb = body.callback_query;
          if (!cb) return new Response('OK');
          
          const chatId = cb.message.chat.id;
          const data = cb.data;
          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          await answerCallbackQuery(cb.id);

          if (data.startsWith('list_templates:')) {
            const clientId = data.split(':')[1];
            const templates = await listUserTemplates(userId);
            const kb = templates.map(t => [{ text: t.name, callback_data: `use_template:${t.id}:${clientId}` }]);
            await sendMessage(chatId, "<b>Templates Disponíveis:</b>", { inline_keyboard: [...kb, [{ text: "Voltar", callback_data: `view_client:${clientId}` }]] });
          }
          else if (data.startsWith('use_template:')) {
            const [, templateId, clientId] = data.split(':');
            const { data: t } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
            const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*)').eq('id', clientId).single();
            if (t && c) {
              const filled = fillTemplate(t.content, { 
                nome: c.nome, 
                vencimento: formatBRDate(new Date(c.vencimento + 'T12:00:00')),
                valor: `R$ ${(Number(c.plans?.price || 0) - Number(c.desconto || 0)).toFixed(2)}`
              });
              await sendMessage(chatId, filled);
            }
          }
          else if (data === 'back_to_main') {
            await sendMessage(chatId, "Menu Principal:", mainMenu);
          }
          
          return new Response('OK');
        } catch (e) {
          return new Response('OK');
        }
      }
    }
  }
});
