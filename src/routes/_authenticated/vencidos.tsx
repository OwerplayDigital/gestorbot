import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BOT_TEMPLATES } from '@/lib/templates';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Clock, MessageCircle, Send, RefreshCw, Minus, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';
import { ServerBadge } from '@/components/ServerBadge';

export const Route = createFileRoute('/_authenticated/vencidos')({ component: VencidosPage });
type Client = any;

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function VencidosPage() {
  const [selectedClient, setSelectedClient] = useState<Client>(null);
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isRenewSuccessOpen, setIsRenewSuccessOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renewDate, setRenewDate] = useState('');
  const [isRenewing, setIsRenewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients-expired'],
    queryFn: async () => {
      const [clientsRes, serversRes, templatesRes] = await Promise.all([
        supabase.from('clientes').select('*, plans(name, price)').order('vencimento', { ascending: true }),
        supabase.from('servidores_iptv').select('id, name'),
        supabase.from('templates_whatsapp' as any).select('*').order('nome', { ascending: true }),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
      nowBr.setHours(0, 0, 0, 0);
      const todayStr = format(nowBr, 'yyyy-MM-dd');
      return (clientsRes.data || []).filter(c => {
        const vencStr = c.vencimento;
        if (!vencStr) return false;
        const isoVenc = vencStr.includes('/') ? vencStr.split('/').reverse().join('-') : vencStr;
        return isoVenc < todayStr;
      }).map(c => {
        const vencStr = c.vencimento!;
        const isoVenc = vencStr.includes('/') ? vencStr.split('/').reverse().join('-') : vencStr;
        const vencDate = parseISO(isoVenc);
        const diff = differenceInDays(nowBr, vencDate);
        const serverNames = (c.servidores_ids || []).map((id: string) => serversRes.data?.find(s => s.id === id)?.name).filter(Boolean).join(', ');
        return { ...c, daysOverdue: diff, serverName: serverNames || 'N/A', templates: templatesRes.data || [] };
      });
    },
  });

  function openMessage(client: Client) {
    if (!client.whatsapp) { toast.error('Cliente sem WhatsApp cadastrado.'); return; }
    setSelectedClient(client); setIsMessageOpen(true);
  }

  function handleSendMessage(template: any) {
    if (!selectedClient) return;
    const firstName = selectedClient.nome.split(' ')[0];
    const valor = selectedClient.plans ? (Number(selectedClient.plans.price) - Number(selectedClient.desconto || 0)).toFixed(2) : '0.00';
    const paymentUrl = `https://gestorbot.lovable.app/pagar/${selectedClient.id}`;
    const vencimento = selectedClient.vencimento?.includes('-') ? format(parseISO(selectedClient.vencimento), 'dd/MM/yyyy') : selectedClient.vencimento;
    const message = template.system === 'cobranca'
      ? BOT_TEMPLATES.COBRANCA(firstName, vencimento, paymentUrl)
      : template.mensagem.replace(/{nome}/g, selectedClient.nome).replace(/{primeiro_nome}/g, firstName).replace(/{vencimento}/g, selectedClient.vencimento).replace(/{valor}/g, `R$ ${valor}`).replace(/{link_pagamento}/g, paymentUrl);
    const phoneRaw = selectedClient.whatsapp.replace(/\D/g, '');
    const phone = phoneRaw.startsWith('55') ? phoneRaw : `55${phoneRaw}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setIsMessageOpen(false);
  }

  function openRenew(client: Client) {
    const todayBr = format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
    setSelectedClient(client); setRenewDate(addDaysISO(todayBr, 30)); setIsRenewOpen(true);
  }

  function openDelete(client: Client) { setSelectedClient(client); setIsDeleteOpen(true); }

  async function confirmDelete() {
    if (!selectedClient || isDeleting) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', selectedClient.id);
      if (error) throw error;
      toast.success(`${selectedClient.nome} excluído.`);
      setIsDeleteOpen(false); setSelectedClient(null); await refetch();
    } catch (error) { console.error(error); toast.error('Não foi possível excluir o cliente.'); }
    finally { setIsDeleting(false); }
  }

  async function confirmRenew() {
    if (!selectedClient || !renewDate || isRenewing) return;
    setIsRenewing(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado.');
      const [{ data: plan, error: planError }, { data: serverRows, error: serverError }] = await Promise.all([
        supabase.from('plans').select('price').eq('id', selectedClient.plano_id).single(),
        selectedClient.servidores_ids?.length ? supabase.from('servidores_iptv').select('valor').in('id', selectedClient.servidores_ids) : Promise.resolve({ data: [], error: null } as any),
      ]);
      if (planError || !plan) throw planError || new Error('Plano não encontrado.');
      if (serverError) throw serverError;
      const valorEntrada = Math.max(0, Number(plan.price || 0) - Number(selectedClient.desconto || 0));
      const totalCusto = (serverRows || []).reduce((sum: number, s: any) => sum + Number(s.valor || 0), 0);
      const todayBr = format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
      const { error: renewalError } = await supabase.from('renovacoes').insert({ user_id: userId, cliente_id: selectedClient.id, plano_id: selectedClient.plano_id, valor: valorEntrada, desconto: Number(selectedClient.desconto || 0), vencimento_anterior: selectedClient.vencimento, novo_vencimento: renewDate, data_renovacao: new Date().toISOString() });
      if (renewalError) throw renewalError;
      const { error: transactionError } = await supabase.from('transacoes').insert({ user_id: userId, cliente_id: selectedClient.id, tipo: 'entrada', entrada: valorEntrada, custo: totalCusto, valor: valorEntrada, data: todayBr, descricao: `Renovação cliente ${selectedClient.id}`, serv_id: selectedClient.servidores_ids?.[0] || null });
      if (transactionError) throw transactionError;
      const { error: updateError } = await supabase.from('clientes').update({ vencimento: renewDate, status: 'ativo' }).eq('id', selectedClient.id);
      if (updateError) throw updateError;
      setSelectedClient({ ...selectedClient, vencimento: renewDate });
      setIsRenewOpen(false); setIsRenewSuccessOpen(true); toast.success(`${selectedClient.nome} renovado.`); await refetch();
    } catch (error) { console.error(error); toast.error('Não foi possível renovar o cliente.'); }
    finally { setIsRenewing(false); }
  }

  function sendRenewalMessage() {
    if (!selectedClient?.whatsapp || !selectedClient?.vencimento) { toast.error('Cliente sem WhatsApp cadastrado.'); return; }
    const firstName = (selectedClient.nome || 'Cliente').trim().split(' ')[0] || 'Cliente';
    const brDate = format(parseISO(selectedClient.vencimento), 'dd/MM/yyyy');
    const message = BOT_TEMPLATES.CONFIRMACAO(firstName, brDate);
    const phoneRaw = selectedClient.whatsapp.replace(/\D/g, '');
    const phone = phoneRaw.startsWith('55') ? phoneRaw : `55${phoneRaw}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setIsRenewSuccessOpen(false);
  }

  const ClientMenu = ({ client, mobile = false }: { client: Client; mobile?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl text-muted-foreground`} aria-label={`Mais opções para ${client.nome}`} title="Mais opções">
          <MoreVertical size={mobile ? 18 : 16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={() => openDelete(client)} className="cursor-pointer gap-2 text-rose-500 focus:text-rose-500"><Trash2 size={15} />Excluir cliente</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const Actions = ({ client, mobile = false }: { client: Client; mobile?: boolean }) => (
    <div className="flex items-center justify-end gap-2">
      <Button size="icon" variant="outline" title="Renovar" aria-label={`Renovar ${client.nome}`} onClick={() => openRenew(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl`}><RefreshCw size={mobile ? 18 : 16} /></Button>
      <Button size="icon" title="Mensagem" aria-label={`Enviar mensagem para ${client.nome}`} onClick={() => openMessage(client)} className={`${mobile ? 'h-11 w-11' : 'h-9 w-9'} rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white`}><MessageCircle size={mobile ? 18 : 16} /></Button>
      <ClientMenu client={client} mobile={mobile} />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500">
      <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2"><Clock className="text-rose-500" />Vencidos</h1>
      {isLoading ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Carregando lista de vencidos...</div> : !clients || clients.length === 0 ? <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">Nenhum cliente vencido.</div> : <>
        <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <Table><TableHeader><TableRow className="hover:bg-transparent border-muted/10"><TableHead className="font-bold">Cliente</TableHead><TableHead className="font-bold">Servidor/App</TableHead><TableHead className="font-bold">Vencimento</TableHead><TableHead className="font-bold">Atraso</TableHead><TableHead className="text-right font-bold">Ação</TableHead></TableRow></TableHeader>
            <TableBody>{clients.map(client => <TableRow key={client.id} className="hover:bg-muted/50 border-muted/10 transition-colors"><TableCell className="font-bold">{client.nome}</TableCell><TableCell><ServerBadge name={client.serverName} /></TableCell><TableCell><span className="text-rose-500 font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></TableCell><TableCell><span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">{client.daysOverdue} dias</span></TableCell><TableCell className="text-right"><Actions client={client} /></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="md:hidden space-y-4">{clients.map(client => <div key={client.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3"><div className="flex justify-between items-start gap-3"><div className="min-w-0"><h3 className="font-black text-lg uppercase leading-tight break-words">{client.nome}</h3><p className="break-words"><ServerBadge name={client.serverName} /></p></div><span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap">{client.daysOverdue} dias</span></div><div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Vencimento:</span><span className="text-rose-500 font-bold font-mono">{client.vencimento?.includes('-') ? format(parseISO(client.vencimento), 'dd/MM/yyyy') : client.vencimento}</span></div><Actions client={client} mobile /></div>)}</div>
      </>}

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black tracking-tighter">Excluir cliente?</DialogTitle><DialogDescription>Excluir <strong>{selectedClient?.nome}</strong> definitivamente? Esta ação não pode ser desfeita.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2 pt-3"><Button variant="outline" disabled={isDeleting} onClick={() => setIsDeleteOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={isDeleting} onClick={confirmDelete}>{isDeleting ? 'Excluindo...' : 'Excluir'}</Button></div></DialogContent></Dialog>
      <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">{selectedClient?.nome}</DialogTitle><DialogDescription>Ajuste a nova data e confirme.</DialogDescription></DialogHeader><div className="grid grid-cols-[52px_1fr_52px] gap-2 py-4"><Button variant="outline" onClick={() => setRenewDate(d => addDaysISO(d, -1))} className="h-12 rounded-xl"><Minus size={18} /></Button><div className="flex h-12 items-center justify-center rounded-xl border bg-muted/30 font-mono font-bold">{renewDate ? format(parseISO(renewDate), 'dd/MM/yyyy') : ''}</div><Button variant="outline" onClick={() => setRenewDate(d => addDaysISO(d, 1))} className="h-12 rounded-xl"><Plus size={18} /></Button></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={isRenewing} onClick={() => setIsRenewOpen(false)}>Cancelar</Button><Button disabled={isRenewing} onClick={confirmRenew}>{isRenewing ? 'Renovando...' : 'Renovar'}</Button></div></DialogContent></Dialog>
      <Dialog open={isRenewSuccessOpen} onOpenChange={setIsRenewSuccessOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Renovado — {selectedClient?.nome}</DialogTitle><DialogDescription>{selectedClient?.vencimento ? format(parseISO(selectedClient.vencimento), 'dd/MM/yyyy') : ''}</DialogDescription></DialogHeader><div className="grid gap-2 pt-2">{selectedClient?.whatsapp && <Button onClick={sendRenewalMessage} className="h-11 rounded-xl gap-2"><MessageCircle size={16} />Enviar mensagem</Button>}<Button variant="outline" onClick={() => setIsRenewSuccessOpen(false)} className="h-11 rounded-xl">Fechar</Button></div></DialogContent></Dialog>
      <Dialog open={isMessageOpen} onOpenChange={setIsMessageOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Selecionar Mensagem</DialogTitle><DialogDescription>Escolha um template para enviar para {selectedClient?.nome}</DialogDescription></DialogHeader><div className="grid gap-3 py-4"><Button variant="outline" onClick={() => handleSendMessage({ system: 'cobranca' })} className="justify-between h-14 px-4 rounded-xl border-primary/30"><span className="font-bold uppercase text-sm tracking-wide">Cobrança</span><Send size={16} /></Button>{selectedClient?.templates?.map((template: any) => <Button key={template.id} variant="outline" onClick={() => handleSendMessage(template)} className="justify-between h-14 px-4 rounded-xl"><span className="font-bold uppercase text-sm tracking-wide">{template.nome}</span><Send size={16} /></Button>)}</div></DialogContent></Dialog>
    </div>
  );
}
