export const BOT_TEMPLATES = {
  COBRANCA: (nome: string, data: string, url: string = ""): string => 
    `Olá ${nome}, bom dia!\n` +
    `Seu plano de TV vence hoje: *${data}*\n\n` +
    `⚠️ *Atenção:* na data do vencimento, o sistema poderá bloquear automaticamente a qualquer momento. Renove assim que possível.\n\n` +
    `🔗 *Acesse o link seguro para copiar o PIX e renovar:*\n\n` +
    `${url}`,

  RENOVACAO_LINK: (nome: string, url: string = ""): string =>
    `Olá!\n\n` +
    `Aqui está o seu link para renovação da assinatura:\n\n` +
    `🔗 ${url}\n\n` +
    `Após o pagamento, sua assinatura será renovada automaticamente.`,

  CONFIRMACAO: (nome: string, data: string): string =>
    `📌 Obrigado pela confiança!\n\n` +
    `✅ Sua assinatura foi renovada com sucesso!\n\n` +
    `🗓️ *PRÓXIMO VENCIMENTO:* ${data}`
};
