import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Smartphone, Users, ChevronRight, ArrowLeft, Search, Copy, Pencil, Plus, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { APP_CATALOG, getAppUrl, normalizeAppName, groupClientApps, countAppStatuses, clientAppStatus, fetchAllPages, type AppClient, type AppDevice, type AppStatus } from '@/lib/client-apps';

export const Route = createFileRoute('/_authenticated/aplicativos')({ component: ApplicationsPage });
type DeviceDetails = AppDevice & { mac_address: string; app_key: string | null };
const statusLabels: Record<AppStatus, string> = { active: 'Em dia', today: 'Vence hoje', expired: 'Vencido', unknown: 'Sem data válida' };
const statusColors: Record<AppStatus, string> = { active: 'text-emerald-600 bg-emerald-500/10', today: 'text-amber-600 bg-amber-500/10', expired: 'text-rose-500 bg-rose-500/10', unknown: 'text-muted-foreground bg-muted' };
const emptyForm = { id: '', app_nome: '', mac_address: '', app_key: '' };

function StatusTotals({ clients, today }: { clients: AppClient[]; today: string }) {
  const counts = countAppStatuses(clients, today);
  return <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
    <span className="text-emerald-600">{counts.active} em dia</span>
    <span className="text-amber-600">{counts.today} vencendo hoje</span>
    <span className="text-rose-500">{counts.expired} vencidos</span>
    {counts.unknown > 0 && <span className="text-muted-foreground">{counts.unknown} sem data válida</span>}
  </div>;
}

function ApplicationsPage() {
  const queryClient = useQueryClient();
  // null: catálogo; "": clientes sem aplicativo; demais: nome normalizado.
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState<AppClient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['client-applications'], staleTime: 0, refetchInterval: 60000,
    queryFn: async () => {
      const [clients, devices, servers] = await Promise.all([
        fetchAllPages<AppClient>((from, to) => supabase.from('clientes').select('id,nome,whatsapp,vencimento,servidores_ids,plans(name)').order('id').range(from, to)),
        fetchAllPages<AppDevice>((from, to) => supabase.from('dispositivos').select('id,cliente_id,app_nome').order('id').range(from, to)),
        fetchAllPages<{ id: string; name: string }>((from, to) => supabase.from('servidores_iptv').select('id,name').order('id').range(from, to)),
      ]);
      return { clients, devices, servers };
    },
  });
  const grouped = useMemo(() => groupClientApps(data?.clients || [], data?.devices || []), [data]);
  const group = grouped.groups.find(item => item.key === selectedApp);
  const appClients = selectedApp === '' ? grouped.unassigned : group?.clients || [];
  const title = selectedApp === '' ? 'Sem aplicativo' : group?.name || 'Aplicativo';
  const needle = search.trim().toLocaleLowerCase('pt-BR');
  const digits = search.replace(/\D/g, '');
  const visibleClients = appClients.filter(client => {
    const matches = !needle || client.nome.toLocaleLowerCase('pt-BR').includes(needle)
      || (digits.length > 0 && !/[a-zà-ú]/i.test(search) && String(client.whatsapp || '').replace(/\D/g, '').includes(digits));
    return matches && (statusFilter === 'all' || clientAppStatus(client.vencimento, today) === statusFilter);
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const visibleGroups = grouped.groups.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(needle));

  const deviceQuery = useQuery({
    queryKey: ['client-application-details', selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: () => fetchAllPages<DeviceDetails>((from, to) => supabase.from('dispositivos').select('id,cliente_id,app_nome,mac_address,app_key').eq('cliente_id', selectedClient!.id).order('id').range(from, to)),
  });
  const appNames = Array.from(new Set([...APP_CATALOG.map(app => app.name), ...grouped.groups.map(item => item.name)])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const activeClient = data?.clients.find(client => client.id === selectedClient?.id) || selectedClient;
  function selectApp(key: string | null) { setSelectedApp(key); setSearch(''); setStatusFilter('all'); }
  function openClient(client: AppClient) { setSelectedClient(client); setEditing(false); setForm(emptyForm); }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success('Copiado.'); }
    catch { toast.error('Não foi possível copiar.'); }
  }
  async function saveDevice() {
    if (!selectedClient || saving) return;
    if (!form.app_nome.trim()) { toast.error('Informe o aplicativo.'); return; }
    setSaving(true);
    try {
      const canonical = appNames.find(name => normalizeAppName(name) === normalizeAppName(form.app_nome));
      const payload = { cliente_id: selectedClient.id, app_nome: canonical || form.app_nome.trim().replace(/\s+/g, ' '), mac_address: form.mac_address.trim(), app_key: form.app_key.trim() || null };
      const response = form.id
        ? await supabase.from('dispositivos').update(payload).eq('id', form.id).eq('cliente_id', selectedClient.id)
        : await supabase.from('dispositivos').insert(payload);
      if (response.error) throw response.error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['client-application-details', selectedClient.id] }),
        queryClient.invalidateQueries({ queryKey: ['clients-active'] }),
      ]);
      setEditing(false); toast.success('Aplicativo salvo.');
    } catch (error) { console.error(error); toast.error('Não foi possível salvar o aplicativo.'); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
    <div className="flex items-center gap-3">
      {selectedApp !== null && <Button variant="outline" size="icon" aria-label="Voltar aos aplicativos" onClick={() => selectApp(null)}><ArrowLeft size={18} /></Button>}
      <div><h1 className="flex items-center gap-2 text-2xl font-black tracking-tight"><Smartphone className="text-primary" size={25} />{selectedApp === null ? 'Aplicativos' : title}</h1><p className="mt-1 text-sm text-muted-foreground">{selectedApp === null ? 'Seus clientes, organizados por aplicativo.' : `${appClients.length} clientes neste grupo`}</p></div>
    </div>
    {isPending ? <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Carregando aplicativos...</div> : error ? <div className="rounded-2xl border bg-card p-6 text-center"><p>Não foi possível carregar os aplicativos.</p><Button className="mt-3" onClick={() => refetch()}>Tentar novamente</Button></div> : <>
      {selectedApp === null ? <>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Aplicativos em uso</p><p className="mt-1 text-2xl font-black">{grouped.groups.length}</p></div><div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Clientes com aplicativo</p><p className="mt-1 text-2xl font-black">{(data?.clients.length || 0) - grouped.unassigned.length}</p></div></div>
        <button onClick={() => selectApp('')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-left"><div><p className="font-bold">{grouped.unassigned.length} clientes sem aplicativo</p><p className="mt-1 text-xs text-muted-foreground">Veja os clientes e complete o cadastro.</p></div><ChevronRight size={20} className="shrink-0 text-amber-600" /></button>
        <label className="relative block"><Search size={18} className="absolute left-3 top-3 text-muted-foreground" /><Input aria-label="Buscar aplicativo" placeholder="Buscar aplicativo..." className="h-11 rounded-xl pl-10" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="grid gap-3 md:grid-cols-2">{visibleGroups.map(item => <button key={item.key} onClick={() => selectApp(item.key)} className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Smartphone size={24} /></div><div className="min-w-0 flex-1"><h2 className="break-words font-bold">{item.name}</h2><p className="my-1 text-sm text-muted-foreground">{item.clients.length} clientes</p><StatusTotals clients={item.clients} today={today} /></div><ChevronRight size={18} className="shrink-0 text-muted-foreground" /></button>)}</div>
        {!visibleGroups.length && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{search ? 'Nenhum aplicativo encontrado.' : 'Nenhum aplicativo vinculado ainda. Comece pelos clientes sem aplicativo.'}</div>}
      </> : <>
        <div className="rounded-2xl border bg-card p-4"><StatusTotals clients={appClients} today={today} /></div>
        <label className="relative block"><Search size={18} className="absolute left-3 top-3 text-muted-foreground" /><Input aria-label="Buscar cliente ou telefone" placeholder="Buscar cliente ou telefone..." className="h-11 rounded-xl pl-10" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <select aria-label="Filtrar por vencimento" className="h-10 w-full rounded-xl border bg-background px-3 text-sm md:w-56" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">Todos os vencimentos</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <p className="text-xs text-muted-foreground">{visibleClients.length} clientes encontrados</p>
        <div className="grid gap-3 md:grid-cols-2">{visibleClients.map(client => {
          const status = clientAppStatus(client.vencimento, today);
          return <button key={client.id} onClick={() => openClient(client)} className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm hover:border-primary/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users size={20} /></div><div className="min-w-0 flex-1"><p className="break-words font-bold">{client.nome}</p><p className="mt-1 text-xs text-muted-foreground">{client.whatsapp || 'Sem WhatsApp'}</p><span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-semibold ${statusColors[status]}`}>{statusLabels[status]}</span></div><ChevronRight size={18} className="shrink-0 text-muted-foreground" /></button>;
        })}</div>
        {!visibleClients.length && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nenhum cliente encontrado.</div>}
      </>}
    </>}
    <Dialog open={!!selectedClient} onOpenChange={open => { if (!open && !saving) setSelectedClient(null); }}>
      <DialogContent onOpenAutoFocus={event => event.preventDefault()} className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{activeClient?.nome}</DialogTitle><DialogDescription>Cadastro e dados dos aplicativos deste cliente.</DialogDescription></DialogHeader>
        {activeClient && <div className="space-y-4">
          <div className="rounded-xl bg-muted/40 p-3 text-sm"><p>{activeClient.whatsapp || 'Sem WhatsApp cadastrado'}</p><p className="mt-1 text-muted-foreground">Vencimento: {activeClient.vencimento?.includes('-') ? activeClient.vencimento.slice(0, 10).split('-').reverse().join('/') : activeClient.vencimento || 'Não informado'}</p><p className="mt-1 text-muted-foreground">Plano: {activeClient.plans?.name || 'Não informado'}</p><p className="mt-1 text-muted-foreground">Servidores: {(activeClient.servidores_ids || []).map(id => data?.servers.find(server => server.id === id)?.name).filter(Boolean).join(', ') || 'Não informado'}</p></div>
          {editing ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveDevice(); }}>
            <label className="block text-sm font-medium">Aplicativo<Input required list="gestor-app-names" value={form.app_nome} onChange={event => setForm(f => ({ ...f, app_nome: event.target.value }))} placeholder="Selecione ou digite o nome" /><datalist id="gestor-app-names">{appNames.map(name => <option key={name} value={name} />)}</datalist></label>
            <label className="block text-sm font-medium">MAC<Input value={form.mac_address} onChange={event => setForm(f => ({ ...f, mac_address: event.target.value }))} /></label>
            <label className="block text-sm font-medium">Key<Input value={form.app_key} onChange={event => setForm(f => ({ ...f, app_key: event.target.value }))} /></label>
            <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar aplicativo'}</Button></div>
          </form> : <>
            {deviceQuery.isPending ? <p className="text-sm text-muted-foreground">Carregando dados dos aplicativos...</p> : deviceQuery.error ? <div><p className="text-sm text-rose-500">Não foi possível carregar os dados.</p><Button variant="outline" onClick={() => deviceQuery.refetch()}>Tentar novamente</Button></div> : <>
              {!deviceQuery.data?.length && <p className="text-sm text-muted-foreground">Este cliente ainda não tem aplicativo cadastrado.</p>}
              {deviceQuery.data?.map(device => <div key={device.id} className="space-y-2 rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><b className="break-words">{device.app_nome}</b><Button size="icon" variant="outline" aria-label={`Editar ${device.app_nome}`} onClick={() => { setForm({ id: device.id, app_nome: device.app_nome, mac_address: device.mac_address || '', app_key: device.app_key || '' }); setEditing(true); }}><Pencil size={15} /></Button></div>{[['MAC', device.mac_address], ['Key', device.app_key]].map(([label, value]) => value && <div key={label} className="flex items-center justify-between gap-2 text-sm"><span className="break-all"><span className="text-muted-foreground">{label}: </span>{value}</span><Button size="icon" variant="ghost" aria-label={`Copiar ${label}`} onClick={() => copy(value)}><Copy size={15} /></Button></div>)}{getAppUrl(device.app_nome) && <a href={getAppUrl(device.app_nome)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ExternalLink size={15} />Acessar painel do aplicativo</a>}</div>)}
              <Button className="w-full gap-2" variant="outline" onClick={() => { setForm({ ...emptyForm, app_nome: group?.name || '' }); setEditing(true); }}><Plus size={16} />Adicionar aplicativo</Button>
            </>}
          </>}
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
