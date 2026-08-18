import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  getAuthorizedUser, 
  listPlans, 
  listServers, 
  getClientsSummary, 
  getFinancialSummary,
  createClientWithDetails 
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

type ClientRegistrationData = {
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
  action: string;
  step: number;
  data: Partial<ClientRegistrationData>;
};

const userState = new Map<number, UserState>();

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
    console.error("Erro ao enviar mensagem:", err);
  }
}

const mainMenu = {
  keyboard: [
    [{ text: '👥 Clientes' }, { text: '🖥️ Servidores' }],
    [{ text: '📋 Planos' }, { text: '💰 Financeiro' }]
  ],
  resize_keyboard: true,
};

const clientsSubMenu = {
  keyboard: [
    [{ text: '📊 Resumo' }, { text: '📅 Vencendo Hoje' }],
    [{ text: '❌ Vencidos' }, { text: '🔍 Buscar Cliente' }],
    [{ text: '➕ Novo Cliente' }, { text: '🔙 Voltar' }]
  ],
  resize_keyboard: true,
};

function formatBRDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseBRDate(brDate: string): string | null {
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;
  const d = parts[0], m = parts[1], y = parts[2];
  if (!d || !m || !y) return null;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          
          if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data;
            const state = userState.get(chatId);
            if (!state || state.action !== 'cadastrar_cliente') return new Response('OK');

            // Fluxo de Cadastro - Callbacks
            if (state.step === 3 && data.startsWith('plano:')) {
              const [_, id, name] = data.split(':');
              state.data.plano_id = id;
              state.data.plano_name = name;
              state.step = 4;
              state.data.servidores_ids = [];
              state.data.servidores_names = [];
              const servers = await listServers();
              const buttons = servers.map(s => ([{ text: s.name, callback_data: `serv:${s.id}:${s.name}` }]));
              await sendMessage(chatId, "<b>Passo 4: Seleção de Servidor</b>\nSelecione os servidores:", { inline_keyboard: buttons });
            } 
            else if (state.step === 4) {
              if (data.startsWith('serv:')) {
                const [_, id, name] = data.split(':');
                if (id && name && !state.data.servidores_ids?.includes(id)) {
                  state.data.servidores_ids?.push(id);
                  state.data.servidores_names?.push(name);
                }
                await sendMessage(chatId, `✅ <b>${name}</b> adicionado.\nMais algum ou avançar?`, {
                  inline_keyboard: [
                    [{ text: "➕ Adicionar Outro", callback_data: "serv_outro" }],
                    [{ text: "▶️ Avançar", callback_data: "serv_avancar" }]
                  ]
                });
              } else if (data === 'serv_outro') {
                const servers = await listServers();
                const buttons = servers.map(s => ([{ text: s.name, callback_data: `serv:${s.id}:${s.name}` }]));
                await sendMessage(chatId, "Selecione outro:", { inline_keyboard: buttons });
              } else if (data === 'serv_avancar') {
                state.step = 5;
                await sendMessage(chatId, "<b>Passo 5: Desconto</b>\nInforme o valor (ex: 5 ou 0):");
              }
            }
            else if (state.step === 6) {
              const currentIso = state.data.vencimento_temp;
              if (!currentIso) return new Response('OK');
              const d = new Date(currentIso);
              if (data === 'venc_m5') d.setDate(d.getDate() - 5);
              if (data === 'venc_m1') d.setDate(d.getDate() - 1);
              if (data === 'venc_p1') d.setDate(d.getDate() + 1);
              if (data === 'venc_p5') d.setDate(d.getDate() + 5);
              
              if (data.startsWith('venc_')) {
                state.data.vencimento_temp = d.toISOString();
                const br = formatBRDate(d);
                await sendMessage(chatId, `Vencimento: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "venc_m5" }, { text: "-1d", callback_data: "venc_m1" }, { text: "+1d", callback_data: "venc_p1" }, { text: "+5d", callback_data: "venc_p5" }],
                    [{ text: `Confirmar: ${br}`, callback_data: "venc_confirm" }],
                    [{ text: "Digitar Data", callback_data: "venc_edit" }]
                  ]
                });
              } else if (data === 'venc_confirm') {
                state.data.vencimento = state.data.vencimento_temp?.split('T')[0];
                state.step = 7;
                const resumo = `📝 <b>RESUMO:</b>\n• Nome: ${state.data.nome}\n• Plano: ${state.data.plano_name}\n• Venc: ${formatBRDate(new Date((state.data.vencimento || '') + 'T12:00:00'))}\n\nConfirmar?`;
                await sendMessage(chatId, resumo, {
                  inline_keyboard: [[{ text: "✅ Confirmar", callback_data: "f_ok" }, { text: "❌ Cancelar", callback_data: "f_no" }]]
                });
              } else if (data === 'venc_edit') {
                await sendMessage(chatId, "Digite DD/MM/AAAA:");
              }
            }
            else if (data === 'f_ok') {
              const d = state.data;
              if (d.nome && d.whatsapp && d.plano_id && d.servidores_ids && d.desconto !== undefined && d.vencimento) {
                await createClientWithDetails({
                  nome: d.nome, whatsapp: d.whatsapp === '0' ? '' : d.whatsapp,
                  plano_id: d.plano_id, servidores_ids: d.servidores_ids,
                  desconto: d.desconto, vencimento: d.vencimento
                });
                await sendMessage(chatId, "✅ <b>Sucesso!</b>", clientsSubMenu);
                userState.delete(chatId);
              }
            } else if (data === 'f_no') {
              userState.delete(chatId);
              await sendMessage(chatId, "❌ Cancelado.", clientsSubMenu);
            }

            return new Response('OK');
          }

          const msg = body.message;
          if (!msg) return new Response('OK');
          const chatId = msg.chat.id;
          const text = msg.text;
          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          const state = userState.get(chatId);

          if (text === '/start' || text === '🔙 Voltar') {
            userState.delete(chatId);
            await sendMessage(chatId, "Menu:", mainMenu);
            return new Response('OK');
          }

          if (state?.action === 'cadastrar_cliente') {
            if (state.step === 1) {
              state.data.nome = text; state.step = 2;
              await sendMessage(chatId, "WhatsApp (ou 0):");
            } else if (state.step === 2) {
              state.data.whatsapp = text; state.step = 3;
              const plans = await listPlans();
              const buttons = plans.map(p => ([{ text: `${p.name} (R$${p.price})`, callback_data: `plano:${p.id}:${p.name}` }]));
              await sendMessage(chatId, "Selecione o Plano:", { inline_keyboard: buttons });
            } else if (state.step === 5) {
              const val = parseFloat(text.replace(',', '.'));
              if (isNaN(val)) return new Response('OK');
              state.data.desconto = val; state.step = 6;
              const d = new Date(); d.setDate(d.getDate() + 30);
              state.data.vencimento_temp = d.toISOString();
              const br = formatBRDate(d);
              await sendMessage(chatId, `Vencimento: <b>${br}</b>`, {
                inline_keyboard: [
                  [{ text: "-5d", callback_data: "venc_m5" }, { text: "-1d", callback_data: "venc_m1" }, { text: "+1d", callback_data: "venc_p1" }, { text: "+5d", callback_data: "venc_p5" }],
                  [{ text: `Confirmar: ${br}`, callback_data: "venc_confirm" }],
                  [{ text: "Digitar Data", callback_data: "venc_edit" }]
                ]
              });
            } else if (state.step === 6) {
              const iso = parseBRDate(text);
              if (!iso) return new Response('OK');
              state.data.vencimento_temp = new Date(iso + 'T12:00:00').toISOString();
              const br = formatBRDate(new Date(state.data.vencimento_temp));
              await sendMessage(chatId, `Data: <b>${br}</b>`, {
                inline_keyboard: [[{ text: `Confirmar: ${br}`, callback_data: "venc_confirm" }]]
              });
            }
            return new Response('OK');
          }

          switch (text) {
            case '👥 Clientes': await sendMessage(chatId, "Clientes:", clientsSubMenu); break;
            case '➕ Novo Cliente':
              userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
              await sendMessage(chatId, "Nome do cliente:");
              break;
            case '💰 Financeiro':
              const f = await getFinancialSummary();
              await sendMessage(chatId, `💰 Lucro: R$ ${f.lucro.toFixed(2)}`, mainMenu);
              break;
          }

          return new Response('OK');
        } catch (e) {
          return new Response('OK');
        }
      }
    }
  }
});