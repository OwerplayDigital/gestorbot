import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  getAuthorizedUser, 
  createPlan, 
  listPlans, 
  createServer, 
  listServers, 
  getClientsSummary, 
  listExpiredClients, 
  listClientsExpiringToday, 
  findClientByName, 
  createClientWithDetails, 
  getFinancialSummary 
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

// Gerenciador de estado temporário para o fluxo de cadastro
const userState = new Map<number, { action: string; step: number; data: any }>();

// Helper para enviar mensagens com teclado inline ou comum
async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      }),
    });
    if (!response.ok) {
      console.error("Erro ao enviar mensagem Telegram:", await response.text());
    }
  } catch (err) {
    console.error("Exceção ao enviar mensagem Telegram:", err);
  }
}

// Menus
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

// Utils de Data
function formatBRDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function parseBRDate(brDate: string): string | null {
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          
          // Lidar com Callback Query (Botões Inline)
          if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const data = cb.data;
            const userId = await getAuthorizedUser(chatId);
            if (!userId) return new Response('OK');

            const state = userState.get(chatId);
            if (!state || state.action !== 'cadastrar_cliente') return new Response('OK');

            // Passo 3: Seleção de Plano
            if (state.step === 3 && data.startsWith('plano:')) {
              const parts = data.split(':');
              const planoId = parts[1];
              const planoName = parts[2];
              state.data.plano_id = planoId;
              state.data.plano_name = planoName;
              state.step = 4;
              state.data.servidores_ids = [];
              state.data.servidores_names = [];
              
              const servers = await listServers();
              const buttons = servers.map(s => ([{ 
                text: `${s.name} (R$ ${Number(s.valor).toFixed(2)})`, 
                callback_data: `serv:${s.id}:${s.name}` 
              }]));
              
              await sendMessage(chatId, "<b>Passo 4: Seleção de Servidor</b>\nClique nos servidores para adicionar:", {
                inline_keyboard: buttons
              });
              return new Response('OK');
            }

            // Passo 4: Seleção de Servidores
            if (state.step === 4) {
              if (data.startsWith('serv:')) {
                const [_, servId, servName] = data.split(':');
                if (!state.data.servidores_ids.includes(servId)) {
                  state.data.servidores_ids.push(servId);
                  state.data.servidores_names.push(servName);
                }
                
                await sendMessage(chatId, `✅ Servidor <b>${servName}</b> adicionado.\n\nDeseja adicionar mais um ou avançar?`, {
                  inline_keyboard: [
                    [{ text: "➕ Adicionar Outro Servidor", callback_data: "serv_outro" }],
                    [{ text: "▶️ Avançar", callback_data: "serv_avancar" }]
                  ]
                });
              } else if (data === 'serv_outro') {
                const servers = await listServers();
                const buttons = servers.map(s => ([{ 
                  text: `${s.name} (R$ ${Number(s.valor).toFixed(2)})`, 
                  callback_data: `serv:${s.id}:${s.name}` 
                }]));
                await sendMessage(chatId, "Selecione outro servidor:", { inline_keyboard: buttons });
              } else if (data === 'serv_avancar') {
                if (state.data.servidores_ids.length === 0) {
                  await sendMessage(chatId, "⚠️ Selecione pelo menos um servidor antes de avançar.");
                  return new Response('OK');
                }
                state.step = 5;
                await sendMessage(chatId, "<b>Passo 5: Informar Desconto</b>\nInforme o valor do desconto recorrente em R$ (ex: 5 ou 0 para nenhum):");
              }
              return new Response('OK');
            }

            // Passo 6: Ajuste de Vencimento
            if (state.step === 6) {
              const currentVencTemp = state.data.vencimento_temp;
              if (typeof currentVencTemp !== 'string') return new Response('OK');
              const currentVenc = new Date(currentVencTemp);
              
              if (data === 'venc_m5') currentVenc.setDate(currentVenc.getDate() - 5);
              if (data === 'venc_m1') currentVenc.setDate(currentVenc.getDate() - 1);
              if (data === 'venc_p1') currentVenc.setDate(currentVenc.getDate() + 1);
              if (data === 'venc_p5') currentVenc.setDate(currentVenc.getDate() + 5);
              
              if (data.startsWith('venc_')) {
                state.data.vencimento_temp = currentVenc.toISOString();
                const brDate = formatBRDate(currentVenc);
                await sendMessage(chatId, `Ajuste a data de vencimento:\n📅 <b>${brDate}</b>`, {
                  inline_keyboard: [
                    [
                      { text: "➖ 5 dias", callback_data: "venc_m5" },
                      { text: "➖ 1 dia", callback_data: "venc_m1" },
                      { text: "➕ 1 dia", callback_data: "venc_p1" },
                      { text: "➕ 5 dias", callback_data: "venc_p5" }
                    ],
                    [{ text: `📅 Confirmar Data: ${brDate}`, callback_data: "venc_confirmar" }],
                    [{ text: "✏️ Digitar Outra Data", callback_data: "venc_digitar" }]
                  ]
                });
              } else if (data === 'venc_confirmar') {
                state.data.vencimento = (state.data.vencimento_temp as string).split('T')[0];
                state.step = 7; // Resumo
                
                const resumo = `📝 <b>RESUMO DO CADASTRO:</b>\n` +
                  `• Nome: ${state.data.nome}\n` +
                  `• WhatsApp: ${state.data.whatsapp}\n` +
                  `• Plano: ${state.data.plano_name}\n` +
                  `• Servidores: ${state.data.servidores_names.join(', ')}\n` +
                  `• Desconto: R$ ${Number(state.data.desconto).toFixed(2)}\n` +
                  `• Vencimento: ${formatBRDate(new Date(state.data.vencimento + 'T12:00:00'))}\n\n` +
                  `Deseja confirmar o cadastro?`;
                
                await sendMessage(chatId, resumo, {
                  inline_keyboard: [
                    [{ text: "✅ Confirmar e Cadastrar", callback_data: "cad_confirmar" }],
                    [{ text: "❌ Cancelar", callback_data: "cad_cancelar" }]
                  ]
                });
              } else if (data === 'venc_digitar') {
                await sendMessage(chatId, "Digite a data no formato DD/MM/AAAA:");
              }
              return new Response('OK');
            }

            // Confirmação Final
            if (data === 'cad_confirmar') {
              try {
                await createClientWithDetails({
                  nome: state.data.nome,
                  whatsapp: state.data.whatsapp === '0' ? '' : state.data.whatsapp,
                  plano_id: state.data.plano_id,
                  servidores_ids: state.data.servidores_ids,
                  desconto: state.data.desconto,
                  vencimento: state.data.vencimento
                });
                await sendMessage(chatId, "✅ <b>Cliente cadastrado com sucesso!</b>", clientsSubMenu);
                userState.delete(chatId);
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao salvar cliente no banco de dados.");
              }
            } else if (data === 'cad_cancelar') {
              await sendMessage(chatId, "❌ Cadastro cancelado.", clientsSubMenu);
              userState.delete(chatId);
            }

            return new Response('OK');
          }

          const message = body.message;
          if (!message) return new Response('OK');

          const chatId = message.chat.id;
          const text = message.text;

          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          const state = userState.get(chatId);

          if (text === '/start' || text === '🔙 Voltar') {
            userState.delete(chatId);
            await sendMessage(chatId, "Menu Principal:", mainMenu);
            return new Response('OK');
          }

          // Handlers de Fluxo de Texto
          if (state?.action === 'cadastrar_cliente') {
            if (state.step === 1) {
              state.data.nome = text;
              state.step = 2;
              await sendMessage(chatId, "<b>Passo 2: WhatsApp</b>\nDigite o WhatsApp com DDD ou envie 0:");
              return new Response('OK');
            }
            if (state.step === 2) {
              state.data.whatsapp = text;
              state.step = 3;
              const plans = await listPlans();
              const buttons = plans.map(p => ([{ 
                text: `${p.name} - R$ ${Number(p.price).toFixed(2)}`, 
                callback_data: `plano:${p.id}:${p.name}` 
              }]));
              await sendMessage(chatId, "<b>Passo 3: Seleção de Plano</b>\nSelecione o plano desejado:", {
                inline_keyboard: buttons
              });
              return new Response('OK');
            }
            if (state.step === 5) {
              const desc = parseFloat(text.replace(',', '.'));
              if (isNaN(desc)) {
                await sendMessage(chatId, "Valor inválido. Digite o desconto (ex: 5 ou 0):");
                return new Response('OK');
              }
              state.data.desconto = desc;
              state.step = 6;
              
              // Calcular vencimento padrão (+30 dias)
              const vDate = new Date();
              vDate.setDate(vDate.getDate() + 30);
              state.data.vencimento_temp = vDate.toISOString();
              
              const brDate = formatBRDate(vDate);
              await sendMessage(chatId, `<b>Passo 6: Seleção de Vencimento</b>\nAjuste a data de vencimento:\n📅 <b>${brDate}</b>`, {
                inline_keyboard: [
                  [
                    { text: "➖ 5 dias", callback_data: "venc_m5" },
                    { text: "➖ 1 dia", callback_data: "venc_m1" },
                    { text: "➕ 1 dia", callback_data: "venc_p1" },
                    { text: "➕ 5 dias", callback_data: "venc_p5" }
                  ],
                  [{ text: `📅 Confirmar Data: ${brDate}`, callback_data: "venc_confirmar" }],
                  [{ text: "✏️ Digitar Outra Data", callback_data: "venc_digitar" }]
                ]
              });
              return new Response('OK');
            }
            if (state.step === 6) {
              // Entrada manual de data
              const isoDate = parseBRDate(text);
              if (!isoDate) {
                await sendMessage(chatId, "⚠️ Formato inválido. Digite a data como DD/MM/AAAA:");
                return new Response('OK');
              }
              state.data.vencimento_temp = new Date(isoDate + 'T12:00:00').toISOString();
              const brDate = formatBRDate(new Date(state.data.vencimento_temp));
              await sendMessage(chatId, `Data atualizada:\n📅 <b>${brDate}</b>`, {
                inline_keyboard: [
                  [
                    { text: "➖ 5 dias", callback_data: "venc_m5" },
                    { text: "➖ 1 dia", callback_data: "venc_m1" },
                    { text: "➕ 1 dia", callback_data: "venc_p1" },
                    { text: "➕ 5 dias", callback_data: "venc_p5" }
                  ],
                  [{ text: `📅 Confirmar Data: ${brDate}`, callback_data: "venc_confirmar" }],
                  [{ text: "✏️ Digitar Outra Data", callback_data: "venc_digitar" }]
                ]
              });
              return new Response('OK');
            }
          }

          // Menu Principal e Comandos
          switch (text) {
            case '👥 Clientes':
              await sendMessage(chatId, "Área de Clientes:", clientsSubMenu);
              break;
            case '📊 Resumo':
              const summary = await getClientsSummary();
              await sendMessage(chatId, `📊 <b>RESUMO DE CLIENTES</b>\n• Total: ${summary.total}\n• Ativos: ${summary.ativos}\n• Vencidos: ${summary.vencidos}`, clientsSubMenu);
              break;
            case '➕ Novo Cliente':
              userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
              await sendMessage(chatId, "<b>Passo 1: Nome</b>\nDigite o nome do cliente:");
              break;
            case '💰 Financeiro':
              const fin = await getFinancialSummary();
              await sendMessage(chatId, `💰 <b>RESUMO FINANCEIRO</b>\n\n📈 Entradas: R$ ${fin.entradas.toFixed(2)}\n📉 Saídas: R$ ${fin.saidas.toFixed(2)}\n💎 Lucro: R$ ${fin.lucro.toFixed(2)}`, mainMenu);
              break;
            case '🖥️ Servidores':
              const servers = await listServers();
              const sText = servers.map(s => `• ${s.name}: R$ ${Number(s.valor).toFixed(2)}`).join('\n');
              await sendMessage(chatId, `🖥️ <b>Servidores:</b>\n\n${sText || 'Nenhum'}`, mainMenu);
              break;
            case '📋 Planos':
              const plans = await listPlans();
              const pText = plans.map(p => `• ${p.name}: R$ ${Number(p.price).toFixed(2)}`).join('\n');
              await sendMessage(chatId, `📋 <b>Planos:</b>\n\n${pText || 'Nenhum'}`, mainMenu);
              break;
            default:
              if (!state) await sendMessage(chatId, "Comando não reconhecido.", mainMenu);
          }

          return new Response('OK');
        } catch (error) {
          console.error("Erro no Webhook:", error);
          return new Response('OK');
        }
      },
    },
  },
});