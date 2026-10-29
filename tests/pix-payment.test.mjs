import assert from 'node:assert/strict';
import test from 'node:test';
import { getPixPaymentUrl, withPixPaymentLink, isPaymentTemplate, pixAmount, pixDueDate, copyPixKey, PIX_KEY } from '../src/lib/pix-payment.ts';

test('inclui automaticamente o endereço do cliente sem exigir marcador', () => {
  const url = getPixPaymentUrl('cliente-a');
  assert.equal(withPixPaymentLink('Olá Daniel', 'cliente-a'), 'Olá Daniel\n\n💳 Pague via Pix:\n' + url);
  assert.ok(!withPixPaymentLink('Olá', 'cliente-a').includes(getPixPaymentUrl('cliente-b')));
});
test('troca chave e links antigos pelo endereço atual, sem duplicar', () => {
  const url = getPixPaymentUrl('cliente-a');
  for (const original of [
    'PIX: ' + PIX_KEY,
    'Pagar: {url}',
    'Pagar: {link_pagamento}',
    'Pagar: https://gestorbot.lovable.app/pagar/antigo',
    'PIX: ' + PIX_KEY + '\n{link}',
    'Pagar: ' + url,
  ]) {
    const result = withPixPaymentLink(original, 'cliente-a');
    assert.equal(result.split(url).length - 1, 1);
    assert.ok(!result.includes(PIX_KEY));
    assert.ok(!result.includes('{url}'));
  }
});
test('reconhece cobranças e vencidos sem alterar confirmações ou bônus', () => {
  for (const name of ['Cobrança Oficial', 'Cobrança', 'Plano vencido', 'Expirados']) assert.equal(isPaymentTemplate(name), true);
  for (const name of ['Renovação', 'Bônus por indicação', 'Boas-vindas']) assert.equal(isPaymentTemplate(name), false);
});
test('valor considera desconto e não mostra números inválidos', () => {
  const base = { nome: 'Daniel', vencimento: '2026-10-31', plan_price: '35.00', desconto: '5' };
  assert.equal(pixAmount(base), 30);
  assert.equal(pixAmount({ ...base, desconto: 50 }), 0);
  assert.throws(() => pixAmount({ ...base, plan_price: null }));
  assert.throws(() => pixAmount({ ...base, plan_price: 'inválido' }));
  assert.equal(pixDueDate(base.vencimento), '31/10/2026');
  assert.equal(pixDueDate(null), '—');
});
test('copia a chave correta e só resolve após a Clipboard API confirmar', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let copied;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => { copied = value; } } } });
  try { await copyPixKey(); assert.equal(copied, PIX_KEY); }
  finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else delete globalThis.navigator; }
});
test('fallback remove campo temporário e informa falha quando cópia é bloqueada', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalDocument = globalThis.document;
  let removed = 0, restored = 0;
  const field = { style: {}, focus() {}, select() {}, setSelectionRange() {}, remove() { removed++; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  globalThis.document = { activeElement: { focus() { restored++; } }, body: { appendChild() {} }, createElement: () => field, execCommand: () => false };
  try { await assert.rejects(copyPixKey()); assert.equal(removed, 1); assert.equal(restored, 1); }
  finally { if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator; globalThis.document = originalDocument; }
});

test('cobranças das três telas incluem link e preservam imagem; confirmação não ganha cobrança', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const { stripTypeScriptTypes } = await import('node:module');
  const { renderClientTemplate, BOT_TEMPLATES } = await import('../src/lib/templates.ts');
  const client = { id: '11111111-1111-4111-8111-111111111111', nome: 'Daniel Silva', whatsapp: '21999999999', vencimento: '2026-10-31', plans: { price: 35 }, desconto: 0 };
  const template = { nome: 'Cobrança Oficial', mensagem: 'Olá {primeiro_nome}, PIX: ' + PIX_KEY, imagem_url: 'https://example.com/cobranca.webp' };
  let delivered;
  const context = { selectedClient: client, withPixPaymentLink, isPaymentTemplate, renderClientTemplate, BOT_TEMPLATES, console, toast: { error: value => { throw Error(value); } }, format: () => '31/10/2026', parseISO: value => value, formatBRL: () => 'R$ 35,00', setIsMessageOpen() {}, openWhatsApp: (...args) => { delivered = args; }, window: { OwerAppsExternal: { shareWhatsAppImage: (...args) => { delivered = args; } } }, supabase: { from: () => ({ select: async () => ({ data: [template] }) }) } };
  vm.createContext(context);
  const dashboard = fs.readFileSync(new URL('../src/routes/_authenticated/dashboard.tsx', import.meta.url), 'utf8');
  vm.runInContext(stripTypeScriptTypes(dashboard.slice(dashboard.indexOf(' async function chargeClient'), dashboard.indexOf(' function openRenew'))), context);
  await context.chargeClient(client);
  assert.equal(delivered[2], template.imagem_url); assert.ok(delivered[1].includes(getPixPaymentUrl(client.id)));
  const clients = fs.readFileSync(new URL('../src/routes/_authenticated/clientes.tsx', import.meta.url), 'utf8');
  vm.runInContext(stripTypeScriptTypes(clients.slice(clients.indexOf('  const handleSendMessage'), clients.indexOf('  async function sendRenewalMessage')) + '\nglobalThis.sendFromClients = handleSendMessage;'), context);
  context.sendFromClients(template);
  assert.equal(delivered[2], template.imagem_url); assert.ok(delivered[1].includes(getPixPaymentUrl(client.id)));
  const expired = fs.readFileSync(new URL('../src/routes/_authenticated/vencidos.tsx', import.meta.url), 'utf8');
  vm.runInContext(stripTypeScriptTypes(expired.slice(expired.indexOf('  async function sendTemplateMessage'), expired.indexOf('  async function loadSystemTemplate'))), context);
  await context.sendTemplateMessage(client, template, '', true);
  assert.equal(delivered[2], template.imagem_url); assert.ok(delivered[1].includes(getPixPaymentUrl(client.id)));
  await context.sendTemplateMessage(client, { ...template, nome: 'Renovação', mensagem: 'Assinatura renovada' }, '');
  assert.equal(delivered[1], 'Assinatura renovada');
});
