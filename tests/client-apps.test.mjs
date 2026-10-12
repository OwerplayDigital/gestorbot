import assert from 'node:assert/strict';
import { APP_CATALOG, normalizeAppName, groupClientApps, clientAppStatus, countAppStatuses, fetchAllPages } from '../src/lib/client-apps.ts';

const clients = [
  { id: 'a', nome: 'Ana', vencimento: '2026-10-12' },
  { id: 'b', nome: 'Bia', vencimento: '12/10/2026' },
  { id: 'c', nome: 'Caio', vencimento: '2026-10-11' },
  { id: 'd', nome: 'Dani', vencimento: null },
];
const devices = [
  { id: '1', cliente_id: 'a', app_nome: ' Ibo  Player ' },
  { id: '2', cliente_id: 'a', app_nome: 'ibo player' },
  { id: '3', cliente_id: 'a', app_nome: 'Bob Player' },
  { id: '4', cliente_id: 'b', app_nome: 'IBO PLAYER' },
  { id: '5', cliente_id: 'c', app_nome: 'App especial' },
  { id: '6', cliente_id: 'd', app_nome: ' ' },
  { id: '7', cliente_id: 'deleted', app_nome: 'Ibo Player' },
];
const grouped = groupClientApps(clients, devices);
assert.equal(grouped.groups.length, 3);
assert.equal(grouped.groups[0].name, 'Ibo Player');
assert.equal(grouped.groups[0].clients.length, 2);
assert.equal(grouped.unassigned[0].id, 'd');
assert.equal(grouped.groups.find(group => group.name === 'Bob Player').clients.length, 1);
assert.deepEqual(countAppStatuses(clients, '2026-10-12'), { active: 0, today: 2, expired: 1, unknown: 1 });
assert.equal(clientAppStatus('2026-02-30', '2026-10-12'), 'unknown');
assert.equal(clientAppStatus('2026-11-01', '2026-10-12'), 'active');
assert.equal(clientAppStatus('', '2026-10-12'), 'unknown');
const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
let calls = 0;
const result = await fetchAllPages(async (from, to) => { calls++; return { data: rows.slice(from, to + 1), error: null }; });
assert.equal(result.length, 1201);
assert.equal(calls, 3);
assert.deepEqual(await fetchAllPages(async () => ({ data: [], error: null })), []);
await assert.rejects(fetchAllPages(async () => ({ data: null, error: Error('consulta falhou') })));
console.log('PASS: aplicativos, clientes únicos, múltiplos dispositivos, status e paginação.');

assert.equal(APP_CATALOG.length, 11);
assert.equal(new Set(APP_CATALOG.map(app => normalizeAppName(app.name))).size, 11);
const defaults = groupClientApps([], [], APP_CATALOG);
assert.equal(defaults.groups.length, 11);
assert.ok(defaults.groups.every(group => group.clients.length === 0));
assert.equal(normalizeAppName('Uniplayer P2P'), normalizeAppName('Uniplay P2P'));
assert.equal(normalizeAppName('Fanplay'), normalizeAppName('FunPlay'));
console.log('PASS: 11 aplicativos pré-cadastrados, sem clientes e aliases normalizados.');
