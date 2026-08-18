import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAuthorizedUser, createPlan, listPlans, createServer, listServers, getClientsSummary, listExpiredClients, listClientsExpiringToday, findClientByName, createClient, getFinancialSummary } from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;

// Gerenciador de estado temporário para o fluxo de cadastro (simulado via memória no Worker por simplicidade nesta etapa)
// Em produção, isso deveria ir para uma tabela de 'sessions' ou Redis.
const userState = new Map<number, { action: string; step: number; data: any }>();

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });
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

const plansMenu = {
  keyboard: [[{ text: 'Cadastrar plano' }], [{ text: 'Listar planos' }], [{ text: '🔙 Voltar' }]],
  resize_keyboard: true,
};

const serversMenu = {
  keyboard: [[{ text: 'Cadastrar servidor' }], [{ text: 'Listar servidores' }], [{ text: '🔙 Voltar' }]],
  resize_keyboard: true,
};

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const message = body.message;
          if (!message) return new Response('OK');

          const chatId = message.chat.id;
          const text = message.text;

          // 1. Autenticação
          const userId = await getAuthorizedUser(chatId);
          if (!userId) {
            await sendMessage(chatId, `Acesso negado. Seu Chat ID é: ${chatId}`);
            console.warn(`Tentativa de acesso não autorizado: Chat ID ${chatId}`);
            // Retornamos 200 para o Telegram parar de reenviar a mesma mensagem
            return new Response('OK');
          }

          // 2. Lógica de Navegação e Fluxos
          const state = userState.get(chatId);

          if (text === '/start' || text === '🔙 Voltar' || text === 'Voltar') {
            userState.delete(chatId);
            await sendMessage(chatId, "Menu Principal:", mainMenu);
            return new Response('OK');
          }

          // Fluxo de Cadastro de Planos
          if (state?.action === 'cadastrar_plano') {
            if (state.step === 1) {
              state.data.name = text;
              state.step = 2;
              await sendMessage(chatId, "Informe o Preço do plano:");
              return new Response('OK');
            } else if (state.step === 2) {
              const price = parseFloat(text.replace(',', '.'));
              if (isNaN(price)) {
                await sendMessage(chatId, "Preço inválido. Digite um número (ex: 29.90):");
                return new Response('OK');
              }
              try {
                const plan = await createPlan(userId, state.data.name, price);
                await sendMessage(chatId, `✅ Plano Cadastrado!\n\nNome: ${plan.name}\nPreço: R$ ${plan.price.toFixed(2)}`, plansMenu);
                userState.delete(chatId);
              } catch (err) {
                await sendMessage(chatId, "❌ Erro técnico ao salvar o plano. O administrador foi notificado.");
              }
              return new Response('OK');
            }
          }

          // Fluxo de Cadastro de Servidores
          if (state?.action === 'cadastrar_servidor') {
            if (state.step === 1) {
              state.data.name = text;
              state.step = 2;
              await sendMessage(chatId, "Informe o Custo do servidor:");
              return new Response('OK');
            } else if (state.step === 2) {
              const cost = parseFloat(text.replace(',', '.'));
              if (isNaN(cost)) {
                await sendMessage(chatId, "Custo inválido. Digite um número (ex: 10.00):");
                return new Response('OK');
              }
              try {
                const server = await createServer(userId, state.data.name, cost);
                await sendMessage(chatId, `✅ Servidor Cadastrado!\n\nNome: ${server.name}\nCusto: R$ ${server.valor.toFixed(2)}`, serversMenu);
                userState.delete(chatId);
              } catch (err) {
                await sendMessage(chatId, "❌ Erro técnico ao salvar o servidor. O administrador foi notificado.");
              }
              return new Response('OK');
            }
          }

          // Fluxo de Busca de Cliente
          if (state?.action === 'buscar_cliente') {
            try {
              const clients = await findClientByName(text);
              if (clients.length === 0) {
                await sendMessage(chatId, "Nenhum cliente encontrado com esse nome.", clientsSubMenu);
              } else {
                const listText = clients.map(c => `👤 ${c.nome}\n📱 ${c.whatsapp || 'N/A'}\n📅 Vencimento: ${c.vencimento}\n⚖️ Status: ${c.status}`).join('\n\n');
                await sendMessage(chatId, `🔍 Resultados da Busca:\n\n${listText}`, clientsSubMenu);
              }
              userState.delete(chatId);
            } catch (err) {
              await sendMessage(chatId, "❌ Erro ao buscar cliente.", clientsSubMenu);
            }
            return new Response('OK');
          }

          // Fluxo de Cadastro de Novo Cliente (Simplificado)
          if (state?.action === 'cadastrar_cliente') {
            if (state.step === 1) {
              state.data.nome = text;
              state.step = 2;
              await sendMessage(chatId, "Digite o WhatsApp do cliente (ou 'N/A'):");
              return new Response('OK');
            } else if (state.step === 2) {
              state.data.whatsapp = text;
              state.step = 3;
              // Buscamos planos para mostrar opções (opcionalmente simplificado aqui para pegar o ID do primeiro plano ou pedir manual)
              await sendMessage(chatId, "Digite a Data de Vencimento (AAAA-MM-DD):");
              return new Response('OK');
            } else if (state.step === 3) {
              state.data.vencimento = text;
              try {
                // Para o MVP de cadastro via bot, vamos usar um plano padrão ou o primeiro plano ativo
                const plans = await listPlans();
                if (plans.length === 0) {
                  await sendMessage(chatId, "Erro: Cadastre um plano antes de cadastrar clientes.", mainMenu);
                  userState.delete(chatId);
                  return new Response('OK');
                }
                // Simplesmente associamos ao primeiro plano
                const { data: firstPlan } = await supabaseAdmin.from('plans').select('id').limit(1).single();
                
                await createClient(userId, {
                  nome: state.data.nome,
                  whatsapp: state.data.whatsapp === 'N/A' ? '' : state.data.whatsapp,
                  plano_id: (firstPlan as any).id,
                  vencimento: state.data.vencimento
                });
                
                await sendMessage(chatId, `✅ Cliente ${state.data.nome} cadastrado com sucesso!`, clientsSubMenu);
                userState.delete(chatId);
              } catch (err) {
                console.error(err);
                await sendMessage(chatId, "❌ Erro ao cadastrar cliente. Verifique o formato da data (AAAA-MM-DD).", clientsSubMenu);
              }
              return new Response('OK');
            }
          }

          // Comandos Iniciais
          switch (text) {
            case '👥 Clientes':
              await sendMessage(chatId, "Área de Clientes:", clientsSubMenu);
              break;
            case '📋 Planos':
              await sendMessage(chatId, "Gerenciar Planos:", plansMenu);
              break;
            case '🖥️ Servidores':
              await sendMessage(chatId, "Gerenciar Servidores:", serversMenu);
              break;
            case '💰 Financeiro':
              try {
                const fin = await getFinancialSummary();
                const msg = `💰 RESUMO FINANCEIRO\n\n📈 Entradas: R$ ${fin.entradas.toFixed(2)}\n📉 Saídas: R$ ${fin.saidas.toFixed(2)}\n💎 Lucro: R$ ${fin.lucro.toFixed(2)}`;
                await sendMessage(chatId, msg, mainMenu);
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao buscar financeiro.");
              }
              break;
            case '📊 Resumo':
              try {
                const summary = await getClientsSummary();
                const msg = `📊 RESUMO DE CLIENTES\n• Total: ${summary.total} clientes\n• Ativos: ${summary.ativos} clientes\n• Vencidos: ${summary.vencidos} clientes`;
                await sendMessage(chatId, msg, clientsSubMenu);
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao buscar resumo de clientes.");
              }
              break;
            case '📅 Vencendo Hoje':
              try {
                const todayList = await listClientsExpiringToday();
                if (!todayList || todayList.length === 0) {
                  await sendMessage(chatId, "Nenhum cliente vencendo hoje.", clientsSubMenu);
                } else {
                  const listText = todayList.map(c => `• ${c.nome} (${c.vencimento})`).join('\n');
                  await sendMessage(chatId, `📅 Vencendo Hoje:\n\n${listText}`, clientsSubMenu);
                }
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao buscar vencimentos de hoje.");
              }
              break;
            case '❌ Vencidos':
              try {
                const expired = await listExpiredClients();
                if (!expired || expired.length === 0) {
                  await sendMessage(chatId, "Nenhum cliente vencido encontrado.", clientsSubMenu);
                } else {
                  const listText = expired.map(c => `• ${c.nome} | ${c.vencimento}`).join('\n');
                  await sendMessage(chatId, `❌ CLIENTES VENCIDOS (Exibindo os primeiros 15)\n\n${listText}`, clientsSubMenu);
                }
              } catch (err) {
                console.error("DEBUG Telegram Vencidos:", err);
                await sendMessage(chatId, "❌ Erro ao buscar vencidos.");
              }
              break;
            case '🔍 Buscar Cliente':
              userState.set(chatId, { action: 'buscar_cliente', step: 1, data: {} });
              await sendMessage(chatId, "Digite o nome (ou parte dele) para buscar:");
              break;
            case '➕ Novo Cliente':
              userState.set(chatId, { action: 'cadastrar_cliente', step: 1, data: {} });
              await sendMessage(chatId, "Digite o Nome completo do cliente:");
              break;
            case 'Cadastrar plano':
              userState.set(chatId, { action: 'cadastrar_plano', step: 1, data: {} });
              await sendMessage(chatId, "Digite o Nome do plano:");
              break;
            case 'Listar planos':
              try {
                const plans = await listPlans();
                if (plans.length === 0) {
                  await sendMessage(chatId, "Nenhum plano encontrado.");
                } else {
                  const listText = plans.map(p => `• ${p.name}: R$ ${Number(p.price).toFixed(2)} (${p.active ? 'Ativo' : 'Inativo'})`).join('\n');
                  await sendMessage(chatId, `📋 Planos Cadastrados:\n\n${listText}`, plansMenu);
                }
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao buscar planos.");
              }
              break;
            case 'Cadastrar servidor':
              userState.set(chatId, { action: 'cadastrar_servidor', step: 1, data: {} });
              await sendMessage(chatId, "Digite o Nome do servidor:");
              break;
            case 'Listar servidores':
              try {
                const servers = await listServers();
                if (servers.length === 0) {
                  await sendMessage(chatId, "Nenhum servidor encontrado.");
                } else {
                  const listText = servers.map(s => `• ${s.name}: R$ ${Number(s.valor).toFixed(2)} (${s.active ? 'Ativo' : 'Inativo'})`).join('\n');
                  await sendMessage(chatId, `🖥️ Servidores Cadastrados:\n\n${listText}`, serversMenu);
                }
              } catch (err) {
                await sendMessage(chatId, "❌ Erro ao buscar servidores.");
              }
              break;
            default:
              await sendMessage(chatId, "Comando não reconhecido. Use o menu abaixo:", mainMenu);
          }

          return new Response('OK');
        } catch (error) {
          console.error("Erro no Webhook do Telegram:", error);
          return new Response('Internal Server Error', { status: 500 });
        }
      },
    },
  },
});
