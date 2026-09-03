import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Users, Search, ChevronLeft, ChevronRight, MessageCircle, Send, Pencil, ChevronDown, CalendarDays } from 'lucide-react';
import { ServerBadge } from '@/components/ServerBadge';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/clientes')({ component: ClientesPage });

type Client = any;
type Option = { id: string; name: string; price?: number; valor?: number };

function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<Client>(null);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isServerPickerOpen, setIsServerPickerOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [plans, setPlans] = useState<Option[]>([]);
  const [servers, setServers] = useState<Option[]>([]);
  const [editForm, setEditForm] = useState({ nome: '', whatsapp: '', vencimento: '', plano_id: '', desconto: '', servidores_ids: [] as string[] });
  const itemsPerPage = 10;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients-active', searchTerm, currentPage],
    queryFn: async () => {
      const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo'); nowBr.setHours(0, 0, 0, 0); const todayStr = format(nowBr, 'yyyy-MM-dd');
      const [{ data: serversData }, { data: templates }] = await Promise.all([
        supabase.from('servidores_iptv').select('id, name').order('name'),
        supabase.from('templates_whatsapp' as any).select('*').order('nome', { ascending: true }),
      ]);
      let query = supabase.from('clientes').select('*, plans(name, price)', { count: 'exact' }).gte('vencimento', todayStr).order('vencimento', { ascending: true });
      if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`);
      const from = (currentPage - 1) * itemsPerPage; const to = from + itemsPerPage - 1;
      const { data: clients, count, error } = await query.range(from, to); if (error) throw error;
      const processedClients = (clients || []).map(c => ({ ...c, serverName: (c.servidores_ids || []).map((id: string) => serversData?.find(s => s.id === id)?.name).filter(Boolean).join(', ') || 'N/A', templates: templates || [] }));
      return { clients: processedClients, totalCount: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / itemsPerPage);

  useEffect(() => {
    if (!isEditOpen) {
      setIsDatePickerOpen(false);
      setIsServerPickerOpen(false);
    }
  }, [isEditOpen]);

  const openMessageModal = (client: Client) => { if (!client.whatsapp) { toast.error('Cliente sem WhatsApp cadastrado.'); return; } setSelectedClient(client); setIsMessageOpen(true); };

  const handleSendMessage = (template: any) => {
    if (!selectedClient) return;
    const firstName = selectedClient.nome.split(' ')[0]; const valor = selectedClient.plans ? (Number(selectedClient.plans.price) - Number(selectedClient.desconto || 0)).toFixed(2) : '0.00';
    const message = template.mensagem.replace(/{nome}/g, selectedClient.nome).replace(/{primeiro_nome}/g, firstName).replace(/{vencimento}/g, selectedClient.vencimento).replace(/{valor}/g, `R$ ${valor}`);
    const phone = selectedClient.whatsapp.replace(/\D/g, ''); window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank'); setIsMessageOpen(false);
  };

  async function openEdit(client: Client) {
    const [{ data: planData }, { data: serverData }] = await Promise.all([
      supabase.from('plans').select('id, name, price').eq('active', true).order('name'),
      supabase.from('servidores_iptv').select('id, name').eq('active', true).order('name'),
    ]);
    setPlans(planData || []); setServers(serverData || []);
    setSelectedClient(client);
    setEditForm({ nome: client.nome || '', whatsapp: client.whatsapp || '', vencimento: client.vencimento || '', plano_id: client.plano_id || '', desconto: client.desconto == null ? '' : String(client.desconto), servidores_ids: client.servidores_ids || [] });
    setIsEditOpen(true);
  }

  async function saveEdit() {
    if (!selectedClient) return;
    if (!editForm.nome.trim() || !editForm.vencimento || !editForm.plano_id || editForm.servidores_ids.length === 0) { toast.error('Preencha nome, vencimento, plano e servidor.'); return; }
    const desconto = Number(editForm.desconto.replace(',', '.') || 0);
    if (!Number.isFinite(desconto) || desconto < 0) { toast.error('Desconto inválido.'); return; }
    const { error } = await supabase.from('clientes').update({ nome: editForm.nome.trim(), whatsapp: editForm.whatsapp.trim(), vencimento: editForm.vencimento, plano_id: editForm.plano_id, desconto, servidores_ids: editForm.servidores_ids }).eq('id', selectedClient.id);
    if (error) { toast.error('Não foi possível salvar o cliente.'); return; }
    toast.success('Cliente atualizado.'); setIsEditOpen(false); await refetch();
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2"><Users className="text-primary" />Clientes</h1></div><div className="flex items-center gap-2 w-full md:w-auto"><div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" /><Input placeholder="Buscar por nome..." className="pl-10 bg-card border-border rounded-xl h-11" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} /></div></div></div>
      {isLoading ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Carregando clientes...</div> : !data?.clients?.length ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Nenhum cliente ativo encontrado.</div> : <>
        <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm"><Table><TableHeader><TableRow><TableHead className="font-bold">Cliente</TableHead><TableHead className="font-bold">Servidor/App</TableHead><TableHead className="font-bold">Vencimento</TableHead><TableHead className="text-right font-bold">Ação</TableHead></TableRow></TableHeader><TableBody>{data.clients.map((client: Client) => <TableRow key={client.id}><TableCell className="font-bold">{client.nome}</TableCell><TableCell><ServerBadge name={client.serverName} /></TableCell><TableCell><span className="text-primary font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(client)} className="rounded-xl gap-2"><Pencil size={14} />Editar</Button><Button size="sm" onClick={() => openMessageModal(client)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-8 px-3 gap-2"><MessageCircle size={14} />Mensagem</Button></div></TableCell></TableRow>)}</TableBody></Table></div>
        <div className="md:hidden space-y-4">{data.clients.map((client: Client) => <div key={client.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"><div><h3 className="font-black text-lg uppercase leading-tight break-words">{client.nome}</h3><p className="break-words"><ServerBadge name={client.serverName} /></p></div><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Vencimento:</span><span className="text-primary font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => openEdit(client)} className="w-full rounded-xl h-11 gap-2"><Pencil size={16} />Editar</Button><Button onClick={() => openMessageModal(client)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-11 gap-2"><MessageCircle size={18} />Mensagem</Button></div></div>)}</div>
        {totalPages > 1 && <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border"><span className="text-sm text-muted-foreground font-medium">Página <span className="text-foreground font-bold">{currentPage}</span> de <span className="text-foreground font-bold">{totalPages}</span></span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="rounded-xl"><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button><Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="rounded-xl">Próximo<ChevronRight className="h-4 w-4 ml-1" /></Button></div></div>}
      </>}

      <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Selecionar Mensagem</DialogTitle><DialogDescription>Escolha um template para enviar para {selectedClient?.nome}</DialogDescription></DialogHeader><div className="grid gap-3 py-4">{selectedClient?.templates?.length ? selectedClient.templates.map((template: any) => <Button key={template.id} variant="outline" onClick={() => handleSendMessage(template)} className="justify-between h-14 px-4 rounded-xl"><span className="font-bold uppercase text-sm tracking-wide">{template.nome}</span><Send size={16} /></Button>) : <p className="text-center py-4 text-muted-foreground text-sm">Nenhum template cadastrado em 'Mensagens'.</p>}</div></DialogContent></Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}><DialogContent onOpenAutoFocus={e => e.preventDefault()} className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Editar Cliente</DialogTitle><DialogDescription>Altere os dados do cadastro sem sair do Gestor.</DialogDescription></DialogHeader><div className="space-y-4 py-3"><label className="block text-sm font-medium">Nome<Input autoFocus={false} className="mt-1" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} /></label><label className="block text-sm font-medium">WhatsApp<Input autoFocus={false} className="mt-1" inputMode="tel" value={editForm.whatsapp} onChange={e => setEditForm(f => ({ ...f, whatsapp: e.target.value }))} /></label><div><p className="text-sm font-medium mb-2">Vencimento</p><Button type="button" variant="outline" onClick={() => setIsDatePickerOpen(true)} className="w-full h-11 justify-between rounded-xl font-normal"><span>{editForm.vencimento ? format(parseISO(editForm.vencimento), 'dd/MM/yyyy') : 'Selecione a data'}</span><CalendarDays className="h-4 w-4 text-muted-foreground" /></Button></div><label className="block text-sm font-medium">Plano<select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={editForm.plano_id} onChange={e => setEditForm(f => ({ ...f, plano_id: e.target.value }))}><option value="">Selecione</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name} — {money(p.price || 0)}</option>)}</select></label><label className="block text-sm font-medium">Desconto (R$)<Input autoFocus={false} className="mt-1" inputMode="decimal" value={editForm.desconto} onChange={e => setEditForm(f => ({ ...f, desconto: e.target.value }))} /></label><div><p className="text-sm font-medium mb-2">Servidor</p><Button type="button" variant="outline" onClick={() => setIsServerPickerOpen(true)} className="w-full h-11 justify-between rounded-xl font-normal"><span className="min-w-0 truncate text-left">{editForm.servidores_ids.length ? editForm.servidores_ids.map(id => servers.find(s => s.id === id)?.name).filter(Boolean).join(', ') : 'Selecione o servidor'}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /></Button></div></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button><Button onClick={saveEdit}>Salvar alterações</Button></div></DialogContent></Dialog>

      <Dialog open={isServerPickerOpen} onOpenChange={setIsServerPickerOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Selecionar Servidor</DialogTitle><DialogDescription>Escolha um ou mais servidores para este cliente.</DialogDescription></DialogHeader><div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">{servers.length ? servers.map(s => <label key={s.id} className="flex items-center gap-3 rounded-xl border p-4 text-sm cursor-pointer hover:bg-muted/50"><input type="checkbox" className="h-4 w-4" checked={editForm.servidores_ids.includes(s.id)} onChange={e => setEditForm(f => ({ ...f, servidores_ids: e.target.checked ? [...f.servidores_ids, s.id] : f.servidores_ids.filter(id => id !== s.id) }))} /><span className="font-medium break-words">{s.name}</span></label>) : <p className="text-center py-6 text-muted-foreground">Nenhum servidor disponível.</p>}</div><Button onClick={() => setIsServerPickerOpen(false)} className="w-full h-11 rounded-xl">Concluir</Button></DialogContent></Dialog>

      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}><DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl p-4"><DialogHeader><DialogTitle className="text-lg font-black uppercase tracking-tighter">Data de vencimento</DialogTitle><DialogDescription>Escolha a data do vencimento.</DialogDescription></DialogHeader><div className="flex justify-center py-2"><Calendar mode="single" locale={ptBR} selected={editForm.vencimento ? parseISO(editForm.vencimento) : undefined} onSelect={date => { if (date) { setEditForm(f => ({ ...f, vencimento: format(date, 'yyyy-MM-dd') })); setIsDatePickerOpen(false); } }} initialFocus /></div></DialogContent></Dialog>
    </div>
  );
}

function money(value: number) { return `R$ ${Number(value).toFixed(2).replace('.', ',')}` }
