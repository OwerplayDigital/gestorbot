import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { CheckCircle2, Clock3, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/pendencias')({ component: PendenciasPage });
type Pending = any;
type Client = { id: string; nome: string; whatsapp: string | null; vencimento: string; valor: number | null; desconto: number | null; plans?: { price?: number } | null };

function money(value: number) { return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`; }
function brDate(value?: string | null) { return value ? format(parseISO(value), 'dd/MM/yyyy') : 'Sem data'; }

function PendenciasPage() {
  const [filter, setFilter] = useState<'pendente' | 'pago'>('pendente');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Pending>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ cliente_id: '', valor: '', data_combinada: '', observacao: '' });
  const [saving, setSaving] = useState(false);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['pendencias', filter],
    queryFn: async () => {
      const { data, error } = await supabase.from('pendencias' as any).select('*, clientes(id,nome,whatsapp,vencimento)').eq('status', filter).order('data_combinada', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const today = format(toZonedTime(new Date(), 'America/Sao_Paulo'), 'yyyy-MM-dd');
  const pending = data as Pending[];
  const sorted = [...pending].sort((a, b) => {
    if (filter === 'pago') return String(b.pago_em || b.updated_at).localeCompare(String(a.pago_em || a.updated_at));
    const group = (item: Pending) => !item.data_combinada ? 3 : item.data_combinada < today ? 0 : item.data_combinada === today ? 1 : 2;
    const diff = group(a) - group(b); return diff || String(a.data_combinada || '').localeCompare(String(b.data_combinada || ''));
  });

  async function openNew() {
    const { data, error } = await supabase.from('clientes').select('id,nome,whatsapp,vencimento,valor,desconto,plans(price)').order('nome');
    if (error) { toast.error('Não foi possível carregar os clientes.'); return; }
    setClients((data || []) as any); setSelected(null); setForm({ cliente_id: '', valor: '', data_combinada: '', observacao: '' }); setFormOpen(true);
  }
  async function openEdit(item: Pending) {
    const { data } = await supabase.from('clientes').select('id,nome,whatsapp,vencimento,valor,desconto,plans(price)').order('nome');
    setClients((data || []) as any); setSelected(item); setForm({ cliente_id: item.cliente_id, valor: String(item.valor || '').replace('.', ','), data_combinada: item.data_combinada || '', observacao: item.observacao || '' }); setFormOpen(true);
  }
  function selectClient(id: string) {
    const client = clients.find((item) => item.id === id); const base = Number(client?.valor ?? client?.plans?.price ?? 0); const discount = Number(client?.desconto || 0);
    setForm((old) => ({ ...old, cliente_id: id, valor: old.valor || String(Math.max(0, base - discount)).replace('.', ',') }));
  }
  async function save() {
    if (saving || !form.cliente_id) return; const valor = Number(form.valor.replace(',', '.') || 0); if (!Number.isFinite(valor) || valor < 0) { toast.error('Valor inválido.'); return; }
    setSaving(true);
    try {
      const payload = { cliente_id: form.cliente_id, valor, data_combinada: form.data_combinada || null, observacao: form.observacao.trim(), updated_at: new Date().toISOString() };
      const result = selected ? await supabase.from('pendencias' as any).update(payload).eq('id', selected.id) : await supabase.from('pendencias' as any).insert(payload);
      if (result.error) throw result.error; toast.success(selected ? 'Pendência atualizada.' : 'Pendência adicionada.'); setFormOpen(false); await refetch();
    } catch (error) { console.error(error); toast.error('Não foi possível salvar a pendência.'); } finally { setSaving(false); }
  }
  async function markPaid(item: Pending) { const { error } = await supabase.from('pendencias' as any).update({ status: 'pago', pago_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.id); if (error) { toast.error('Não foi possível concluir.'); return; } toast.success('Pendência marcada como paga.'); await refetch(); }
  async function remove(item: Pending) { if (!window.confirm(`Excluir a pendência de ${item.clientes?.nome}?`)) return; const { error } = await supabase.from('pendencias' as any).delete().eq('id', item.id); if (error) { toast.error('Não foi possível excluir.'); return; } toast.success('Pendência excluída.'); await refetch(); }
  function whatsapp(item: Pending) { const raw = String(item.clientes?.whatsapp || '').replace(/\D/g, ''); if (!raw) { toast.error('Cliente sem WhatsApp cadastrado.'); return; } const phone = raw.startsWith('55') ? raw : `55${raw}`; window.open(`https://wa.me/${phone}`, '_blank'); }
  function status(item: Pending) { if (filter === 'pago') return { label: 'Pago', cls: 'text-emerald-500 bg-emerald-500/10' }; if (!item.data_combinada) return { label: 'Sem data', cls: 'text-muted-foreground bg-muted' }; if (item.data_combinada < today) return { label: 'Atrasado', cls: 'text-rose-500 bg-rose-500/10' }; if (item.data_combinada === today) return { label: 'Hoje', cls: 'text-amber-500 bg-amber-500/10' }; return { label: 'Próximo', cls: 'text-primary bg-primary/10' }; }

  return <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2"><Clock3 className="text-primary" />Pendências</h1><p className="text-sm text-muted-foreground mt-1">Controle de pagamentos combinados.</p></div><Button onClick={openNew} className="rounded-xl gap-2"><Plus size={17} />Nova</Button></div>
    <div className="flex gap-2"><Button size="sm" variant={filter === 'pendente' ? 'default' : 'outline'} onClick={() => setFilter('pendente')} className="rounded-xl">Pendentes</Button><Button size="sm" variant={filter === 'pago' ? 'default' : 'outline'} onClick={() => setFilter('pago')} className="rounded-xl">Concluídas</Button></div>
    {isLoading ? <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Carregando...</div> : !sorted.length ? <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Nenhuma pendência.</div> : <div className="space-y-3">{sorted.map((item) => { const s = status(item); return <div key={item.id} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black uppercase break-words">{item.clientes?.nome}</h3><span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${s.cls}`}>{s.label}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"><span><span className="text-muted-foreground">Valor: </span><b>{money(item.valor)}</b></span><span><span className="text-muted-foreground">Combinado: </span><b>{brDate(item.data_combinada)}</b></span>{item.clientes?.vencimento && <span><span className="text-muted-foreground">Venceu: </span>{brDate(item.clientes.vencimento)}</span>}</div>{item.observacao && <p className="mt-2 text-sm text-muted-foreground break-words">{item.observacao}</p>}</div><div className="flex shrink-0 gap-1"><Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={() => whatsapp(item)} title="WhatsApp"><MessageCircle size={16} /></Button>{filter === 'pendente' && <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={() => openEdit(item)} title="Editar"><Pencil size={16} /></Button>}{filter === 'pendente' && <Button size="icon" className="h-9 w-9 rounded-xl bg-emerald-500 hover:bg-emerald-600" onClick={() => markPaid(item)} title="Marcar como pago"><CheckCircle2 size={17} /></Button>}<Button size="icon" variant="outline" className="h-9 w-9 rounded-xl text-rose-500 border-rose-500/30" onClick={() => remove(item)} title="Excluir"><Trash2 size={16} /></Button></div></div></div>; })}</div>}

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-md rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">{selected ? 'Editar pendência' : 'Nova pendência'}</DialogTitle><DialogDescription>Somente controle de cobrança. Não altera renovação nem financeiro.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><label className="block text-sm font-medium">Cliente<select className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm" value={form.cliente_id} onChange={(e) => selectClient(e.target.value)}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}</select></label><label className="block text-sm font-medium">Valor pendente<Input className="mt-1" inputMode="decimal" value={form.valor} onChange={(e) => setForm((old) => ({ ...old, valor: e.target.value }))} /></label><label className="block text-sm font-medium">Data combinada <span className="font-normal text-muted-foreground">(opcional)</span><Input className="mt-1" type="date" value={form.data_combinada} onChange={(e) => setForm((old) => ({ ...old, data_combinada: e.target.value }))} /></label><label className="block text-sm font-medium">Observação<textarea className="mt-1 min-h-20 w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ex.: disse que paga semana que vem" value={form.observacao} onChange={(e) => setForm((old) => ({ ...old, observacao: e.target.value }))} /></label></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</Button><Button disabled={saving || !form.cliente_id} onClick={save}>{saving ? 'Salvando...' : 'Salvar'}</Button></div></DialogContent></Dialog>
  </div>;
}
