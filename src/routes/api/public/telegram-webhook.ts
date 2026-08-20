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
  getFinancialSummary,
  updateClient
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

function formatBRDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (e) {
    console.error("Erro ao responder callback:", e);
  }
}

const mainMenu = {
  inline_keyboard: [
    [{ text: 'Vence Hoje', callback_data: 'vencendo_hoje' }, { text: 'Vencidos', callback_data: 'vencidos' }],
    [{ text: 'Buscar', callback_data: 'search_direct' }],
    [{ text: 'Planos', callback_data: 'list_plans' }, { text: 'Servidores', callback_data: 'list_servers' }],
    [{ text: 'Financeiro', callback_data: 'financeiro' }],
    [{ text: 'Templates', callback_data: 'list_templates_root' }]
  ]
};

const sendClientFicha = async (chatId: number, client: any) => {
  const planName = client.plans?.name || 'N/A';
  const valorFinal = Number(client.plans?.price || 0) - Number(client.desconto || 0);
  const dataFormatada = formatBRDate(client.vencimento);
  
  const text = `<b>Ficha do Cliente:</b>\n\n` +
    `👤 <b>Nome:</b> ${client.nome}\n` +
    `📱 <b>WhatsApp:</b> ${client.whatsapp}\n` +
    `📦 <b>Plano:</b> ${planName}\n` +
    `💰 <b>Valor:</b> R$ ${valorFinal.toFixed(2)}\n` +
    `📅 <b>Vencimento:</b> ${dataFormatada}\n` +
    `📡 <b>Servidor:</b> ${client.servidores?.map((s: any) => s.name).join(', ') || 'N/A'}`;

  const kb = {
    inline_keyboard: [
      [
        { text: '💬 Cobrar', callback_data: `send_billing:${client.id}` },
        { text: '🔄 Renovar', callback_data: `confirm_renew:${client.id}` }
      ],
      [
        { text: '📅 Vencimento', callback_data: `edit_vencimento:${client.id}` },
        { text: '📡 Servidor', callback_data: `edit_server:${client.id}` }
      ],
      [
        { text: '✏️ Editar', callback_data: `edit:${client.id}` },
        { text: '🗑️ Excluir', callback_data: `confirm_delete:${client.id}` }
      ],
      [
        { text: '📝 [Mensagens...]', callback_data: `list_templates:${client.id}` }
      ],
      [{ text: '⬅️ Voltar', callback_data: 'back_to_main' }]
    ]
  };

  await sendMessage(chatId, text, kb);
};

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          
          // Tratar Mensagens de Texto
          if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;
            const userId = await getAuthorizedUser(chatId);
            
            if (!userId) return new Response('OK');

            if (text === '/start') {
              await sendMessage(chatId, "<b>Owerplay Gestor</b> - Bem-vindo!\nUse o menu abaixo para gerenciar:", mainMenu);
              await setUserStep(chatId, null);
              return new Response('OK');
            }

            const step = await getUserStep(chatId);
            if (step === 'searching') {
              const clients = await findClientByName(text);
              if (clients.length === 0) {
                await sendMessage(chatId, "❌ Nenhum cliente encontrado. Tente outro nome:");
              } else {
                const kb = clients.map(c => [{ text: c.nome, callback_data: `view_client:${c.id}` }]);
                await sendMessage(chatId, `🔍 Resultados para "${text}":`, { inline_keyboard: kb });
                await setUserStep(chatId, null);
              }
              return new Response('OK');
            }
          }

          // Tratar Callbacks
          const cb = body.callback_query;
          if (!cb) return new Response('OK');
          
          const chatId = cb.message.chat.id;
          const data = cb.data;
          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          await answerCallbackQuery(cb.id);

          if (data === 'search_direct') {
            await sendMessage(chatId, "🔍 Digite o nome do cliente para buscar:");
            await setUserStep(chatId, 'searching');
          } 
          else if (data === 'vencendo_hoje') {
            const clients = await listClientsExpiringToday();
            if (clients.length === 0) {
              await sendMessage(chatId, "✅ Nenhum cliente vencendo hoje.");
            } else {
              const kb = clients.map((c: any) => [{ text: c.nome, callback_data: `view_client:${c.id}` }]);
              await sendMessage(chatId, "📅 <b>Vencendo Hoje:</b>", { inline_keyboard: kb });
            }
          }
          else if (data === 'vencidos') {
            const clients = await listExpiredClients();
            if (clients.length === 0) {
              await sendMessage(chatId, "✅ Nenhum cliente vencido.");
            } else {
              const kb = clients.map((c: any) => [{ text: c.nome, callback_data: `view_client:${c.id}` }]);
              await sendMessage(chatId, "⚠️ <b>Clientes Vencidos:</b>", { inline_keyboard: kb });
            }
          }
          else if (data === 'financeiro') {
            const summary = await getFinancialSummary();
            const text = `📊 <b>Resumo Financeiro:</b>\n\n` +
              `🟢 Entradas: R$ ${summary.entradas.toFixed(2)}\n` +
              `🔴 Saídas: R$ ${summary.saidas.toFixed(2)}\n` +
              `💰 Lucro: R$ ${summary.lucro.toFixed(2)}`;
            await sendMessage(chatId, text, { inline_keyboard: [[{ text: '⬅️ Voltar', callback_data: 'back_to_main' }]] });
          }
          else if (data === 'list_plans') {
            const plans = await listPlans();
            const text = "📦 <b>Planos Cadastrados:</b>\n" + plans.map(p => `• ${p.name}: R$ ${p.price}`).join('\n');
            await sendMessage(chatId, text, { inline_keyboard: [[{ text: '⬅️ Voltar', callback_data: 'back_to_main' }]] });
          }
          else if (data === 'list_servers') {
            const servers = await listServers();
            const text = "📡 <b>Servidores Cadastrados:</b>\n" + servers.map(s => `• ${s.name}: R$ ${s.valor}`).join('\n');
            await sendMessage(chatId, text, { inline_keyboard: [[{ text: '⬅️ Voltar', callback_data: 'back_to_main' }]] });
          }
          else if (data.startsWith('view_client:')) {
            const clientId = data.split(':')[1];
            const { data: c, error } = await supabaseAdmin
              .from('clientes')
              .select('*, plans(*)')
              .eq('id', clientId)
              .maybeSingle();
            
            if (c) {
                let servidores: any[] = [];
                if (c.servidores_ids && c.servidores_ids.length > 0) {
                  const { data: sData } = await supabaseAdmin.from('servidores_iptv').select('id, name').in('id', c.servidores_ids);
                  servidores = sData || [];
                }
                await sendClientFicha(chatId, { ...c, servidores });
            } else {
                await sendMessage(chatId, "❌ Cliente não encontrado.");
            }
          }
          else if (data.startsWith('list_templates:')) {
            const clientId = data.split(':')[1];
            const templates = await listUserTemplates(userId);
            const kb = templates.map(t => [{ text: t.name, callback_data: `use_template:${t.id}:${clientId}` }]);
            await sendMessage(chatId, "<b>Templates Disponíveis:</b>", { inline_keyboard: [...kb, [{ text: "⬅️ Voltar", callback_data: `view_client:${clientId}` }]] });
          }
          else if (data.startsWith('use_template:')) {
            const [, templateId, clientId] = data.split(':');
            const { data: t } = await supabaseAdmin.from('message_templates').select('*').eq('id', templateId).single();
            const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*)').eq('id', clientId).single();
            if (t && c) {
              const filled = fillTemplate(t.content, { 
                nome: c.nome, 
                vencimento: formatBRDate(c.vencimento || ""),
                valor: `R$ ${(Number(c.plans?.price || 0) - Number(c.desconto || 0)).toFixed(2)}`
              });
              await sendMessage(chatId, filled);
            }
          }
          else if (data.startsWith('confirm_renew:')) {
            const clientId = data.split(':')[1];
            await sendMessage(chatId, "⚠️ Confirma a renovação deste cliente por mais 30 dias?", {
              inline_keyboard: [
                [{ text: "✅ Confirmar Renovação", callback_data: `renew:${clientId}` }],
                [{ text: "❌ Cancelar", callback_data: `view_client:${clientId}` }]
              ]
            });
          }
          else if (data.startsWith('renew:')) {
            const clientId = data.split(':')[1];
            const today = new Date();
            const nextMonth = new Date(today.setMonth(today.getMonth() + 1)).toISOString().split('T')[0] || "";
            await renewClient(clientId, nextMonth, userId);
            await sendMessage(chatId, "✅ Cliente renovado com sucesso!");
            // Refresh ficha
            const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*)').eq('id', clientId).maybeSingle();
            if (c) {
                let servidores: any[] = [];
                if (c.servidores_ids && c.servidores_ids.length > 0) {
                  const { data: sData } = await supabaseAdmin.from('servidores_iptv').select('id, name').in('id', c.servidores_ids);
                  servidores = sData || [];
                }
                await sendClientFicha(chatId, { ...c, servidores });
            }
          }
          else if (data.startsWith('send_billing:')) {
            const clientId = data.split(':')[1];
            const template = await getTemplateByType(userId, 'cobrança');
            const { data: c } = await supabaseAdmin.from('clientes').select('*, plans(*)').eq('id', clientId).single();
            if (c) {
              const text = template ? fillTemplate(template, { 
                nome: c.nome, 
                vencimento: formatBRDate(c.vencimento),
                valor: `R$ ${(Number(c.plans?.price || 0) - Number(c.desconto || 0)).toFixed(2)}`
              }) : `Olá ${c.nome}, seu plano vence em ${formatBRDate(c.vencimento)}.`;
              await sendMessage(chatId, text);
            }
          }
          else if (data.startsWith('confirm_delete:')) {
            const clientId = data.split(':')[1];
            await sendMessage(chatId, "⚠️ Tem certeza que deseja EXCLUIR este cliente?", {
              inline_keyboard: [
                [{ text: "🗑️ Sim, Excluir", callback_data: `delete:${clientId}` }],
                [{ text: "❌ Cancelar", callback_data: `view_client:${clientId}` }]
              ]
            });
          }
          else if (data.startsWith('delete:')) {
            const clientId = data.split(':')[1];
            await supabaseAdmin.from('clientes').delete().eq('id', clientId);
            await sendMessage(chatId, "✅ Cliente excluído com sucesso!");
            await sendMessage(chatId, "Menu Principal:", mainMenu);
          }
          else if (data === 'back_to_main') {
            await sendMessage(chatId, "Menu Principal:", mainMenu);
            await setUserStep(chatId, null);
          }
          
          return new Response('OK');
        } catch (e) {
          console.error("Erro no Webhook:", e);
          return new Response('OK'); // Always return OK to Telegram to avoid retries
        }
      }
    }
  }
});