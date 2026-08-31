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

/**
 * Substitui variáveis dinâmicas ({nome}, {vencimento}, {valor}...) pelo conteúdo
 * real do cliente. Tags desconhecidas permanecem intactas no texto original.
 */
export const renderClientTemplate = (
  content: string,
  vars: Record<string, string>
): string =>
  content.replace(/\{([a-z_]+)\}/gi, (match, key: string) => {
    const value = vars[key];
    return value !== undefined && value !== null ? value : match;
  });

/** Escapa caracteres especiais para exibição segura com parse_mode HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
