export type AppDefinition = { name: string; url?: string | undefined; icon?: string | undefined; crop?: { width: number; size: number; x: number; y: number } };
export const APP_CATALOG: AppDefinition[] = [
  { name: 'Uniplay P2P', icon: '/app-icons/reference.webp', crop: { width: 691, size: 84, x: 49, y: 417 } },
  { name: 'Goat P2P', icon: '/app-icons/goat.webp' },
  { name: 'Orange Player', icon: '/app-icons/orange.webp' },
  { name: 'Ibo Player', url: 'https://iboplayer.com/device/login', icon: '/app-icons/ibo-player.webp' },
  { name: 'Ibo Pro', url: 'https://iboproapp.com/manage-playlists/login/', icon: '/app-icons/ibo-pro.webp' },
  { name: 'Ibo Revenda', icon: '/app-icons/ibo-revenda.webp' },
  { name: 'Ibo New', icon: '/app-icons/ibo-new.webp' },
  { name: 'Bob Player', url: 'https://bobplayer.com/device/login', icon: '/app-icons/bob-player.webp' },
  { name: 'See Play', icon: '/app-icons/see-play.webp' },
  { name: 'FunPlay', icon: '/app-icons/reference.webp', crop: { width: 691, size: 84, x: 49, y: 695 } },
  { name: 'Lazer Play', icon: '/app-icons/lazer-play.webp' },
];

export type AppClient = { id: string; nome: string; whatsapp: string | null; vencimento: string | null; servidores_ids: string[] | null; plans?: { name: string } | null };
export type AppDevice = { id: string; cliente_id: string; app_nome: string };
export type AppStatus = 'active' | 'today' | 'expired' | 'unknown';
export const normalizeAppName = (name: string) => {
  const key = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  return key === 'uniplayer p2p' ? 'uniplay p2p' : key === 'fanplay' ? 'funplay' : key;
};
export const getAppUrl = (name: string, catalog: AppDefinition[] = APP_CATALOG) => catalog.find(app => normalizeAppName(app.name) === normalizeAppName(name))?.url;

export function clientAppStatus(vencimento: string | null, today: string): AppStatus {
  if (!vencimento) return 'unknown';
  const date = vencimento.includes('/') ? vencimento.split('/').reverse().join('-') : vencimento.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'unknown';
  const parsed = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return 'unknown';
  return date < today ? 'expired' : date === today ? 'today' : 'active';
}

export function groupClientApps(clients: AppClient[], devices: AppDevice[], catalog: AppDefinition[] = []) {
  const byId = new Map(clients.map(client => [client.id, client]));
  const assigned = new Set<string>();
  const groups = new Map<string, { key: string; name: string; clients: Map<string, AppClient> }>();
  for (const app of catalog) groups.set(normalizeAppName(app.name), { key: normalizeAppName(app.name), name: app.name, clients: new Map() });
  for (const device of devices) {
    const client = byId.get(device.cliente_id);
    const key = normalizeAppName(device.app_nome);
    if (!client || !key) continue;
    assigned.add(client.id);
    if (!groups.has(key)) {
      const canonical = APP_CATALOG.find(app => normalizeAppName(app.name) === key)?.name;
      groups.set(key, { key, name: canonical || device.app_nome.trim().replace(/\s+/g, ' '), clients: new Map() });
    }
    groups.get(key)!.clients.set(client.id, client);
  }
  return {
    groups: Array.from(groups.values()).map(group => ({ key: group.key, name: group.name, clients: Array.from(group.clients.values()) }))
      .sort((a, b) => b.clients.length - a.clients.length || a.name.localeCompare(b.name, 'pt-BR')),
    unassigned: clients.filter(client => !assigned.has(client.id)),
  };
}

export function countAppStatuses(clients: AppClient[], today: string) {
  const result = { active: 0, today: 0, expired: 0, unknown: 0 };
  for (const client of clients) result[clientAppStatus(client.vencimento, today)]++;
  return result;
}

// Supabase limita cada resposta: carregar todas as páginas evita totais incompletos.
export async function fetchAllPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const { data, error } = await read(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size) return rows;
  }
}

export function appAccessFields(name: string) {
  const key = normalizeAppName(name);
  const mac = !!key && !['uniplay', 'uniplay p2p', 'goat', 'goat p2p', 'orange player'].includes(key);
  return { mac, key: mac && !['ibo new', 'ibo revenda', 'ibi revenda'].includes(key) };
}
export const requiresAppAccess = (name: string) => appAccessFields(name).mac;
