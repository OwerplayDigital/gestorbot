import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { 
  getAuthorizedUser, 
  listPlans, 
  listServers, 
  getClientsSummary, 
  getFinancialSummary,
  createClientWithDetails,
  findClientByName,
  setUserStep,
  getUserStep,
  listExpiredClients,
  listClientsExpiringToday,
  renewClient
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
  action: 'cadastrar_cliente' | 'buscar_cliente' | 'editar_vencimento' | 'editar_desconto' | 'editar_whatsapp' | 'renovar_cliente';
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

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      }),
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
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
      }),
    });
  } catch (err) {
    console.error("Erro ao responder callback query:", err);
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
  return isNaN(date.getTime()) ? null : (date.toISOString().split('T')[0] ?? null);
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
            const messageId = cb.message.message_id;
            const data = cb.data;
            const state = userState.get(chatId);
            
            // Responder imediatamente para parar o loading do Telegram
            await answerCallbackQuery(cb.id);
            
            if (data === 'search_retry' || data === 'new_client_fast') {
              if (data === 'new_client_fast') {
                userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
                await sendMessage(chatId, "Nome do cliente:");
                return new Response('OK');
              }
              await setUserStep(chatId, 'aguardando_busca');
              await sendMessage(chatId, "🔍 Digite o nome (ou parte do nome) do cliente:");
              return new Response('OK');
            }

            if (data === 'back_to_main') {
              await sendMessage(chatId, "Menu:", mainMenu);
              return new Response('OK');
            }

            // Callbacks Globais e Fluxo de Detalhes

            if (data.startsWith('view_client:')) {
               const nome = data.split(':')[1];
               if (!nome) return new Response('OK');
               const results = await findClientByName(nome);
               const c = results[0];
               if (c) {
                  const plan = (c as any).plans;
                  const planName = plan?.name || 'N/A';
                  const planPrice = Number(plan?.price || plan?.preco || plan?.valor || 0);
                  const discount = Number(c.desconto || 0);
                  const valorFinal = Math.max(0, planPrice - discount).toFixed(2).replace('.', ',');
                  
                  const brDate = formatBRDate(new Date(c.vencimento + 'T12:00:00'));
                  const first_name = c.nome.split(' ')[0];
                  const encodedMsg = encodeURIComponent(
                    `Olá ${first_name}, bom dia!\n` +
                    `Seu plano de TV vence hoje: *(${brDate})*\n` +
                    `⚠️ *Atenção:* na data do vencimento, o sistema poderá bloquear automaticamente a qualquer momento. Renove assim que possível.\n` +
                    `*DADOS PARA PAGAMENTO:*\n` +
                    `Valor: *R$ ${valorFinal}*\n` +
                    `Pix: *82iptv@gmail.com*\n` +
                    `Banco: Nubank\n` +
                    `Nome: Diego Felix Owerney\n` +
                    `✅ *Favor enviar comprovante*`
                  );
                  const msg = `👤 <b>FICHA DO CLIENTE:</b>\n` +
                              `• Nome: ${c.nome}\n` +
                              `• WhatsApp: ${c.whatsapp || 'N/A'}\n` +
                              `• Plano: ${planName}\n` +
                              `• Desconto: R$ ${c.desconto?.toFixed(2)}\n` +
                              `• Vencimento: ${brDate}\n` +
                              `• Status: ${c.status}`;
                  await sendMessage(chatId, msg, {
                    inline_keyboard: [
                      [{ text: "📲 Enviar Cobrança WhatsApp", url: `https://wa.me/55${c.whatsapp}?text=${encodedMsg}` }],
                      [{ text: "🔄 Renovar", callback_data: `renew_init:${c.id}` }],
                      [{ text: "✏️ Alterar Vencimento", callback_data: `edit_venc:${c.id}` }],
                      [{ text: "🏷️ Alterar Desconto", callback_data: `edit_desc:${c.id}` }],
                      [{ text: "📱 Alterar WhatsApp", callback_data: `edit_wpp:${c.id}` }],
                      [{ text: "🔙 Voltar", callback_data: "voltar_clients" }]
                    ]
                  });
               }
            }
            else if (data.startsWith('renew_init:')) {
              const id = data.split(':')[1];
              const { data: c } = await supabaseAdmin.from('clientes').select('vencimento').eq('id', id).single();
              if (c) {
                const nextMonth = new Date(c.vencimento + 'T12:00:00');
                nextMonth.setDate(nextMonth.getDate() + 30);
                userState.set(chatId, { action: 'renovar_cliente', step: 1, data: { id, vencimento_temp: nextMonth.toISOString() } as any });
                const br = formatBRDate(nextMonth);
                await editMessage(chatId, messageId, `<b>Renovação de Assinatura</b>\nSugestão de novo vencimento: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "erenew_m5" }, { text: "-1d", callback_data: "erenew_m1" }, { text: "+1d", callback_data: "erenew_p1" }, { text: "+5d", callback_data: "erenew_p5" }],
                    [{ text: `📅 Confirmar Renovação: ${br}`, callback_data: "erenew_confirm" }],
                    [{ text: "❌ Cancelar", callback_data: "voltar_clients" }]
                  ]
                });
              }
            }
            else if (state?.action === 'renovar_cliente') {
              const currentIso = state.data.vencimento_temp;
              if (!currentIso) return new Response('OK');
              const d = new Date(currentIso);
              
              if (data === 'erenew_m5') d.setDate(d.getDate() - 5);
              else if (data === 'erenew_m1') d.setDate(d.getDate() - 1);
              else if (data === 'erenew_p1') d.setDate(d.getDate() + 1);
              else if (data === 'erenew_p5') d.setDate(d.getDate() + 5);
              
              if (data.startsWith('erenew_') && data !== 'erenew_confirm') {
                state.data.vencimento_temp = d.toISOString();
                const br = formatBRDate(d);
                await editMessage(chatId, messageId, `<b>Renovação de Assinatura</b>\nNovo vencimento: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "erenew_m5" }, { text: "-1d", callback_data: "erenew_m1" }, { text: "+1d", callback_data: "erenew_p1" }, { text: "+5d", callback_data: "erenew_p5" }],
                    [{ text: `📅 Confirmar Renovação: ${br}`, callback_data: "erenew_confirm" }],
                    [{ text: "❌ Cancelar", callback_data: "voltar_clients" }]
                  ]
                });
              } else if (data === 'erenew_confirm') {
                const isoDate = state.data.vencimento_temp?.split('T')[0];
                const userId = await getAuthorizedUser(chatId);
                if (isoDate && state.data.id && userId) {
                  const updated = await renewClient(state.data.id, isoDate, userId);
                  const br = formatBRDate(new Date(isoDate + 'T12:00:00'));
                  const encodedReceipt = encodeURIComponent(
                    `📌 Obrigado pela confiança!\n` +
                    `✅ Sua assinatura foi renovada com sucesso!\n` +
                    `🗓️ PRÓXIMO VENCIMENTO:*(${br})*`
                  );
                  await sendMessage(chatId, `✅ <b>Assinatura Renovada!</b>\nO caixa foi atualizado automaticamente.`, {
                    inline_keyboard: [
                      [{ text: "📲 Enviar Comprovante WhatsApp", url: `https://wa.me/55${updated.whatsapp}?text=${encodedReceipt}` }],
                      [{ text: "🔙 Voltar", callback_data: "voltar_clients" }]
                    ]
                  });
                }
                userState.delete(chatId);
              }
            }

            else if (data.startsWith('edit_venc:')) {
              const id = data.split(':')[1];
              const { data: c } = await supabaseAdmin.from('clientes').select('vencimento').eq('id', id).single();
              if (c) {
                userState.set(chatId, { action: 'editar_vencimento', step: 1, data: { id, vencimento_temp: new Date(c.vencimento + 'T12:00:00').toISOString() } as any });
                const br = formatBRDate(new Date(c.vencimento + 'T12:00:00'));
                await editMessage(chatId, messageId, `<b>Alterar Vencimento</b>\nAtual: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "evenc_m5" }, { text: "-1d", callback_data: "evenc_m1" }, { text: "+1d", callback_data: "evenc_p1" }, { text: "+5d", callback_data: "evenc_p5" }],
                    [{ text: `📅 Salvar: ${br}`, callback_data: "evenc_save" }],
                    [{ text: "❌ Cancelar", callback_data: "voltar_clients" }]
                  ]
                });
              }
            }
            else if (data.startsWith('edit_desc:')) {
              userState.set(chatId, { action: 'editar_desconto', step: 1, data: { id: data.split(':')[1] } as any });
              await sendMessage(chatId, "Digite o novo valor do desconto (R$):");
            }
            else if (data.startsWith('edit_wpp:')) {
              userState.set(chatId, { action: 'editar_whatsapp', step: 1, data: { id: data.split(':')[1] } as any });
              await sendMessage(chatId, "Digite o novo WhatsApp com DDD:");
            }
            else if (state?.action === 'editar_vencimento') {
              const currentIso = state.data.vencimento_temp;
              if (!currentIso) return new Response('OK');
              const d = new Date(currentIso);
              
              if (data === 'evenc_m5') d.setDate(d.getDate() - 5);
              else if (data === 'evenc_m1') d.setDate(d.getDate() - 1);
              else if (data === 'evenc_p1') d.setDate(d.getDate() + 1);
              else if (data === 'evenc_p5') d.setDate(d.getDate() + 5);
              
              if (data.startsWith('evenc_') && data !== 'evenc_save') {
                state.data.vencimento_temp = d.toISOString();
                const br = formatBRDate(d);
                await editMessage(chatId, messageId, `<b>Alterar Vencimento</b>\nNovo: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "evenc_m5" }, { text: "-1d", callback_data: "evenc_m1" }, { text: "+1d", callback_data: "evenc_p1" }, { text: "+5d", callback_data: "evenc_p5" }],
                    [{ text: `📅 Salvar: ${br}`, callback_data: "evenc_save" }],
                    [{ text: "❌ Cancelar", callback_data: "voltar_clients" }]
                  ]
                });
              } else if (data === 'evenc_save') {
                const isoDate = state.data.vencimento_temp?.split('T')[0];
                if (isoDate && state.data.id) {
                  const { data: updated } = await supabaseAdmin.from('clientes').update({ vencimento: isoDate }).eq('id', state.data.id).select('nome').single();
                  await sendMessage(chatId, `✅ Vencimento atualizado!`, clientsSubMenu);
                  if (updated) await sendMessage(chatId, `Visualize novamente: /view_${updated.nome.replace(/\s+/g, '_')}`);
                }
                userState.delete(chatId);
              }
            }
            else if (data === 'voltar_clients') {
               await sendMessage(chatId, "Clientes:", clientsSubMenu);
               userState.delete(chatId);
            }
            else if (state && state.action === 'cadastrar_cliente' && state.step === 3 && data.startsWith('plano:')) {
              const parts = data.split(':');
              const id = parts[1] ?? '';
              const name = parts[2] ?? '';
              state.data.plano_id = id;
              state.data.plano_name = name;
              state.step = 4;
              state.data.servidores_ids = [];
              state.data.servidores_names = [];
              const servers = await listServers();
              const buttons = servers.map(s => ([{ text: s.name, callback_data: `serv:${s.id}:${s.name}` }]));
              await sendMessage(chatId, "<b>Passo 4: Seleção de Servidor</b>\nSelecione os servidores:", { inline_keyboard: buttons });
            } 
            else if (state && state.action === 'cadastrar_cliente' && state.step === 4) {
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
            else if (state && state.action === 'cadastrar_cliente' && state.step === 6) {
              const currentIso = state.data.vencimento_temp;
              if (!currentIso) return new Response('OK');
              const d = new Date(currentIso);
              
              if (data === 'venc_m5') d.setDate(d.getDate() - 5);
              else if (data === 'venc_m1') d.setDate(d.getDate() - 1);
              else if (data === 'venc_p1') d.setDate(d.getDate() + 1);
              else if (data === 'venc_p5') d.setDate(d.getDate() + 5);
              
              if (data.startsWith('venc_') && data !== 'venc_confirm' && data !== 'venc_edit') {
                state.data.vencimento_temp = d.toISOString();
                const br = formatBRDate(d);
                await editMessage(chatId, messageId, `<b>Passo 6: Seleção de Vencimento</b>\nVencimento: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "venc_m5" }, { text: "-1d", callback_data: "venc_m1" }, { text: "+1d", callback_data: "venc_p1" }, { text: "+5d", callback_data: "venc_p5" }],
                    [{ text: `📅 Confirmar Data: ${br}`, callback_data: "venc_confirm" }],
                    [{ text: "✏️ Digitar Outra Data", callback_data: "venc_edit" }]
                  ]
                });
              } else if (data === 'venc_confirm') {
                const vt = state.data.vencimento_temp;
                if (!vt) return new Response('OK');
                const isoDate = vt.split('T')[0];
                if (isoDate) state.data.vencimento = isoDate;
                
                state.step = 7;
                const brDate = formatBRDate(new Date((state.data.vencimento || '') + 'T12:00:00'));
                const resumo = `📝 <b>RESUMO DO CADASTRO:</b>\n` +
                  `• Nome: ${state.data.nome}\n` +
                  `• WhatsApp: ${state.data.whatsapp === '0' ? 'Não informado' : state.data.whatsapp}\n` +
                  `• Plano: ${state.data.plano_name}\n` +
                  `• Servidores: ${state.data.servidores_names?.join(', ')}\n` +
                  `• Desconto: R$ ${state.data.desconto?.toFixed(2)}\n` +
                  `• Vencimento: ${brDate}\n\n` +
                  `Deseja confirmar o cadastro?`;
                
                await sendMessage(chatId, resumo, {
                  inline_keyboard: [
                    [{ text: "✅ Confirmar e Cadastrar", callback_data: "f_ok" }],
                    [{ text: "❌ Cancelar", callback_data: "f_no" }]
                  ]
                });
              } else if (data === 'venc_edit') {
                await sendMessage(chatId, "Digite a data no formato DD/MM/AAAA:");
              }
            }
            else if (data === 'f_ok' && state && state.action === 'cadastrar_cliente') {
              const d = state.data;
              try {
                if (!d.nome || !d.whatsapp || !d.plano_id || !d.servidores_ids || d.desconto === undefined || !d.vencimento) {
                  throw new Error("Dados incompletos no estado da conversa.");
                }

                // Conversão de formato de data (DD/MM/AAAA ou ISO -> YYYY-MM-DD)
                const finalDate = d.vencimento.includes('T') ? d.vencimento.split('T')[0] : d.vencimento;

                const userId = await getAuthorizedUser(chatId);
                if (!userId) throw new Error("Usuário não autorizado.");

                const newClient = await createClientWithDetails({
                  user_id: userId,
                  nome: d.nome,
                  whatsapp: d.whatsapp === '0' ? '' : d.whatsapp,
                  plano_id: d.plano_id!,
                  servidores_ids: d.servidores_ids!,
                  desconto: d.desconto!,
                  vencimento: finalDate!
                });

                const brDate = formatBRDate(new Date(finalDate + 'T12:00:00'));
                const { data: plan } = await supabaseAdmin.from('plans').select('price, preco, valor').eq('id', d.plano_id!).single();
                const planPrice = Number(plan?.price || plan?.preco || plan?.valor || 0);
                const valorFinal = Math.max(0, planPrice - (d.desconto || 0)).toFixed(2).replace('.', ',');

                const successMsg = `✅ <b>CLIENTE CADASTRADO COM SUCESSO!</b>\n\n` +
                                   `👤 <b>Nome:</b> ${d.nome}\n` +
                                   `📱 <b>WhatsApp:</b> ${d.whatsapp === '0' ? 'Não informado' : d.whatsapp}\n` +
                                   `📅 <b>Vencimento:</b> ${brDate}\n` +
                                   `💰 <b>Valor Final:</b> R$ ${valorFinal}`;

                await editMessage(chatId, messageId, successMsg, {
                  inline_keyboard: [
                    [{ text: "👤 Ver Ficha", callback_data: `view_client:${d.nome}` }],
                    [{ text: "➕ Novo Cliente", callback_data: "new_client_fast" }],
                    [{ text: "🏠 Menu Principal", callback_data: "back_to_main" }]
                  ]
                });
                userState.delete(chatId);
              } catch (err: any) {
                console.error("Erro ao cadastrar cliente via Telegram:", err);
                await sendMessage(chatId, `❌ <b>Erro ao cadastrar:</b>\n${err.message || 'Erro desconhecido'}`);
              }
            } else if (data === 'f_no') {
              userState.delete(chatId);
              await editMessage(chatId, messageId, "❌ Cadastro cancelado.", clientsSubMenu);
            }

            return new Response('OK');
          }

          const msg = body.message;
          if (!msg) return new Response('OK');
          const chatId = msg.chat.id;
          const text = msg.text || '';
          
          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          const dbStep = await getUserStep(chatId);
          const state = userState.get(chatId);

          // Comando /buscar simplificado
          const lowerText = text.toLowerCase();

          // 1. Verificar se é uma resposta de busca (step persistente no banco)
          if (dbStep === 'aguardando_busca' && !text.startsWith('/')) {
            await setUserStep(chatId, null);
            const termo = text.trim();
            const results = await findClientByName(termo);

            if (results.length === 0) {
              await sendMessage(chatId, `❌ Nenhum cliente encontrado com o nome '${termo}'.`, {
                inline_keyboard: [
                  [{ text: "🔍 Buscar Novamente", callback_data: "search_retry" }],
                  [{ text: "🔙 Voltar", callback_data: "voltar_clients" }]
                ]
              });
            } else {
              const buttons = results.map(c => ([{ text: `👤 ${c.nome}`, callback_data: `view_client:${c.nome}` }]));
              await sendMessage(chatId, `🔍 Resultados para '${termo}':`, { inline_keyboard: buttons });
            }
            return new Response('OK');
          }

          // 2. Comandos e Menu
          if (lowerText.startsWith('/buscar')) {
            const termo = text.includes(' ') ? text.split(' ').slice(1).join(' ').trim() : '';
            if (!termo) {
              await setUserStep(chatId, 'aguardando_busca');
              await sendMessage(chatId, "🔍 Digite o nome (ou parte do nome) do cliente:");
              return new Response('OK');
            }

            const results = await findClientByName(termo);
            if (results.length === 0) {
              await sendMessage(chatId, `❌ Nenhum cliente encontrado com o nome '${termo}'.`, {
                inline_keyboard: [
                  [{ text: "🔍 Buscar Novamente", callback_data: "search_retry" }],
                  [{ text: "🔙 Voltar", callback_data: "voltar_clients" }]
                ]
              });
            } else {
              const buttons = results.map(c => ([{ text: `👤 ${c.nome}`, callback_data: `view_client:${c.nome}` }]));
              await sendMessage(chatId, `🔍 Resultados para '${termo}':`, { inline_keyboard: buttons });
            }
            return new Response('OK');
          }


          if (text === '/start' || text === '🔙 Voltar') {
            userState.delete(chatId);
            await sendMessage(chatId, "Menu:", mainMenu);
            return new Response('OK');
          }

          if (state?.action === 'editar_desconto') {
            const val = parseFloat(text.replace(',', '.'));
            if (!isNaN(val) && state.data.id) {
              await supabaseAdmin.from('clientes').update({ desconto: val }).eq('id', state.data.id);
              await sendMessage(chatId, "✅ Desconto atualizado!", clientsSubMenu);
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (state?.action === 'editar_whatsapp') {
            if (state.data.id) {
              await supabaseAdmin.from('clientes').update({ whatsapp: text }).eq('id', state.data.id);
              await sendMessage(chatId, "✅ WhatsApp atualizado!", clientsSubMenu);
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (state?.action === 'buscar_cliente') {
            const results = await findClientByName(text);
            if (results.length === 0) {
              await sendMessage(chatId, "Nenhum cliente encontrado.", clientsSubMenu);
            } else {
              const buttons = results.map(c => ([{ text: c.nome, callback_data: `view_client:${c.nome}` }]));
              await sendMessage(chatId, "Selecione o cliente:", { inline_keyboard: buttons });
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (text.startsWith('/view_')) {
            const nome = text.replace('/view_', '').replace(/_/g, ' ');
            const results = await findClientByName(nome);
            const c = results[0];
            if (c) {
              const plan = (c as any).plans;
              const planName = plan?.name || 'N/A';
              const planPrice = Number(plan?.price || plan?.preco || plan?.valor || 0);
              const discount = Number(c.desconto || 0);
              const valorFinal = Math.max(0, planPrice - discount).toFixed(2).replace('.', ',');
              
              const msg = `👤 <b>FICHA DO CLIENTE:</b>\n` +
                          `• Nome: ${c.nome}\n` +
                          `• WhatsApp: ${c.whatsapp || 'N/A'}\n` +
                          `• Plano: ${planName}\n` +
                          `• Desconto: R$ ${c.desconto?.toFixed(2)}\n` +
                          `• Valor Final: R$ ${valorFinal}\n` +
                          `• Vencimento: ${formatBRDate(new Date(c.vencimento + 'T12:00:00'))}\n` +
                          `• Status: ${c.status}`;
              await sendMessage(chatId, msg, {
                inline_keyboard: [
                  [{ text: "✏️ Alterar Vencimento", callback_data: `edit_venc:${c.id}` }],
                  [{ text: "🏷️ Alterar Desconto", callback_data: `edit_desc:${c.id}` }],
                  [{ text: "📱 Alterar WhatsApp", callback_data: `edit_wpp:${c.id}` }],
                  [{ text: "🔙 Voltar", callback_data: "voltar_clients" }]
                ]
              });
            }
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
              await sendMessage(chatId, `<b>Passo 6: Seleção de Vencimento</b>\nVencimento: <b>${br}</b>`, {
                inline_keyboard: [
                  [{ text: "-5d", callback_data: "venc_m5" }, { text: "-1d", callback_data: "venc_m1" }, { text: "+1d", callback_data: "venc_p1" }, { text: "+5d", callback_data: "venc_p5" }],
                  [{ text: `📅 Confirmar Data: ${br}`, callback_data: "venc_confirm" }],
                  [{ text: "✏️ Digitar Outra Data", callback_data: "venc_edit" }]
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
            case '🖥️ Servidores':
              const servers = await listServers();
              const sMsg = servers.map(s => `• ${s.name}: R$ ${s.valor}`).join('\n') || 'Nenhum servidor.';
              await sendMessage(chatId, `🖥️ <b>SERVIDORES:</b>\n${sMsg}`, mainMenu);
              break;
            case '📋 Planos':
              const plans = await listPlans();
              const pMsg = plans.map(p => `• ${p.name}: R$ ${p.price}`).join('\n') || 'Nenhum plano.';
              await sendMessage(chatId, `📋 <b>PLANOS:</b>\n${pMsg}`, mainMenu);
              break;
            case '📊 Resumo':
              const summary = await getClientsSummary();
              await sendMessage(chatId, `📊 <b>RESUMO:</b>\nTotal: ${summary.total}\nAtivos: ${summary.ativos}\nVencidos: ${summary.vencidos}`, clientsSubMenu);
              break;
            case '📅 Vencendo Hoje':
              const today = await listClientsExpiringToday();
              const tMsg = today.map((c: any) => `• ${c.nome}`).join('\n') || 'Ninguém vence hoje.';
              await sendMessage(chatId, `📅 <b>VENCENDO HOJE:</b>\n${tMsg}`, clientsSubMenu);
              break;
            case '❌ Vencidos':
              const expired = await listExpiredClients();
              const eMsg = expired.map((c: any) => `• ${c.nome} (${formatBRDate(new Date(c.vencimento + 'T12:00:00'))})`).join('\n') || 'Nenhum vencido.';
              await sendMessage(chatId, `❌ <b>VENCIDOS:</b>\n${eMsg}`, clientsSubMenu);
              break;
            case '➕ Novo Cliente':
              userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
              await sendMessage(chatId, "Nome do cliente:");
              break;
            case '🔍 Buscar Cliente':
              await setUserStep(chatId, 'aguardando_busca');
              await sendMessage(chatId, "🔍 Digite o nome (ou parte do nome) do cliente:");
              break;
            case '💰 Financeiro':
              const f = await getFinancialSummary();
              await sendMessage(chatId, `💰 <b>FINANCEIRO:</b>\nEntradas: R$ ${f.entradas.toFixed(2)}\nSaídas: R$ ${f.saidas.toFixed(2)}\nLucro: R$ ${f.lucro.toFixed(2)}`, mainMenu);
              break;
          }

          return new Response('OK');
        } catch (e) {
          console.error("ERRO WEBHOOK TELEGRAM:", e);
          return new Response('OK');
        }
      }
    }
  }
});