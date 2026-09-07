import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import {
  BOT_TEMPLATES,
  bindAdminIfMatching,
  calcularNovoVencimentoISO,
  clearBotMessages,
  getAuthorizedUser,
  getBotMessages,
  isoToBR,
  renewClient,
  todayISOBr,
  trackBotMessage,
} from '@/lib/telegram.server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env['TELEGRAM_BOT_TOKEN']}`;
const GESTOR_URL = 'https://gestorbot.lovable.app/?admin=true';

const mainMenu = {
  inline_keyboard: [
    [{ text: '📅 Vence Hoje', callback_data: 'vencendo_hoje' }],
    [{ text: '🌐 Abrir Gestor', url: GESTOR_URL }],
    [{ text: '🧹 Limpar Tela', callback_data: 'limpar_chat' }],
  ],
};

function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  return cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
}

function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await response.json();
  } catch (error) {
    console.error(`Erro Telegram (${method}):`, error);
    return null;
  }
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const data = await telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
    parse_mode: 'HTML',
  });

  if (data?.ok && data.result?.message_id) {
    await trackBotMessage(chatId, data.result.message_id);
  }
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  await telegramRequest('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup,
    parse_mode: 'HTML',
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await telegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

async function configureBotCommands() {
  await telegramRequest('setMyCommands', {
    commands: [
      { command: 'start', description: 'Abrir menu' },
      { command: 'hoje', description: 'Ver vencimentos de hoje' },
      { command: 'limpar', description: 'Limpar tela do bot' },
    ],
  });
}

async function clearChat(chatId: number) {
  const messages = await getBotMessages(chatId);

  for (const messageId of messages) {
    await telegramRequest('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  await clearBotMessages(chatId);
}

async function sendMainMenu(chatId: number) {
  await sendMessage(chatId, '<b>Owerplay Gestor</b>', mainMenu);
}

async function getTodayClients(userId: string) {
  const today = todayISOBr();

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, whatsapp, vencimento, servidores_ids')
    .eq('user_id', userId)
    .eq('vencimento', today)
    .order('nome');

  if (error) {
    console.error('Erro ao buscar vencimentos de hoje:', error);
    throw error;
  }

  return data || [];
}

async function sendTodayClients(chatId: number, userId: string) {
  const clients = await getTodayClients(userId);

  if (clients.length === 0) {
    await sendMessage(chatId, '<b>Vencimentos de hoje</b>\n\nNinguém vence hoje.', mainMenu);
    return;
  }

  await sendMessage(
    chatId,
    `<b>Vencimentos de hoje</b>\n\n${clients.length} cliente(s) vencendo hoje.`,
  );

  for (const client of clients) {
    const firstName = (client.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
    const brDate = isoToBR(client.vencimento);
    const phone = cleanPhone(client.whatsapp || '');
    const paymentUrl = `https://gestorbot.lovable.app/pagar/${client.id}`;
    const chargeMessage = BOT_TEMPLATES.COBRANCA(firstName, brDate, paymentUrl);

    const buttons: any[][] = [];

    if (phone) {
      buttons.push([
        {
          text: 'Cobrar',
          url: `https://wa.me/${phone}?text=${encodeURIComponent(chargeMessage)}`,
        },
        {
          text: 'Renovar',
          callback_data: `renew_init:${client.id}`,
        },
      ]);
    } else {
      buttons.push([
        {
          text: 'Renovar',
          callback_data: `renew_init:${client.id}`,
        },
      ]);
    }

    await sendMessage(
      chatId,
      `👤 <b>${client.nome}</b>\n📅 Vencimento: ${brDate}`,
      { inline_keyboard: buttons },
    );
  }
}

async function showRenewalDate(
  chatId: number,
  messageId: number,
  clientId: string,
  clientName: string,
  dateIso: string,
) {
  const brDate = isoToBR(dateIso);
  const previousDate = addDaysISO(dateIso, -1);
  const nextDate = addDaysISO(dateIso, 1);

  await editMessage(
    chatId,
    messageId,
    `<b>Renovar ${clientName}</b>\n\nData sugerida: <b>${brDate}</b>`,
    {
      inline_keyboard: [
        [
          { text: '−', callback_data: `renew_date:${clientId}:${previousDate}` },
          { text: brDate, callback_data: 'renew_noop' },
          { text: '+', callback_data: `renew_date:${clientId}:${nextDate}` },
        ],
        [{ text: 'Confirmar renovação', callback_data: `renew_confirm:${clientId}:${dateIso}` }],
        [{ text: 'Cancelar', callback_data: 'vencendo_hoje' }],
      ],
    },
  );
}

async function prepareRenewal(chatId: number, messageId: number, clientId: string, userId: string) {
  const { data: client, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, vencimento, servidores_ids')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single();

  if (error || !client) {
    await sendMessage(chatId, 'Cliente não encontrado.');
    return;
  }

  let serverNames: string[] = [];
  if (client.servidores_ids?.length) {
    const { data: servers } = await supabaseAdmin
      .from('servidores_iptv')
      .select('name')
      .in('id', client.servidores_ids);
    serverNames = (servers || []).map((server: any) => server.name);
  }

  const today = todayISOBr();
  const current = String(client.vencimento || today).slice(0, 10);
  const base = current < today ? today : current;
  const suggestedDate = calcularNovoVencimentoISO(base, serverNames);

  await showRenewalDate(chatId, messageId, client.id, client.nome, suggestedDate);
}

async function adjustRenewalDate(
  chatId: number,
  messageId: number,
  clientId: string,
  dateIso: string,
  userId: string,
) {
  const { data: client, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single();

  if (error || !client) {
    await sendMessage(chatId, 'Cliente não encontrado.');
    return;
  }

  await showRenewalDate(chatId, messageId, client.id, client.nome, dateIso);
}

async function confirmRenewal(
  chatId: number,
  messageId: number,
  clientId: string,
  newDate: string,
  userId: string,
) {
  const { data: existing, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, whatsapp')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single();

  if (error || !existing) {
    await sendMessage(chatId, 'Cliente não encontrado.');
    return;
  }

  const updated = await renewClient(clientId, newDate, userId);
  const firstName = (updated.nome || existing.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
  const phone = cleanPhone(updated.whatsapp || existing.whatsapp || '');
  const brDate = isoToBR(newDate);
  const renewalMessage = BOT_TEMPLATES.CONFIRMACAO(firstName, brDate);

  const buttons: any[][] = [];
  if (phone) {
    buttons.push([
      {
        text: 'Enviar mensagem',
        url: `https://wa.me/${phone}?text=${encodeURIComponent(renewalMessage)}`,
      },
    ]);
  }
  buttons.push([{ text: 'Vence Hoje', callback_data: 'vencendo_hoje' }]);

  await editMessage(
    chatId,
    messageId,
    `<b>Renovado — ${existing.nome}</b>\n${brDate}`,
    { inline_keyboard: buttons },
  );
}

async function handleTelegramEvent(body: any): Promise<Response> {
  try {
    if (!body) return new Response('OK');

    if (body.callback_query) {
      const callback = body.callback_query;
      const chatId = Number(callback.message?.chat?.id);
      const fromId = callback.from?.id;
      const messageId = Number(callback.message?.message_id);
      const data = String(callback.data || '');

      const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
      if (!allowedId || String(fromId) !== allowedId) {
        return new Response('Unauthorized', { status: 403 });
      }

      await answerCallbackQuery(callback.id);

      const userId = await getAuthorizedUser(chatId);
      if (!userId) return new Response('OK');

      if (data === 'vencendo_hoje') {
        await sendTodayClients(chatId, userId);
        return new Response('OK');
      }

      if (data === 'limpar_chat') {
        await clearChat(chatId);
        return new Response('OK');
      }

      if (data === 'renew_noop') {
        return new Response('OK');
      }

      if (data.startsWith('renew_init:')) {
        const clientId = data.split(':')[1];
        if (clientId) await prepareRenewal(chatId, messageId, clientId, userId);
        return new Response('OK');
      }

      if (data.startsWith('renew_date:')) {
        const [, clientId, dateIso] = data.split(':');
        if (clientId && dateIso) {
          await adjustRenewalDate(chatId, messageId, clientId, dateIso, userId);
        }
        return new Response('OK');
      }

      if (data.startsWith('renew_confirm:')) {
        const [, clientId, newDate] = data.split(':');
        if (clientId && newDate) {
          await confirmRenewal(chatId, messageId, clientId, newDate, userId);
        }
        return new Response('OK');
      }

      await sendMainMenu(chatId);
      return new Response('OK');
    }

    const message = body.message;
    if (!message) return new Response('OK');

    const chatId = Number(message.chat?.id);
    const fromId = message.from?.id;
    const text = String(message.text || '').trim();
    const command = text.toLowerCase().split(' ')[0];

    const allowedId = process.env['TELEGRAM_ALLOWED_USER_ID'] || process.env['TELEGRAM_ADMIN_ID'];
    if (!allowedId || String(fromId) !== allowedId) {
      return new Response('Unauthorized', { status: 403 });
    }

    if (message.message_id) {
      await trackBotMessage(chatId, message.message_id);
    }

    await bindAdminIfMatching(chatId);
    const userId = await getAuthorizedUser(chatId);
    if (!userId) return new Response('OK');

    if (command === '/start') {
      await configureBotCommands();
      await sendMainMenu(chatId);
      return new Response('OK');
    }

    if (command === '/hoje') {
      await sendTodayClients(chatId, userId);
      return new Response('OK');
    }

    if (command === '/limpar') {
      await clearChat(chatId);
      return new Response('OK');
    }

    await sendMainMenu(chatId);
    return new Response('OK');
  } catch (error) {
    console.error('ERRO WEBHOOK TELEGRAM:', error);
    return new Response('OK');
  }
}

export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }): Promise<Response> => {
        const body = await request.json();
        return handleTelegramEvent(body);
      },
    },
  },
});
