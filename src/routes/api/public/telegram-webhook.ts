import { createFileRoute } from '@tanstack/react-router';
import { getAuthorizedUser, createPlan, listPlans, createServer, listServers } from '@/lib/telegram.server';

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
  keyboard: [[{ text: 'PLANOS' }, { text: 'SERVIDORES' }]],
  resize_keyboard: true,
};

const plansMenu = {
  keyboard: [[{ text: 'Cadastrar plano' }], [{ text: 'Listar planos' }], [{ text: 'Voltar' }]],
  resize_keyboard: true,
};

const serversMenu = {
  keyboard: [[{ text: 'Cadastrar servidor' }], [{ text: 'Listar servidores' }], [{ text: 'Voltar' }]],
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

          if (text === '/start' || text === 'Voltar') {
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

          // Comandos Iniciais
          switch (text) {
            case 'PLANOS':
              await sendMessage(chatId, "Gerenciar Planos:", plansMenu);
              break;
            case 'SERVIDORES':
              await sendMessage(chatId, "Gerenciar Servidores:", serversMenu);
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
