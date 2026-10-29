export const PIX_KEY = '82iptv@gmail.com';
export const PIX_RECIPIENT = 'Diego Felix Owerney';
export const PIX_BANK = 'Nubank';

export function getPixPaymentUrl(clientId: string): string {
  return `https://gestorbot.lovable.app/pix/${encodeURIComponent(clientId)}`;
}

export function isPaymentTemplate(name: string = ''): boolean {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /cobranc|vencid|expir/.test(normalized);
}

/** Cobranças recebem o link sem depender de marcadores no template salvo. */
export function withPixPaymentLink(message: string, clientId: string): string {
  const url = getPixPaymentUrl(clientId);
  let result = message
    .replace(/\{(?:link_pagamento|url|link)\}/gi, url)
    .replace(/https:\/\/gestorbot\.lovable\.app\/(?:pagar|pix)\/[^\s*<>]+/g, url)
    .replaceAll(PIX_KEY, url);
  if (!result.includes(url)) result = `${result.trim()}\n\n💳 Pague via Pix:\n${url}`;
  // Um único endereço, mesmo em templates antigos com chave e marcador.
  const first = result.indexOf(url);
  return result.slice(0, first + url.length) + result.slice(first + url.length).replaceAll(url, '');
}

export type PixCheckoutInfo = {
  nome: string;
  vencimento: string | null;
  plan_price: number | string | null;
  desconto: number | string | null;
};

export function pixAmount(info: PixCheckoutInfo): number {
  if (info.plan_price === null || info.plan_price === '') throw new Error('Valor indisponível.');
  const price = Number(info.plan_price);
  const discount = Number(info.desconto ?? 0);
  if (!Number.isFinite(price) || !Number.isFinite(discount)) throw new Error('Valor inválido.');
  return Math.max(0, price - discount);
}

export function pixDueDate(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Fallback para navegadores que não disponibilizam a Clipboard API. */
export async function copyPixKey(): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(PIX_KEY);
      return;
    }
  } catch {
    // Alguns navegadores bloqueiam a API; tenta a cópia pelo gesto do usuário.
  }
  const field = document.createElement('textarea');
  field.value = PIX_KEY;
  field.readOnly = true;
  field.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:16px';
  const previous = document.activeElement as HTMLElement | null;
  document.body.appendChild(field);
  try {
    field.focus();
    field.select();
    field.setSelectionRange(0, PIX_KEY.length);
    if (!document.execCommand('copy')) throw new Error('Cópia indisponível.');
  } finally {
    field.remove();
    previous?.focus();
  }
}
