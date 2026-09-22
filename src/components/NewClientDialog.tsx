import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Plus, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';

type Option = { id: string; name: string; price?: number; valor?: number };
const emptyForm = { nome: '', whatsapp: '', vencimento: '', plano_id: '', desconto: '', servidores_ids: [] as string[] };

export function NewClientDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Option[]>([]);
  const [servers, setServers] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [consumeCredit, setConsumeCredit] = useState(true);
  const [addFund, setAddFund] = useState(true);

  async function openDialog() {
    const [{ data: planData }, { data: serverData }] = await Promise.all([
      supabase.from('plans').select('id, name, price').eq('active', true).order('name'),
      supabase.from('servidores_iptv').select('id, name, valor').eq('active', true).order('name'),
    ]);
    setPlans(planData || []); setServers(serverData || []); setForm(emptyForm); setConsumeCredit(true); setAddFund(true); setOpen(true);
  }

  async function save() {
    if (saving) return;
    if (!form.nome.trim() || !form.whatsapp.trim() || !form.vencimento || !form.plano_id || form.servidores_ids.length === 0) { toast.error('Preencha nome, WhatsApp, vencimento, plano e servidor.'); return; }
    const desconto = Number(form.desconto.replace(',', '.') || 0);
    if (!Number.isFinite(desconto) || desconto < 0) { toast.error('Desconto inválido.'); return; }
    setSaving(true);
    let createdClientId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado.');

      const plan = plans.find((item) => item.id === form.plano_id);
      const valor = Math.max(0, Number(plan?.price || 0) - desconto);
      const isFreePlan = Number(plan?.price || 0) === 0;
      const custo = form.servidores_ids.reduce((total, id) => total + Number(servers.find((server) => server.id === id)?.valor || 0), 0);

      const { data: client, error: clientError } = await supabase.from('clientes').insert({
        user_id: userId,
        nome: form.nome.trim(),
        whatsapp: form.whatsapp.trim(),
        vencimento: form.vencimento,
        plano_id: form.plano_id,
        servidores_ids: form.servidores_ids,
        desconto,
        valor,
        status: 'ativo',
      }).select('id').single();
      if (clientError || !client) throw clientError || new Error('Cliente não criado.');
      createdClientId = client.id;

      const todayBr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());

      const { error: transactionError } = await supabase.from('transacoes').insert({
        user_id: userId,
        cliente_id: client.id,
        tipo: 'entrada',
        entrada: valor,
        custo,
        valor,
        data: todayBr,
        descricao: `Cadastro cliente ${client.id}`,
        serv_id: form.servidores_ids[0] || null,
      });
      if (transactionError) throw transactionError;

      if (consumeCredit) {
        const serverName = form.servidores_ids.map((id) => servers.find((server) => server.id === id)?.name || '').find((name) => /uniplay|goat/i.test(name));
        if (serverName) {
          const movementId = crypto.randomUUID();
          const { error: creditError } = await (supabase as any).rpc('registrar_consumo_credito', {
            p_renovacao_id: movementId,
            p_cliente_id: client.id,
            p_servidor: serverName,
            p_creditos: 1,
            p_caixinha: addFund && !isFreePlan ? 10 : 0,
          });
          if (creditError) throw creditError;
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['clients-active'] }),
        queryClient.invalidateQueries({ queryKey: ['financeiro-history'] }),
      ]);
      toast.success('Cliente cadastrado e lançado no financeiro.');
      setOpen(false);
    } catch (error) {
      console.error(error);
      if (createdClientId) await supabase.from('clientes').delete().eq('id', createdClientId);
      toast.error('Não foi possível cadastrar o cliente.');
    } finally { setSaving(false); }
  }

  function toggleServer(id: string) {
    setForm((f) => ({ ...f, servidores_ids: f.servidores_ids.includes(id) ? f.servidores_ids.filter((serverId) => serverId !== id) : [...f.servidores_ids, id] }));
  }

  return <>
    <Button onClick={openDialog} className="h-9 rounded-xl gap-2 px-3" title="Novo cliente"><Plus size={17} /><span className="hidden sm:inline">Novo cliente</span></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter"><UserPlus size={20} className="text-primary" />Novo cliente</DialogTitle><DialogDescription>Cadastre o cliente no Gestor.</DialogDescription></DialogHeader><div className="space-y-4 py-2">
      <label className="block text-sm font-medium">Nome<Input className="mt-1" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></label>
      <label className="block text-sm font-medium">WhatsApp<Input className="mt-1" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></label>
      <label className="block text-sm font-medium">Vencimento<DatePicker className="mt-1" value={form.vencimento} onChange={(vencimento) => setForm((f) => ({ ...f, vencimento }))} /></label>
      <label className="block text-sm font-medium">Plano<select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.plano_id} onChange={(e) => { const plano_id = e.target.value; const selectedPlan = plans.find((plan) => plan.id === plano_id); setForm((f) => ({ ...f, plano_id })); setAddFund(Number(selectedPlan?.price || 0) > 0); }}><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — R$ {Number(plan.price || 0).toFixed(2).replace('.', ',')}</option>)}</select></label>
      <label className="block text-sm font-medium">Desconto (R$)<Input className="mt-1" inputMode="decimal" value={form.desconto} onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))} /></label>
      <div><p className="text-sm font-medium mb-2">Servidor <span className="font-normal text-muted-foreground">(selecione um ou mais)</span></p><div className="grid grid-cols-3 gap-2">{servers.map((server) => { const selected = form.servidores_ids.includes(server.id); return <button key={server.id} type="button" onClick={() => toggleServer(server.id)} aria-pressed={selected} className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-muted/50'}`}><span className="truncate">{server.name}</span>{selected && <Check size={14} className="shrink-0" />}</button>; })}</div></div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={consumeCredit} onChange={(e) => setConsumeCredit(e.target.checked)} className="h-4 w-4" />Descontar 1 crédito</label>
        <label className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${!consumeCredit ? 'opacity-50' : ''}`}><input type="checkbox" checked={addFund} disabled={!consumeCredit} onChange={(e) => setAddFund(e.target.checked)} className="h-4 w-4" />Adicionar R$ 10 à caixinha</label>
      </div>
    </div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Cadastrar'}</Button></div></DialogContent></Dialog>
  </>;
}
