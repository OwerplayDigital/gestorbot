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
  fillTemplate
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

type ClientRegistrationData = {
  id?: string;
  nome: string;
  whatsapp: string;
  plano_id: string;
  plano_name: string;
  servidores_ids: string[];
  servidores_names: string[];
  desconto: number;
  vencimento: string;
  vencimento_temp: string;
};

type UserState = {
  action: 'cadastrar_cliente' | 'buscar_cliente' | 'renovar_cliente' | 'enviar_template';
  step: number;
  data: Partial<ClientRegistrationData> & { cliente_id?: string };
};

const userState = new Map<number, UserState>();

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
  }
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error("Erro ao editar mensagem:", err);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("Erro ao responder callback query:", err);
  }
}

const mainMenu = {
  inline_keyboard: [
    [{ text: 'Vence Hoje', callback_data: 'vencendo_hoje' }, { text: 'Vencidos', callback_data: 'vencidos' }],
    [{ text: 'Cadastrar', callback_data: 'new_client_fast' }, { text: 'Buscar', callback_data: 'search_direct' }],
    [{ text: 'Servidores', callback_data: 'list_servers' }, { text: 'Planos', callback_data: 'list_plans' }],
    [{ text: 'Financeiro', callback_data: 'financeiro' }]
  ]
};

function formatBRDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 0 ? '' : (cleaned.startsWith('55') ? cleaned : `55${cleaned}`);
}

async function sendClientFicha(chatId: number, c: any) {
  const phone = cleanPhone(c.whatsapp || '');
  const msg = `👤 Cliente: ${c.nome}\n` +
              `📅 Vencimento: ${formatBRDate(new Date(c.vencimento + 'T12:00:00'))}\n` +
              `🖥️ Servidor: ${c.servidores?.map((s: any) => s.name).join(', ') || 'N/A'}`;
  
  await sendMessage(chatId, msg, {
    inline_keyboard: [
      [{ text: "Cobrar", callback_data: `send_template:cobrança:${c.id}` }, { text: "Renovar", callback_data: `send_template:renovação:${c.id}` }],
      [{ text: "Mensagens...", callback_data: `list_templates:${c.id}` }],
      [{ text: "Menu Principal", callback_data: "back_to_main" }]
    ]
  });
}

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (!body) return new Response('OK');
          
          if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data;
            const userId = await getAuthorizedUser(chatId);
            if (!userId) return new Response('OK');

            await answerCallbackQuery(cb.id);

            if (data.startsWith('send_template:')) {
              const [, type, clientId] = data.split(':');
              const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*), servidores_ids').eq('id', clientId).single();
              if (c) {
                 const t = await getTemplateByType(userId, type as any) || (type === 'cobrança' ? BOT_TEMPLATES.COBRANCA(c.nome, c.vencimento) : BOT_TEMPLATES.RENOVACAO_LINK(c.nome));
                 const filled = fillTemplate(t, { nome: c.nome, vencimento: c.vencimento });
                 await sendMessage(chatId, `Enviado:\n${filled}`);
              }
            }

            if (data.startsWith('list_templates:')) {
                const clientId = data.split(':')[1];
                const templates = await listUserTemplates(userId);
                const kb = templates.map(t => [{ text: t.name, callback_data: `use_template:${t.id}:${clientId}` }]);
                await sendMessage(chatId, "Escolha um template:", { inline_keyboard: [...kb, [{ text: "Voltar", callback_data: `view_client:${clientId}` }]] });
            }

            if (data.startsWith('use_template:')) {
                const [, templateId, clientId] = data.split(':');
                const { data: t } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
                const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*)').eq('id', clientId).single();
                if (t && c) {
                    const filled = fillTemplate(t.content, { nome: c.nome, vencimento: c.vencimento });
                    await sendMessage(chatId, `Enviado:\n${filled}`);
                }
            }
            
            if (data === 'back_to_main') {
              await sendMessage(chatId, "Menu Principal:", mainMenu);
            }
            // ... resto da lógica de callbacks
          }
          return new Response('OK');
        } catch (e) {
          return new Response('OK');
        }
      }
    }
  }
});
