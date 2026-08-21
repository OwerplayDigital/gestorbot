import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { toZonedTime, format as formatTz } from 'date-fns-tz';
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
  renewClient,
  getClientById,
  BOT_TEMPLATES

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
  action: 'cadastrar_cliente' | 'buscar_cliente' | 'editar_vencimento' | 'editar_desconto' | 'editar_whatsapp' | 'renovar_cliente' | 'editar_servidor' | 'editar_nome';
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
  inline_keyboard: [
    [{ text: 'Vence Hoje', callback_data: 'vencendo_hoje' }, { text: 'Vencidos', callback_data: 'vencidos' }],
    [{ text: 'Cadastrar', callback_data: 'new_client_fast' }, { text: 'Buscar', callback_data: 'search_direct' }],
    [{ text: 'Servidores', callback_data: 'list_servers' }, { text: 'Planos', callback_data: 'list_plans' }],
    [{ text: 'Financeiro', callback_data: 'financeiro' }, { text: 'Painel', url: 'https://gestorbot.lovable.app' }]
  ]
};

function formatBRDate(date: Date): string {
  const brDate = toZonedTime(date, 'America/Sao_Paulo');
  return formatTz(brDate, 'dd/MM/yyyy');
}

function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 0) return '';
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

async function sendClientCompact(chatId: number, c: any) {
  const plan = c.plans;
  const brDate = formatBRDate(new Date(c.vencimento + 'T12:00:00'));
  const primeiroNome = (c.nome || 'Cliente').trim().split(' ')[0];
  const paymentUrl = `https://gestorbot.lovable.app/pagar/${c.id}`;
  
  // Garantindo que a mensagem use quebras duplas e encoding correto
  const msgCobranca = BOT_TEMPLATES.COBRANCA(primeiroNome || '', brDate || '', paymentUrl || '');
  const encodedCobranca = encodeURIComponent(msgCobranca);
  
  const phone = cleanPhone(c.whatsapp || '');
  
  const nomeServidor = c.servidores?.[0]?.name || c.servidor?.name || c.servidor || c.nome_servidor || 'Não informado';
  const msg = `👤 Cliente: ${c.nome}\n` +
              `📅 Vencimento: ${brDate}\n` +
              `🖥️ Servidor: ${nomeServidor}`;
  
  await sendMessage(chatId, msg, {
    inline_keyboard: [
      [
        { text: "Cobrar", url: `https://wa.me/${phone}?text=${encodedCobranca}` },
        { text: "Renovar", callback_data: `renew_init:${c.id}` }
      ]
    ]
  });
}

async function sendClientFicha(chatId: number, c: any) {
  const plan = c.plans;
  const planName = plan?.name || 'N/A';
  const planPrice = Number(plan?.price || plan?.preco || plan?.valor || 0);
  const discount = Number(c.desconto || 0);
  const valorFinal = Math.max(0, planPrice - discount).toFixed(2).replace('.', ',');
  
  const servers = c.servidores || [];
  const serverNames = servers.map((s: any) => s.name).join(', ') || 'N/A';
  
  const brDate = formatBRDate(new Date(c.vencimento + 'T12:00:00'));
  const primeiroNome = (c.nome || 'Cliente').trim().split(' ')[0];
  
  const paymentUrl = `https://gestorbot.lovable.app/pagar/${c.id}`;
  
  // Garantindo que as mensagens usem quebras duplas e encoding correto
  const msgCobranca = BOT_TEMPLATES.COBRANCA(primeiroNome || '', brDate || '', paymentUrl || '');
  const encodedCobranca = encodeURIComponent(msgCobranca);
  
  const msgConfirmacao = BOT_TEMPLATES.CONFIRMACAO(primeiroNome || '', brDate || '');
  const encodedConfirmacao = encodeURIComponent(msgConfirmacao);
  
  const phone = cleanPhone(c.whatsapp || '');
  const msg = `👤 Cliente: ${c.nome}\n` +
              `📅 Vencimento: ${brDate}\n` +
              `🖥️ Servidor: ${serverNames}\n` +
              `WhatsApp: ${c.whatsapp || 'N/A'}\n` +
              `Plano: ${planName}\n` +
              `Valor: R$ ${valorFinal}\n` +
              `Status: ${c.status}`;
  
  await sendMessage(chatId, msg, {
    inline_keyboard: [
      [
        { text: "Cobrar", url: `https://wa.me/${phone}?text=${encodedCobranca}` },
        { text: "Confirmar", url: `https://wa.me/${phone}?text=${encodedConfirmacao}` }
      ],
      [
        { text: "Renovar", callback_data: `renew_init:${c.id}` },
        { text: "Editar", callback_data: `edit_client_full:${c.id}` }
      ],
      [
        { text: "Excluir", callback_data: `delete_client_confirm:${c.id}` }
      ]

    ]
  });
}

function parseBRDate(brDate: string): string | null {
  const parts = brDate.split('/');
  if (parts.length !== 3) return null;
  const d = parts[0], m = parts[1], y = parts[2];
  if (!d || !m || !y) return null;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return isNaN(date.getTime()) ? null : (date.toISOString().split('T')[0] ?? null);
}

async function handleTelegramEvent(body: any): Promise<Response> {
  try {
    if (!body) return new Response('OK');
          
          if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const fromId = cb.from.id; // ID do remetente
            const messageId = cb.message.message_id;
            const data = cb.data;

            // Segurança: Verificar se o remetente é o administrador autorizado
            const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
            if (!allowedId || fromId.toString() !== allowedId) {
              console.warn(`Tentativa de interação bloqueada: User ID ${fromId}`);
              return new Response('Unauthorized', { status: 403 });
            }
            const state = userState.get(chatId);
            
            // Responder imediatamente para parar o loading do Telegram
            await answerCallbackQuery(cb.id);
            
            if (data === 'search_retry' || data === 'new_client_fast' || data === 'search_direct') {
              if (data === 'new_client_fast') {
                userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
                await sendMessage(chatId, "Nome do cliente:");
                return new Response('OK');
              }
              await setUserStep(chatId, 'aguardando_busca');
              await sendMessage(chatId, "Digite o nome (ou parte do nome) do cliente:");
              return new Response('OK');
            }

            if (data === 'back_to_main') {
              await sendMessage(chatId, "GESTOR IPTV | Painel de Controle\nSelecione a opção desejada abaixo:", mainMenu);
              return new Response('OK');
            }

            if (data === 'financeiro') {
              const userId = await getAuthorizedUser(chatId);
              if (userId) {
                const summary = await getFinancialSummary();
                const clients = await getClientsSummary();
                const msg = `📊 <b>FINANCEIRO:</b>\n` +
                            `• Entradas: R$ ${summary.entradas.toFixed(2).replace('.', ',')}\n` +
                            `• Saídas: R$ ${summary.saidas.toFixed(2).replace('.', ',')}\n` +
                            `• Lucro: R$ ${summary.lucro.toFixed(2).replace('.', ',')}\n\n` +
                            `📊 <b>RESUMO DE CLIENTES:</b>\n` +
                            `• Total: ${clients.total}\n` +
                            `• Ativos: ${clients.ativos}\n` +
                            `• Vencidos: ${clients.vencidos}`;
                
                await sendMessage(chatId, msg, {
                  inline_keyboard: [
                    [{ text: "Atualizar", callback_data: "financeiro" }],
                    [{ text: "Zerar Financeiro", callback_data: "reset_global_confirm" }]
                  ]
                });
              }
              return new Response('OK');
            }

            if (data === 'vencendo_hoje') {
              const { toZonedTime } = await import('date-fns-tz');
              const hoje = toZonedTime(new Date(), 'America/Sao_Paulo');
              hoje.setHours(0, 0, 0, 0);

              const { data, error } = await supabaseAdmin
                .from("clientes")
                .select(`
                  id, nome, whatsapp, vencimento, status, desconto, plano_id, servidores_ids,
                  plans:plans(id, name, price)
                `);

              if (error || !Array.isArray(data)) {
                await sendMessage(chatId, '⚠️ Erro ao buscar dados no banco.');
                return new Response('OK');
              }

              const parseDate = (d: any): Date | null => {
                if (!d || typeof d !== 'string' || !d.trim()) return null;
                const clean = d.trim();
                if (clean.includes('/')) {
                  const parts = clean.split('/').map(Number);
                  if (parts.length !== 3) return null;
                  const day = parts[0], month = parts[1], year = parts[2];
                  if (day === undefined || month === undefined || year === undefined) return null;
                  return new Date(year, month - 1, day);
                }
                if (clean.includes('-')) {
                  const parts = clean.split('-').map(Number);
                  if (parts.length !== 3) return null;
                  const p0 = parts[0], p1 = parts[1], p2 = parts[2];
                  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
                  if (p0 > 1000) return new Date(p0, p1 - 1, p2); // YYYY-MM-DD
                  return new Date(p2, p1 - 1, p0); // DD-MM-YYYY
                }
                return null;
              };

              const clientsToday = data.filter(c => {
                const vencDate = parseDate(c.vencimento);
                if (!vencDate) return false;
                vencDate.setHours(0, 0, 0, 0);
                return vencDate.getDate() === hoje.getDate() && 
                       vencDate.getMonth() === hoje.getMonth() && 
                       vencDate.getFullYear() === hoje.getFullYear();
              });

              if (clientsToday.length === 0) {
                await sendMessage(chatId, 'Ninguém vence hoje.');
              } else {
                for (const c of clientsToday) {
                  // Enriquecimento de servidores
                  let servidores: any[] = [];
                  if (c.servidores_ids && c.servidores_ids.length > 0) {
                    const { data: sData } = await supabaseAdmin
                      .from('servidores_iptv')
                      .select('id, name')
                      .in('id', c.servidores_ids);
                    servidores = sData || [];
                  }
                  await sendClientCompact(chatId, { ...c, servidores });
                }
              }
              return new Response('OK');
            }

            if (data === 'vencidos') {
              const { toZonedTime, format: formatTz } = await import('date-fns-tz');
              const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
              nowBr.setHours(0, 0, 0, 0);
              const todayStr = formatTz(nowBr, 'dd/MM/yyyy');

              const { data: clients, error } = await supabaseAdmin
                .from("clientes")
                .select("*, servidores_ids");

              if (error) {
                console.error("Erro ao buscar vencidos no webhook:", error);
                await sendMessage(chatId, `⚠️ Erro no Banco: ${error.message}`);
                return new Response('OK');
              }

              if (!Array.isArray(clients)) {
                await sendMessage(chatId, 'Erro ao buscar dados no banco: Resposta inválida.');
                return new Response('OK');
              }

              const parseDate = (d: any): Date | null => {
                if (!d || typeof d !== 'string' || !d.trim()) return null;
                const clean = d.trim();
                if (clean.includes('/')) {
                  const parts = clean.split('/').map(Number);
                  const day = parts[0], month = parts[1], year = parts[2];
                  if (day === undefined || month === undefined || year === undefined) return null;
                  return (day && month && year) ? new Date(year, month - 1, day) : null;
                }
                if (clean.includes('-')) {
                  const parts = clean.split('-').map(Number);
                  if (parts.length !== 3) return null;
                  const p0 = parts[0], p1 = parts[1], p2 = parts[2];
                  if (p0 === undefined || p1 === undefined || p2 === undefined) return null;
                  if (p0 > 1000) return new Date(p0, p1 - 1, p2); // YYYY-MM-DD
                  return new Date(p2, p1 - 1, p0); // DD-MM-YYYY
                }
                return null;
              };

              const expired = (clients || [])
                .filter((c: any) => {
                  const vDate = parseDate(c.vencimento);
                  return vDate && vDate < nowBr;
                })
                .sort((a: any, b: any) => {
                  const dA = parseDate(a.vencimento);
                  const dB = parseDate(b.vencimento);
                  return (dA?.getTime() || 0) - (dB?.getTime() || 0);
                });

              // Buscar nomes dos servidores para os vencidos
              const expiredWithServers = await Promise.all(expired.map(async (c: any) => {
                let servidores: any[] = [];
                if (c.servidores_ids && c.servidores_ids.length > 0) {
                  const { data: sData } = await supabaseAdmin
                    .from('servidores_iptv')
                    .select('id, name')
                    .in('id', c.servidores_ids);
                  servidores = sData || [];
                }
                return { ...c, servidores };
              }));

              if (expiredWithServers.length === 0) {
                await sendMessage(chatId, `🔍 [SISTEMA] Hoje: ${todayStr} | Vencidos encontrados: 0\n\nNenhum cliente vencido.`);
              } else {
                await sendMessage(chatId, `🔍 [SISTEMA] Hoje: ${todayStr} | Vencidos encontrados: ${expiredWithServers.length}`);
                for (const c of expiredWithServers) {
                  // Reusando a lógica de exibição compacta
                  const vDate = parseDate(c.vencimento);
                  const brDate = vDate ? formatBRDate(vDate) : 'N/A';
                  const primeiroNome = (c.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
                  const paymentUrl = `https://gestorbot.lovable.app/pagar/${c.id}`;
                  
                  // Garantindo que a mensagem use quebras duplas e encoding correto
                  const msgCobranca = BOT_TEMPLATES.COBRANCA(primeiroNome, brDate, paymentUrl);
                  const encodedCobranca = encodeURIComponent(msgCobranca);
                  
                  const phone = cleanPhone(c.whatsapp || '');
                  
                  const nomeServidor = (c as any).servidores?.[0]?.name || (c as any).servidor?.name || (c as any).servidor || (c as any).nome_servidor || 'Não informado';

                  const msg = `👤 Cliente: ${c.nome}\n` +
                              `📅 Vencimento: ${brDate}\n` +
                              `🖥️ Servidor: ${nomeServidor}`;
                  
                  await sendMessage(chatId, msg, {
                    inline_keyboard: [
                      [
                        { text: "Cobrar", url: `https://wa.me/${phone}?text=${encodedCobranca}` },
                        { text: "Renovar", callback_data: `renew_init:${c.id}` }
                      ]
                    ]
                  });
                }
              }
              return new Response('OK');
            }

            if (data === 'list_servers') {
              const servers = await listServers();
              const sMsg = servers.map(s => `• ${s.name}: R$ ${s.valor}`).join('\n') || 'Nenhum servidor.';
              await sendMessage(chatId, `<b>SERVIDORES:</b>\n${sMsg}`);
              return new Response('OK');
            }

            if (data === 'list_plans') {
              const plans = await listPlans();
              const pMsg = plans.map(p => `• ${p.name}: R$ ${p.price}`).join('\n') || 'Nenhum plano.';
              await sendMessage(chatId, `<b>PLANOS:</b>\n${pMsg}`);
              return new Response('OK');
            }

            if (data.startsWith('delete_client_confirm:')) {
              const id = data.split(':')[1];
              await editMessage(chatId, cb.message.message_id, "⚠️ <b>CONFIRMAÇÃO</b>\n\nDeseja realmente EXCLUIR este cliente? Todos os dados e histórico serão removidos.", {
                inline_keyboard: [
                  [{ text: "✅ Sim, Excluir", callback_data: `delete_client_exec:${id}` }],
                  [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]

                ]
              });
              return new Response('OK');
            }

            if (data.startsWith('delete_client_exec:')) {
              const id = data.split(':')[1];
              const userId = await getAuthorizedUser(chatId);
              if (id && userId) {
                await supabaseAdmin.from('clientes').delete().eq('id', id).eq('user_id', userId);
                await sendMessage(chatId, "✅ Cliente excluído com sucesso.");
                await sendMessage(chatId, "GESTOR IPTV | Painel de Controle\nSelecione a opção desejada abaixo:", mainMenu);
              }
              return new Response('OK');
            }

            // Callbacks Globais e Fluxo de Detalhes
            
            if (data.startsWith('client_menu:')) {
              const id = data.split(':')[1];
              if (id) {
                const client = await getClientById(id);
                if (client) {
                  await sendClientFicha(chatId, client);
                }
              }
              return new Response('OK');
            }

            if (data.startsWith('edit_client_full:')) {
              const id = data.split(':')[1];
              if (id) {
                await editMessage(chatId, messageId, "🛡️ <b>MENU DE EDIÇÃO</b>\nO que você deseja alterar?", {
                  inline_keyboard: [
                    [{ text: "📝 Nome", callback_data: `edit_name:${id}` }, { text: "📱 WhatsApp", callback_data: `edit_wpp:${id}` }],
                    [{ text: "📅 Vencimento", callback_data: `edit_venc:${id}` }, { text: "📡 Servidor", callback_data: `edit_serv:${id}` }],
                    [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]
                  ]
                });
              }
              return new Response('OK');
            }

            if (data.startsWith('edit_name:')) {
              userState.set(chatId, { action: 'editar_nome' as any, step: 1, data: { id: data.split(':')[1] } as any });
              await sendMessage(chatId, "Digite o novo nome do cliente:");
              return new Response('OK');
            }

            // Callbacks Globais e Fluxo de Detalhes (continuação)


            if (data.startsWith('view_client:')) {
               const nome = data.split(':')[1];
               if (!nome) return new Response('OK');
               const results = await findClientByName(nome);
               const c = results[0];
               if (c) {
                  await sendClientFicha(chatId, c);
               }
            }
            else if (data.startsWith('reset_fin_confirm:')) {
              const id = data.split(':')[1];
              await editMessage(chatId, messageId, "CONFIRMAÇÃO CRÍTICA\n\nTem certeza que deseja resetar o financeiro deste cliente? Essa ação não pode ser desfeita e limpará todo o histórico de transações e renovações.", {
                inline_keyboard: [
                  [{ text: "Sim, Resetar Agora", callback_data: `reset_fin_exec:${id}` }],
                  [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]
                ]
              });

            }
            else if (data.startsWith('reset_fin_exec:')) {
              const id = data.split(':')[1];
              const userId = await getAuthorizedUser(chatId);
              if (id && userId) {
                const { resetFinancialHistory } = await import('@/lib/telegram.server');
                await resetFinancialHistory(id, userId);
                await sendMessage(chatId, "<b>Financeiro Resetado!</b>\nO histórico deste cliente foi limpo com sucesso.");
              }
            }
            else if (data === 'reset_global_confirm') {
              await editMessage(chatId, messageId, "ATENÇÃO: Deseja realmente resetar e zerar todos os registros e relatórios do financeiro? Essa ação não afetará o cadastro dos seus clientes, mas limpará o histórico financeiro do mês.", {
                inline_keyboard: [
                  [{ text: "Sim, Zerar Financeiro", callback_data: "reset_global_exec" }]
                ]
              });
            }
            else if (data === 'reset_global_exec') {
              const userId = await getAuthorizedUser(chatId);
              if (userId) {
                const { resetGlobalFinancialHistory } = await import('@/lib/telegram.server');
                await resetGlobalFinancialHistory(userId);
                await editMessage(chatId, messageId, "Financeiro geral resetado com sucesso!");
                await sendMessage(chatId, "GESTOR IPTV | Painel de Controle\nSelecione a opção desejada abaixo:", mainMenu);
              }
            }
            else if (data.startsWith('renew_init:')) {
              const id = data.split(':')[1];
              const { data: c } = await supabaseAdmin.from('clientes').select('vencimento').eq('id', id).single();
              if (c) {
                const currentVenc = new Date(c.vencimento + 'T12:00:00');
                const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
                const today = new Date(nowBr);
                today.setHours(0, 0, 0, 0);
                
                // Regra visual no Bot: se vencido, Hoje + 30. Se em dia, Vencimento + 30.
                const baseDate = currentVenc < today ? today : currentVenc;
                const nextMonth = new Date(baseDate);
                nextMonth.setDate(nextMonth.getDate() + 30);
                userState.set(chatId, { action: 'renovar_cliente', step: 1, data: { id, vencimento_temp: nextMonth.toISOString() } as any });
                const br = formatBRDate(nextMonth);
                await editMessage(chatId, messageId, `<b>Renovação de Assinatura</b>\nSugestão de novo vencimento: <b>${br}</b>`, {
                  inline_keyboard: [
                    [{ text: "-5d", callback_data: "erenew_m5" }, { text: "-1d", callback_data: "erenew_m1" }, { text: "+1d", callback_data: "erenew_p1" }, { text: "+5d", callback_data: "erenew_p5" }],
                    [{ text: `Confirmar Renovação: ${br}`, callback_data: "erenew_confirm" }],
                    [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]
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
                    [{ text: `Confirmar Renovação: ${br}`, callback_data: "erenew_confirm" }],
                    [{ text: "🔙 Voltar", callback_data: `client_menu:${state.data.id}` }]
                  ]

                });
              } else if (data === 'erenew_confirm') {
                const isoDate = state.data.vencimento_temp?.split('T')[0];
                const userId = await getAuthorizedUser(chatId);
                if (isoDate && state.data.id && userId) {
                  const updated = await renewClient(state.data.id, isoDate, userId);
                  const br = formatBRDate(new Date(isoDate + 'T12:00:00'));
                  const primeiroNome = updated.nome ? updated.nome.trim().split(' ')[0] : 'Cliente';
                  const phone = cleanPhone(updated.whatsapp || '');
                  const encodedReceipt = encodeURIComponent(
                    `📌 Obrigado pela confiança!\n\n` +
                    `✅ Sua assinatura foi renovada com sucesso!\n\n` +
                    `PRÓXIMO VENCIMENTO: (${br})`
                  );
                  await sendMessage(chatId, `<b>Assinatura Renovada!</b>\nO caixa foi atualizado automaticamente.`, {
                    inline_keyboard: [
                    [{ text: "Enviar Comprovante", url: `https://wa.me/${phone}?text=${encodedReceipt}` }],
                    [{ text: "🔙 Voltar ao Menu", callback_data: `client_menu:${state.data.id}` }]
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
                    [{ text: `Salvar: ${br}`, callback_data: "evenc_save" }],
                    [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]
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
            else if (data.startsWith('edit_serv:')) {
              const id = data.split(':')[1];
              userState.set(chatId, { action: 'editar_servidor', step: 1, data: { id } as any });
              const servers = await listServers();
              const buttons = servers.map(s => ([{ text: s.name, callback_data: `eserv_sel:${s.id}:${s.name}` }]));
              buttons.push([{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]);
              await editMessage(chatId, messageId, "<b>Alterar Servidor</b>\nSelecione o novo servidor para este cliente:", { inline_keyboard: buttons });

            }
            else if (state?.action === 'editar_servidor' && data.startsWith('eserv_sel:')) {
              const [_, servId, servName] = data.split(':');
              if (servId && state.data.id) {
                const { data: updated } = await supabaseAdmin
                  .from('clientes')
                  .update({ servidores_ids: [servId] })
                  .eq('id', state.data.id)
                  .select('nome')
                  .single();
                
                await editMessage(chatId, messageId, `Servidor atualizado para <b>${servName}</b>!`, mainMenu);
                if (updated) await sendMessage(chatId, `Visualize novamente: /view_${updated.nome.replace(/\s+/g, '_')}`);
              }
              userState.delete(chatId);
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
                    [{ text: `Salvar: ${br}`, callback_data: "evenc_save" }],
                    [{ text: "🔙 Voltar", callback_data: `client_menu:${state.data.id}` }]
                  ]

                });
              } else if (data === 'evenc_save') {
                const isoDate = state.data.vencimento_temp?.split('T')[0];
                if (isoDate && state.data.id) {
                  const { data: updated } = await supabaseAdmin.from('clientes').update({ vencimento: isoDate }).eq('id', state.data.id).select('nome').single();
                  await sendMessage(chatId, `Vencimento atualizado!`, mainMenu);
                  if (updated) await sendMessage(chatId, `Visualize novamente: /view_${updated.nome.replace(/\s+/g, '_')}`);
                }
                userState.delete(chatId);
              }
            }
            else if (data === 'back_to_main') {
               await sendMessage(chatId, "Clientes:", mainMenu);
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
                    [{ text: "Adicionar Outro", callback_data: "serv_outro" }],
                    [{ text: "Avançar", callback_data: "serv_avancar" }]
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
                    [{ text: `Confirmar Data: ${br}`, callback_data: "venc_confirm" }],
                    [{ text: "Digitar Outra Data", callback_data: "venc_edit" }]
                  ]
                });
              } else if (data === 'venc_confirm') {
                const vt = state.data.vencimento_temp;
                if (!vt) return new Response('OK');
                const isoDate = vt.split('T')[0];
                if (isoDate) state.data.vencimento = isoDate;
                
                state.step = 7;
                const brDate = formatBRDate(new Date((state.data.vencimento || '') + 'T12:00:00'));
                const resumo = `<b>RESUMO DO CADASTRO:</b>\n` +
                  `Nome: ${state.data.nome}\n` +
                  `WhatsApp: ${state.data.whatsapp === '0' ? 'Não informado' : state.data.whatsapp}\n` +
                  `Plano: ${state.data.plano_name}\n` +
                  `Servidores: ${state.data.servidores_names?.join(', ')}\n` +
                  `Desconto: R$ ${state.data.desconto?.toFixed(2)}\n` +
                  `Vencimento: ${brDate}\n\n` +
                  `Deseja confirmar o cadastro?`;
                
                await sendMessage(chatId, resumo, {
                  inline_keyboard: [
                    [{ text: "Confirmar e Cadastrar", callback_data: "f_ok" }],
                    [{ text: "Cancelar", callback_data: "f_no" }]
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
                const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', d.plano_id!).single();
                const planAny = plan as any;
                const planPrice = Number(planAny?.price || planAny?.preco || planAny?.valor || 0);
                const valorFinal = Math.max(0, planPrice - (d.desconto || 0)).toFixed(2).replace('.', ',');

                const primeiroNome = d.nome ? d.nome.trim().split(' ')[0] : 'Cliente';
                const encodedMsg = encodeURIComponent(
                  `Olá ${primeiroNome}, bom dia!\n\n` +
                  `Seu plano de TV vence hoje: *(${brDate})*\n\n` +
                  `Atenção: na data do vencimento, o sistema poderá bloquear automaticamente a qualquer momento. Renove assim que possível.\n\n` +
                  `Favor enviar comprovante\n\n` +
                  `Acesse o link seguro para copiar o PIX e renovar:\n` +
                  `https://gestorbot.lovable.app/renovar/${newClient.id}`
                );

                 const phone = cleanPhone(d.whatsapp === '0' ? '' : (d.whatsapp || ''));
                 const successMsg = `<b>CLIENTE CADASTRADO COM SUCESSO!</b>\n\n` +
                                    `Nome: ${d.nome}\n` +
                                    `WhatsApp: ${d.whatsapp === '0' ? 'Não informado' : d.whatsapp}\n` +
                                    `Vencimento: ${brDate}\n` +
                                    `Valor Final: R$ ${valorFinal}`;

                await editMessage(chatId, messageId, successMsg, {
                  inline_keyboard: [
                    [{ text: "Cobrar Cliente", url: `https://wa.me/${phone}?text=${encodedMsg}` }],
                    [{ text: "Ver Ficha", callback_data: `view_client:${d.nome}` }],
                    [{ text: "Novo Cliente", callback_data: "new_client_fast" }]
                  ]
                });
                userState.delete(chatId);
              } catch (err: any) {
                console.error("Erro ao cadastrar cliente via Telegram:", err);
                await sendMessage(chatId, `❌ <b>Erro ao cadastrar:</b>\n${err.message || 'Erro desconhecido'}`);
              }
            } else if (data === 'f_no') {
              userState.delete(chatId);
              await editMessage(chatId, messageId, "❌ Cadastro cancelado.", mainMenu);
            }

            return new Response('OK');
          }

          const msg = body.message;
          if (!msg) return new Response('OK');
          const chatId = msg.chat.id;
          const text = msg.text || '';
          
          // Tentar vínculo automático se for o admin
          await (await import('@/lib/telegram.server')).bindAdminIfMatching(chatId);

          const userId = await getAuthorizedUser(chatId);
          if (!userId) return new Response('OK');

          const dbStep = await getUserStep(chatId);
          const state = userState.get(chatId);
          const lowerText = text.toLowerCase();

          // 1. Verificar se é uma resposta de busca (step persistente no banco)
          if (dbStep === 'aguardando_busca' && !text.startsWith('/')) {
            await setUserStep(chatId, null);
            const termo = text.trim();
            const results = await findClientByName(termo);

            if (results.length === 0) {
              await sendMessage(chatId, `Nenhum cliente encontrado com o nome '${termo}'.`, {
                inline_keyboard: [[{ text: "Buscar Novamente", callback_data: "search_retry" }]]
              });
            } else {
              for (const c of results) await sendClientFicha(chatId, c);
            }
            return new Response('OK');
          }

          // 2. Comandos do Menu (/comando) e Texto Normal
          if (text.startsWith('/')) {
            const command = lowerText.split(' ')[0];
            
            if (command === '/start') {
              userState.delete(chatId);
              await sendMessage(chatId, "GESTOR IPTV | Painel de Controle\nSelecione a opção desejada abaixo:", mainMenu);
              return new Response('OK');
            }

            // Mapeamento direto de comandos para handlers de callback já existentes
            if (command === '/hoje') {
               const event = { callback_query: { id: 'cmd', data: 'vencendo_hoje', message: msg } };
               return handleTelegramEvent(event);
            }

            if (command === '/vencidos') {
               const event = { callback_query: { id: 'cmd', data: 'vencidos', message: msg } };
               return handleTelegramEvent(event);
            }

            if (command === '/cadastrar') {
               const event = { callback_query: { id: 'cmd', data: 'new_client_fast', message: msg } };
               return handleTelegramEvent(event);
            }

            if (command === '/buscar') {
              const termo = text.includes(' ') ? text.split(' ').slice(1).join(' ').trim() : '';
              if (!termo) {
                await setUserStep(chatId, 'aguardando_busca');
                await sendMessage(chatId, "Digite o nome (ou parte do nome) do cliente:");
              } else {
                const results = await findClientByName(termo);
                if (results.length === 0) {
                  await sendMessage(chatId, `Nenhum cliente encontrado com o nome '${termo}'.`, {
                    inline_keyboard: [[{ text: "Buscar Novamente", callback_data: "search_retry" }]]
                  });
                } else {
                  for (const c of results) await sendClientFicha(chatId, c);
                }
              }
              return new Response('OK');
            }

            if (command === '/servidores') {
               const event = { callback_query: { id: 'cmd', data: 'list_servers', message: msg } };
               return handleTelegramEvent(event);
            }

            if (command === '/planos') {
               const event = { callback_query: { id: 'cmd', data: 'list_plans', message: msg } };
               return handleTelegramEvent(event);
            }

            if (command === '/financeiro') {
               const event = { callback_query: { id: 'cmd', data: 'financeiro', message: msg } };
               return handleTelegramEvent(event);
            }
          }

          if (text === 'Voltar') {
            userState.delete(chatId);
            await sendMessage(chatId, "GESTOR IPTV | Painel de Controle\nSelecione a opção desejada abaixo:", mainMenu);
            return new Response('OK');
          }

          if (state?.action === 'editar_nome') {
            if (state.data.id && text.trim()) {
              await supabaseAdmin.from('clientes').update({ nome: text.trim() }).eq('id', state.data.id);
              await sendMessage(chatId, "✅ Nome atualizado com sucesso!");
              const client = await getClientById(state.data.id);
              if (client) await sendClientFicha(chatId, client);
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (state?.action === 'editar_desconto') {
            const val = parseFloat(text.replace(',', '.'));
            if (!isNaN(val) && state.data.id) {
              await supabaseAdmin.from('clientes').update({ desconto: val }).eq('id', state.data.id);
              await sendMessage(chatId, "Desconto atualizado!");
              const client = await getClientById(state.data.id);
              if (client) await sendClientFicha(chatId, client);
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (state?.action === 'editar_whatsapp') {
            if (state.data.id) {
              await supabaseAdmin.from('clientes').update({ whatsapp: text }).eq('id', state.data.id);
              await sendMessage(chatId, "WhatsApp atualizado!");
              const client = await getClientById(state.data.id);
              if (client) await sendClientFicha(chatId, client);
            }
            userState.delete(chatId);
            return new Response('OK');
          }



          if (state?.action === 'buscar_cliente') {
            const results = await findClientByName(text);
            if (results.length === 0) {
              await sendMessage(chatId, "Nenhum cliente encontrado.");
            } else {
              for (const c of results) {
                await sendClientFicha(chatId, c);
              }
            }
            userState.delete(chatId);
            return new Response('OK');
          }

          if (text.startsWith('/view_')) {
            const nome = text.replace('/view_', '').replace(/_/g, ' ');
            const results = await findClientByName(nome);
            const c = results[0];
            if (c) {
              await sendClientFicha(chatId, c);
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
    }
    return new Response('OK');
  } catch (e) {
    console.error("ERRO WEBHOOK TELEGRAM:", e);
    return new Response('OK');
  }
}

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        const body = await request.json();
        
        // Segurança: Verificar se o remetente é o administrador autorizado
        const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
        const fromId = body.message?.from?.id || body.callback_query?.from?.id;
        
        if (fromId && (!allowedId || fromId.toString() !== allowedId)) {
          console.warn(`Interação bloqueada: User ID ${fromId}`);
          return new Response('Unauthorized', { status: 403 });
        }
        
        return handleTelegramEvent(body);
      }
    }
  }
});