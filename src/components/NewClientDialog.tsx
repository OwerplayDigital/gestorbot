import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Option = { id: string; name: string; price?: number };
const emptyForm = { nome: '', whatsapp: '', vencimento: '', plano_id: '', desconto: '', servidores_ids: [] as string[] };

export function NewClientDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Option[]>([]);
  const [servers, setServers] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyForm);

  async function openDialog() {
    const [{ data: planData }, { data: serverData }] = await Promise.all([
      supabase.from('plans').select('id, name, price').eq('active', true).order('name'),
      supabase.from('servidores_iptv').select('id, name').eq('active', true).order('name'),
    ]);
    setPlans(planData || []); setServers(serverData || []); setForm(emptyForm); setOpen(true);
  }

  async function save() {
    if (saving) return;
    if (!form.nome.trim() || !form.whatsapp.trim() || !form.vencimento || !form.plano_id || form.servidores_ids.length === 0) { toast.error('Preencha nome, WhatsApp, vencimento, plano e servidor.'); return; }
    const desconto = Number(form.desconto.replace(',', '.') || 0);
    if (!Number.isFinite(desconto) || desconto < 0) { toast.error('Desconto inválido.'); return; }
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('Usuário não autenticado.');
      const plan = plans.find((item) => item.id === form.plano_id);
      const valor = Math.max(0, Number(plan?.price || 0) - desconto);
      const { error } = await supabase.from('clientes').insert({ user_id: userId, nome: form.nome.trim(), whatsapp: form.whatsapp.trim(), vencimento: form.vencimento, plano_id: form.plano_id, servidores_ids: form.servidores_ids, desconto, valor, status: 'ativo' });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['clients-active'] });
      toast.success('Cliente cadastrado.'); setOpen(false);
    } catch (error) { console.error(error); toast.error('Não foi possível cadastrar o cliente.'); }
    finally { setSaving(false); }
  }

  return <>
    <Button onClick={openDialog} className="h-9 rounded-xl gap-2 px-3" title="Novo cliente"><Plus size={17} /><span className="hidden sm:inline">Novo cliente</span></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tighter"><UserPlus size={20} className="text-primary" />Novo cliente</DialogTitle><DialogDescription>Cadastre o cliente no Gestor.</DialogDescription></DialogHeader><div className="space-y-4 py-2">
      <label className="block text-sm font-medium">Nome<Input className="mt-1" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></label>
      <label className="block text-sm font-medium">WhatsApp<Input className="mt-1" inputMode="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} /></label>
      <label className="block text-sm font-medium">Vencimento<Input className="mt-1" type="date" value={form.vencimento} onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))} /></label>
      <label className="block text-sm font-medium">Plano<select className="mt-1 w-full h-10 rounded-md border bg-background px-3 text-sm" value={form.plano_id} onChange={(e) => setForm((f) => ({ ...f, plano_id: e.target.value }))}><option value="">Selecione</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} — R$ {Number(plan.price || 0).toFixed(2).replace('.', ',')}</option>)}</select></label>
      <label className="block text-sm font-medium">Desconto (R$)<Input className="mt-1" inputMode="decimal" value={form.desconto} onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))} /></label>
      <div><p className="text-sm font-medium mb-2">Servidor</p><div className="space-y-2">{servers.map((server) => <label key={server.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm cursor-pointer"><input type="checkbox" className="h-4 w-4" checked={form.servidores_ids.includes(server.id)} onChange={(e) => setForm((f) => ({ ...f, servidores_ids: e.target.checked ? [...f.servidores_ids, server.id] : f.servidores_ids.filter((id) => id !== server.id) }))} /><span className="font-medium">{server.name}</span></label>)}</div></div>
    </div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={save}>{saving ? 'Salvando...' : 'Cadastrar'}</Button></div></DialogContent></Dialog>
  </>;
}
