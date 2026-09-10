import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BOT_TEMPLATES } from '@/lib/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Users, Search, ChevronLeft, ChevronRight, MessageCircle, Send, Pencil, ChevronDown, CalendarDays, RefreshCw, Minus, Plus, Smartphone, Copy, PlusCircle } from 'lucide-react';
import { ServerBadge } from '@/components/ServerBadge';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/clientes')({ component: ClientesPage });
type Client = any;
type Option = { id: string; name: string; price?: number; valor?: number };
type AppMode = 'view' | 'edit' | 'new';

const APP_CATALOG = [
  { name: 'Ibo Pro', url: 'https://iboproapp.com/manage-playlists/login/' },
  { name: 'Ibo Player', url: 'https://iboplayer.com/device/login' },
  { name: 'Bob Player', url: 'https://bobplayer.com/device/login' },
] as const;

const SERVER_PANELS = [
  { names: ['uniplay'], url: 'https://searchdefense.top/#/login' },
  { names: ['goat'], url: 'https://goatnt.com/' },
  { names: ['p2braz', 'p2bras', 'p2 braz', 'p2 bras'], url: 'https://painel.fun/lock?redirect=%2Fusers' },
] as const;

function getAppUrl(name: string) {
  return APP_CATALOG.find((app) => app.name.toLowerCase() === String(name || '').toLowerCase())?.url;
}

function getServerPanelUrl(name: string) {
  const normalized = String(name || '').trim().toLowerCase();
  return SERVER_PANELS.find((server) => server.names.some((alias) => alias === normalized))?.url;
}

function getServerPanelClass(name: string) {
  if (/uniplay/i.test(name)) return 'bg-sky-500/10 text-sky-500 border-sky-500/30 hover:bg-sky-500/15';
  if (/goat/i.test(name)) return 'bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/15';
  if (/p2braz/i.test(name)) return 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/15';
  return '';
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [serverFilter, setServerFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client>(null);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isRenewSuccessOpen, setIsRenewSuccessOpen] = useState(false);
  const [isAppOpen, setIsAppOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('view');
  const [renewDate, setRenewDate] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [isAppSaving, setIsAppSaving] = useState(false);
  const [isServerPickerOpen, setIsServerPickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [plans, setPlans] = useState<Option[]>([]);
  const [servers, setServers] = useState<Option[]>([]);
  const [editForm, setEditForm] = useState({ nome: '', whatsapp: '', vencimento: '', plano_id: '', desconto: '', servidores_ids: [] as string[] });
  const [appForm, setAppForm] = useState({ id: '', app_nome: '', mac_address: '', app_key: '' });
  const itemsPerPage = 10;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients-active', searchTerm, planFilter, serverFilter, currentPage],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
      nowBr.setHours(0, 0, 0, 0);
      const todayStr = format(nowBr, 'yyyy-MM-dd');
      const [{ data: serversData }, { data: templates }, { data: filterPlans }] = await Promise.all([
        supabase.from('servidores_iptv').select('id, name').order('name'),
        supabase.from('templates_whatsapp' as any).select('*').order('nome', { ascending: true }),
        supabase.from('plans').select('id, name').eq('active', true).order('name'),
      ]);
      let query = supabase.from('clientes').select('*, plans(name, price)', { count: 'exact' }).gte('vencimento', todayStr).order('vencimento', { ascending: true });
      if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`);
      if (planFilter) query = query.eq('plano_id', planFilter);
      if (serverFilter) query = query.contains('servidores_ids', [serverFilter]);
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const { data: clients, count, error } = await query.range(from, to);
      if (error) throw error;
      const clientIds = (clients || []).map((client) => client.id);
      let devices: any[] = [];
      if (clientIds.length) {
        const { data: deviceRows, error: deviceError } = await supabase.from('dispositivos').select('id, cliente_id, app_nome, mac_address, app_key, created_at').in('cliente_id', clientIds).order('created_at', { ascending: true });
        if (deviceError) throw deviceError;
        devices = deviceRows || [];
      }
      const processedClients = (clients || []).map((client) => ({
        ...client,
        serverName: (client.servidores_ids || []).map((id: string) => serversData?.find((server) => server.id === id)?.name).filter(Boolean).join(', ') || 'N/A',
        templates: templates || [],
        devices: devices.filter((device) => device.cliente_id === client.id),
      }));
      return { clients: processedClients, totalCount: count || 0, filterPlans: filterPlans || [], filterServers: serversData || [] };
    },
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / itemsPerPage);
  useEffect(() => { if (!isEditOpen) { setIsDatePickerOpen(false); setIsServerPickerOpen(false); } }, [isEditOpen]);

  const openMessageModal = (client: Client) => { if (!client.whatsapp) { toast.error('Cliente sem WhatsApp cadastrado.'); return; } setSelectedClient(client); setIsMessageOpen(true); };
  const openApp = (client: Client) => { setSelectedClient(client); setAppForm({ id: '', app_nome: '', mac_address: '', app_key: '' }); setAppMode('view'); setIsAppOpen(true); };
  const startNewApp = () => { setAppMode('new'); setAppForm({ id: '', app_nome: '', mac_address: '', app_key: '' }); };
  const startEditApp = (device: any) => { setAppMode('edit'); setAppForm({ id: device.id, app_nome: device.app_nome || '', mac_address: device.mac_address || '', app_key: device.app_key || '' }); };
  const copyValue = async (value: string, label: string) => { if (!value) return; try { await navigator.clipboard.writeText(value); toast.success(`${label} copiado.`); } catch { toast.error(`Não foi possível copiar ${label}.`); } };

  async function saveAppData() {
    if (!selectedClient || isAppSaving) return;
    if (!appForm.app_nome.trim()) { toast.error('Informe o aplicativo.'); return; }
    setIsAppSaving(true);
    try {
      const payload = { cliente_id: selectedClient.id, app_nome: appForm.app_nome.trim(), mac_address: appForm.mac_address.trim(), app_key: appForm.app_key.trim() || null };
      if (appForm.id) { const { error } = await supabase.from('dispositivos').update(payload).eq('id', appForm.id); if (error) throw error; }
      else { const { error } = await supabase.from('dispositivos').insert(payload); if (error) throw error; }
      toast.success(appForm.id ? 'Dados do aplicativo atualizados.' : 'Aplicativo adicionado.');
      await refetch(); setAppMode('view');
    } catch (error) { console.error(error); toast.error('Não foi possível salvar os dados do aplicativo.'); }
    finally { setIsAppSaving(false); }
  }

  const handleSendMessage = (template: any) => {
    if (!selectedClient) return;
    const firstName = selectedClient.nome.split(' ')[0];
    const valor = selectedClient.plans ? (Number(selectedClient.plans.price) - Number(selectedClient.desconto || 0)).toFixed(2) : '0.00';
    const message = template.mensagem.replace(/{nome}/g, selectedClient.nome).replace(/{primeiro_nome}/g, firstName).replace(/{vencimento}/g, selectedClient.vencimento).replace(/{valor}/g, `R$ ${valor}`);
    const phoneRaw = selectedClient.whatsapp.replace(/\D/g, ''); const phone = phoneRaw.startsWith('55') ? phoneRaw : `55${phoneRaw}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank'); setIsMessageOpen(false);
  };

  function sendRenewalMessage() {
    if (!selectedClient?.whatsapp || !selectedClient?.vencimento) { toast.error('Cliente sem WhatsApp cadastrado.'); return; }
    const firstName = (selectedClient.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
    const brDate = format(parseISO(selectedClient.vencimento), 'dd/MM/yyyy');
    const message = BOT_TEMPLATES.CONFIRMACAO(firstName, brDate);
    const phoneRaw = selectedClient.whatsapp.replace(/\D/g, ''); const phone = phoneRaw.startsWith('55') ? phoneRaw : `55${phoneRaw}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank'); setIsRenewSuccessOpen(false);
  }

  function openRenew(client: Client) { const current = String(client.vencimento || '').slice(0, 10); if (!current) { toast.error('Cliente sem vencimento válido.'); return; } setSelectedClient(client); setRenewDate(addDaysISO(current, 30)); setIsRenewOpen(true); }

  async function confirmRenew() {
    if (!selectedClient || !renewDate || isRenewing) return; setIsRenewing(true);
    try {
      const { data: authData } = await supabase.auth.getUser(); const userId = authData.user?.id; if (!userId) throw new Error('Usuário não autenticado.');
      const [{ data: plan, error: planError }, { data: serverRows, error: serverError }] = await Promise.all([
        supabase.from('plans').select('price').eq('id', selectedClient.plano_id).single(),
        selectedClient.servidores_ids?.length ? supabase.from('servidores_iptv').select('valor').in('id', selectedClient.servidores_ids) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (planError || !plan) throw planError || new Error('Plano não encontrado.'); if (serverError) throw serverError;
      const valorEntrada = Math.max(0, Number(plan.price || 0) - Number(selectedClient.desconto || 0)); const totalCusto = (serverRows || []).reduce((sum: number, server: any) => sum + Number(server.valor || 0), 0); const todayBr = format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
      const { error: renewalError } = await supabase.from('renovacoes').insert({ user_id: userId, cliente_id: selectedClient.id, plano_id: selectedClient.plano_id, valor: valorEntrada, desconto: Number(selectedClient.desconto || 0), vencimento_anterior: selectedClient.vencimento, novo_vencimento: renewDate, data_renovacao: new Date().toISOString() }); if (renewalError) throw renewalError;
      const { error: transactionError } = await supabase.from('transacoes').insert({ user_id: userId, cliente_id: selectedClient.id, tipo: 'entrada', entrada: valorEntrada, custo: totalCusto, valor: valorEntrada, data: todayBr, descricao: `Renovação cliente ${selectedClient.id}`, serv_id: selectedClient.servidores_ids?.[0] || null }); if (transactionError) throw transactionError;
      const { error: updateError } = await supabase.from('clientes').update({ vencimento: renewDate, status: 'ativo' }).eq('id', selectedClient.id); if (updateError) throw updateError;
      setSelectedClient({ ...selectedClient, vencimento: renewDate }); setIsRenewOpen(false); setIsRenewSuccessOpen(true); toast.success(`${selectedClient.nome} renovado.`); await refetch();
    } catch (error) { console.error(error); toast.error('Não foi possível renovar o cliente.'); } finally { setIsRenewing(false); }
  }

  async function openEdit(client: Client) {
    const [{ data: planData }, { data: serverData }] = await Promise.all([supabase.from('plans').select('id, name, price').eq('active', true).order('name'), supabase.from('servidores_iptv').select('id, name').eq('active', true).order('name')]);
    setPlans(planData || []); setServers(serverData || []); setSelectedClient(client); setEditForm({ nome: client.nome || '', whatsapp: client.whatsapp || '', vencimento: client.vencimento || '', plano_id: client.plano_id || '', desconto: client.desconto == null ? '' : String(client.desconto), servidores_ids: client.servidores_ids || [] }); setIsEditOpen(true);
  }

  async function saveEdit() {
    if (!selectedClient) return; if (!editForm.nome.trim() || !editForm.vencimento || !editForm.plano_id || editForm.servidores_ids.length === 0) { toast.error('Preencha nome, vencimento, plano e servidor.'); return; }
    const desconto = Number(editForm.desconto.replace(',', '.') || 0); if (!Number.isFinite(desconto) || desconto < 0) { toast.error('Desconto inválido.'); return; }
    const { error } = await supabase.from('clientes').update({ nome: editForm.nome.trim(), whatsapp: editForm.whatsapp.trim(), vencimento: editForm.vencimento, plano_id: editForm.plano_id, desconto, servidores_ids: editForm.servidores_ids }).eq('id', selectedClient.id);
    if (error) { toast.error('Não foi possível salvar o cliente.'); return; } toast.success('Cliente atualizado.'); setIsEditOpen(false); await refetch();
  }

  const Actions = ({ client, mobile = false }: { client: Client; mobile?: boolean }) => <div className="flex items-center justify-end gap-2">
    <Button size="icon" variant="outline" title="Editar" aria-label={`Editar ${client.nome}`} onClick={() => openEdit(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl`}><Pencil size={mobile ? 18 : 16} /></Button>
    <Button size="icon" variant="outline" title="Renovar" aria-label={`Renovar ${client.nome}`} onClick={() => openRenew(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl`}><RefreshCw size={mobile ? 18 : 16} /></Button>
    <Button size="icon" variant="outline" title="Dados do aplicativo" aria-label={`Dados do aplicativo de ${client.nome}`} onClick={() => openApp(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl ${client.devices?.length ? 'text-primary border-primary/30 bg-primary/5' : ''}`}><Smartphone size={mobile ? 18 : 16} /></Button>
    <Button size="icon" title="Mensagem" aria-label={`Enviar mensagem para ${client.nome}`} onClick={() => openMessageModal(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl bg-emerald-500 text-white hover:bg-emerald-600`}><MessageCircle size={mobile ? 19 : 17} /></Button>
  </div>;

  const selectedDevices = data?.clients?.find((client: Client) => client.id === selectedClient?.id)?.devices || [];
  const selectedServers = (data?.filterServers || []).filter((server: Option) => selectedClient?.servidores_ids?.includes(server.id)).map((server: Option) => ({ ...server, panelUrl: getServerPanelUrl(server.name) })).filter((server: any) => server.panelUrl);

  return <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2"><Users className="text-primary" />Clientes</h1><div className="grid grid-cols-2 gap-2 w-full md:flex md:w-auto"><div className="relative col-span-2 w-full md:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" /><Input placeholder="Buscar por nome..." className="pl-10 bg-card border-border rounded-xl h-11" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div><select className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring md:w-44" value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}><option value="">Todos os planos</option>{data?.filterPlans?.map((plan: Option) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><select className="h-11 min-w-0 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring md:w-44" value={serverFilter} onChange={(e) => { setServerFilter(e.target.value); setCurrentPage(1); }}><option value="">Todos os servidores</option>{data?.filterServers?.map((server: Option) => <option key={server.id} value={server.id}>{server.name}</option>)}</select></div></div>

    {isLoading ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Carregando clientes...</div> : !data?.clients?.length ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Nenhum cliente ativo encontrado.</div> : <><div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm"><Table><TableHeader><TableRow><TableHead className="font-bold">Cliente</TableHead><TableHead className="font-bold">Servidor/App</TableHead><TableHead className="font-bold">Vencimento</TableHead><TableHead className="text-right font-bold">Ação</TableHead></TableRow></TableHeader><TableBody>{data.clients.map((client: Client) => <TableRow key={client.id}><TableCell className="font-bold">{client.nome}</TableCell><TableCell><ServerBadge name={client.serverName} /></TableCell><TableCell><span className="text-primary font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></TableCell><TableCell><Actions client={client} /></TableCell></TableRow>)}</TableBody></Table></div><div className="md:hidden space-y-4">{data.clients.map((client: Client) => <div key={client.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"><div><h3 className="font-black text-lg uppercase leading-tight break-words">{client.nome}</h3><p><ServerBadge name={client.serverName} /></p></div><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Vencimento:</span><span className="text-primary font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></div><Actions client={client} mobile /></div>)}</div>{totalPages > 1 && <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border"><span className="text-sm text-muted-foreground font-medium">Página <b className="text-foreground">{currentPage}</b> de <b className="text-foreground">{totalPages}</b></span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded-xl">Próximo<ChevronRight className="h-4 w-4 ml-1" /></Button></div></div>}</>}

    <Dialog open={isAppOpen} onOpenChange={setIsAppOpen}><DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter"><Smartphone className="text-primary" size={20} />Dados do aplicativo</DialogTitle><DialogDescription>{selectedClient?.nome}</DialogDescription></DialogHeader>
      {appMode === 'view' ? <div className="space-y-3 py-2">{selectedServers.length > 0 && <div className="rounded-2xl border bg-primary/5 p-4 space-y-2"><span className="text-xs text-muted-foreground">Servidor{selectedServers.length > 1 ? 'es' : ''}</span>{selectedServers.map((server: any) => <Button key={server.id} variant="outline" onClick={() => window.open(server.panelUrl, '_blank', 'noopener,noreferrer')} className={`w-full h-10 rounded-xl justify-between ${getServerPanelClass(server.name)}`}><span className="font-semibold">{server.name}</span><span className="text-xs opacity-80">Acessar painel</span></Button>)}</div>}{selectedDevices.map((device: any) => { const appUrl = getAppUrl(device.app_nome); return <div key={device.id} className="rounded-2xl border bg-muted/20 p-4 space-y-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><span className="text-xs text-muted-foreground">Aplicativo</span><p className="font-black break-words">{device.app_nome}</p></div><Button size="icon" variant="outline" title="Editar aplicativo" aria-label={`Editar ${device.app_nome}`} onClick={() => startEditApp(device)} className="h-9 w-9 shrink-0 rounded-xl"><Pencil size={16} /></Button></div>{device.mac_address && <div className="flex items-center justify-between gap-3"><div className="min-w-0"><span className="text-xs text-muted-foreground">MAC</span><p className="font-mono font-bold break-all">{device.mac_address}</p></div><Button size="icon" variant="outline" title="Copiar MAC" aria-label="Copiar MAC" onClick={() => copyValue(device.mac_address, 'MAC')} className="h-9 w-9 shrink-0 rounded-xl"><Copy size={16} /></Button></div>}{device.app_key && <div className="flex items-center justify-between gap-3"><div className="min-w-0"><span className="text-xs text-muted-foreground">Key</span><p className="font-mono font-bold break-all">{device.app_key}</p></div><Button size="icon" variant="outline" title="Copiar Key" aria-label="Copiar Key" onClick={() => copyValue(device.app_key, 'Key')} className="h-9 w-9 shrink-0 rounded-xl"><Copy size={16} /></Button></div>}{appUrl && <Button variant="outline" onClick={() => window.open(appUrl, '_blank', 'noopener,noreferrer')} className="w-full h-10 rounded-xl">Acessar painel</Button>}</div>; })}<Button variant="outline" onClick={startNewApp} className="w-full h-11 rounded-xl gap-2"><PlusCircle size={17} />Adicionar aplicativo</Button><Button onClick={() => setIsAppOpen(false)} className="w-full h-11 rounded-xl">Fechar</Button></div> : <div className="space-y-4 py-2"><label className="block text-sm font-medium">Aplicativo<select autoFocus={false} className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={appForm.app_nome} onChange={(e) => setAppForm((form) => ({ ...form, app_nome: e.target.value }))}><option value="">Selecione o aplicativo</option>{APP_CATALOG.map((app) => <option key={app.name} value={app.name}>{app.name}</option>)}{appForm.app_nome && !getAppUrl(appForm.app_nome) && <option value={appForm.app_nome}>{appForm.app_nome}</option>}</select></label><div><span className="text-sm font-medium">MAC</span><div className="mt-1 flex gap-2"><Input autoFocus={false} className="font-mono" placeholder="00:00:00:00:00:00" value={appForm.mac_address} onChange={(e) => setAppForm((form) => ({ ...form, mac_address: e.target.value }))} /><Button type="button" size="icon" variant="outline" disabled={!appForm.mac_address} title="Copiar MAC" aria-label="Copiar MAC" onClick={() => copyValue(appForm.mac_address, 'MAC')} className="shrink-0 rounded-xl"><Copy size={17} /></Button></div></div><div><span className="text-sm font-medium">Key</span><div className="mt-1 flex gap-2"><Input autoFocus={false} className="font-mono" placeholder="Chave do aplicativo" value={appForm.app_key} onChange={(e) => setAppForm((form) => ({ ...form, app_key: e.target.value }))} /><Button type="button" size="icon" variant="outline" disabled={!appForm.app_key} title="Copiar Key" aria-label="Copiar Key" onClick={() => copyValue(appForm.app_key, 'Key')} className="shrink-0 rounded-xl"><Copy size={17} /></Button></div></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={isAppSaving} onClick={() => setAppMode('view')}>Cancelar</Button><Button disabled={isAppSaving} onClick={saveAppData}>{isAppSaving ? 'Salvando...' : appMode === 'edit' ? 'Salvar' : 'Adicionar'}</Button></div></div>}
    </DialogContent></Dialog>

    <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">{selectedClient?.nome}</DialogTitle><DialogDescription>Ajuste a nova data e confirme.</DialogDescription></DialogHeader><div className="grid grid-cols-[52px_1fr_52px] gap-2 py-4"><Button variant="outline" onClick={() => setRenewDate((date) => addDaysISO(date, -1))} className="h-12 rounded-xl"><Minus size={18} /></Button><div className="flex h-12 items-center justify-center rounded-xl border bg-muted/30 font-mono font-bold">{renewDate ? format(parseISO(renewDate), 'dd/MM/yyyy') : ''}</div><Button variant="outline" onClick={() => setRenewDate((date) => addDaysISO(date, 1))} className="h-12 rounded-xl"><Plus size={18} /></Button></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={isRenewing} onClick={() => setIsRenewOpen(false)}>Cancelar</Button><Button disabled={isRenewing} onClick={confirmRenew}>{isRenewing ? 'Renovando...' : 'Renovar'}</Button></div></DialogContent></Dialog>
    <Dialog open={isRenewSuccessOpen} onOpenChange={setIsRenewSuccessOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Renovado — {selectedClient?.nome}</DialogTitle><DialogDescription>{selectedClient?.vencimento ? format(parseISO(selectedClient.vencimento), 'dd/MM/yyyy') : ''}</DialogDescription></DialogHeader><div className="grid gap-2 pt-2">{selectedClient?.whatsapp && <Button onClick={sendRenewalMessage} className="h-11 rounded-xl gap-2"><MessageCircle size={16} />Enviar mensagem</Button>}<Button variant="outline" onClick={() => setIsRenewSuccessOpen(false)} className="h-11 rounded-xl">Fechar</Button></div></DialogContent></Dialog>
    <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Selecionar Mensagem</DialogTitle><DialogDescription>Escolha um template para enviar para {selectedClient?.nome}</DialogDescription></DialogHeader><div className="grid gap-3 py-4">{selectedClient?.templates?.length ? selectedClient.templates.map((template: any) => <Button key={template.id} variant="outline" onClick={() => handleSendMessage(template)} className="justify-between h-14 px-4 rounded-xl"><span className="font-bold uppercase text-sm tracking-wide">{template.nome}</span><Send size={16} /></Button>) : <p className="text-center py-4 text-muted-foreground text-sm">Nenhum template cadastrado em 'Mensagens'.</p>}</div></DialogContent></Dialog>

    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent onOpenAutoFocus={(event) => event.preventDefault()} className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Editar Cliente</DialogTitle><DialogDescription>Altere os dados do cadastro sem sair do Gestor.</DialogDescription></DialogHeader><div className="space-y-4 py-3"><label className="block text-sm font-medium">Nome<Input className="mt-1" value={editForm.nome} onChange={(e) => setEditForm((form) => ({ ...form, nome: e.target.value }))} /></label><label className="block text-sm font-medium">WhatsApp<Input className="mt-1" inputMode="tel" value={editForm.whatsapp} onChange={(e) => setEditForm((form) => ({ ...form, whatsapp: e.target.value }))} /></label><div><p className="text-sm font-medium mb-2">Vencimento</p><Button type="button" variant="outline" onClick={() => setIsDatePickerOpen(true)} className="w-full h-11 justify-between rounded-xl font-normal"><span>{editForm.vencimento ? format(parseISO(editForm.vencimento), 'dd/MM/yyyy') : 'Selecione a data'}</span><CalendarDays className="h-4 w-4 text-muted-foreground" /></Button></div><label className="block text-sm font-medium">Plano<select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={editForm.plano_id} onChange={(e) => setEditForm((form) => ({ ...form, plano_id: e.target.value }))}><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — {money(plan.price || 0)}</option>)}</select></label><label className="block text-sm font-medium">Desconto (R$)<Input className="mt-1" inputMode="decimal" value={editForm.desconto} onChange={(e) => setEditForm((form) => ({ ...form, desconto: e.target.value }))} /></label><div><p className="text-sm font-medium mb-2">Servidor</p><Button type="button" variant="outline" onClick={() => setIsServerPickerOpen(true)} className="w-full h-11 justify-between rounded-xl font-normal"><span className="min-w-0 truncate text-left">{editForm.servidores_ids.length ? editForm.servidores_ids.map((id) => servers.find((server) => server.id === id)?.name).filter(Boolean).join(', ') : 'Selecione o servidor'}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /></Button></div></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button><Button onClick={saveEdit}>Salvar alterações</Button></div></DialogContent></Dialog>
    <Dialog open={isServerPickerOpen} onOpenChange={setIsServerPickerOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Selecionar Servidor</DialogTitle><DialogDescription>Escolha um ou mais servidores para este cliente.</DialogDescription></DialogHeader><div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">{servers.length ? servers.map((server) => <label key={server.id} className="flex items-center gap-3 rounded-xl border p-4 text-sm cursor-pointer hover:bg-muted/50"><input type="checkbox" className="h-4 w-4" checked={editForm.servidores_ids.includes(server.id)} onChange={(e) => setEditForm((form) => ({ ...form, servidores_ids: e.target.checked ? [...form.servidores_ids, server.id] : form.servidores_ids.filter((id) => id !== server.id) }))} /><span className="font-medium break-words">{server.name}</span></label>) : <p className="text-center py-6 text-muted-foreground">Nenhum servidor disponível.</p>}</div><Button onClick={() => setIsServerPickerOpen(false)} className="w-full h-11 rounded-xl">Concluir</Button></DialogContent></Dialog>
    <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}><DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-4"><DialogHeader><DialogTitle className="text-lg font-black uppercase tracking-tighter">Data de vencimento</DialogTitle><DialogDescription>Escolha a data do vencimento.</DialogDescription></DialogHeader><div className="flex justify-center py-2"><Calendar mode="single" locale={ptBR} selected={editForm.vencimento ? parseISO(editForm.vencimento) : undefined} onSelect={(date) => { if (date) { setEditForm((form) => ({ ...form, vencimento: format(date, 'yyyy-MM-dd') })); setIsDatePickerOpen(false); } }} initialFocus /></div></DialogContent></Dialog>
  </div>;
}

function money(value: number) { return `R$ ${Number(value).toFixed(2).replace('.', ',')}`; }
