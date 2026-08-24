import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/infraestrutura')({ component: InfraestruturaPage })

type Server = { id: string; name: string; valor: number; active: boolean | null }
type Plan = { id: string; name: string; price: number; active: boolean | null }

function money(value: number) { return `R$ ${Number(value).toFixed(2).replace('.', ',')}` }
function Status({ active }: { active: boolean | null }) { return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${active === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-600'}`}>{active === false ? 'Inativo' : 'Ativo'}</span> }

function InfraestruturaPage() {
  const [tab, setTab] = useState<'servidores' | 'planos'>('servidores')
  const [servidores, setServidores] = useState<Server[]>([])
  const [planos, setPlanos] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<'server' | 'plan' | null>(null)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  useEffect(() => { loadData() }, [])
  async function loadData() {
    setLoading(true)
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('servidores_iptv').select('id, name, valor, active').order('name'),
      supabase.from('plans').select('id, name, price, active').order('name'),
    ])
    setServidores(s ?? []); setPlanos(p ?? []); setLoading(false)
  }
  function openServer(server?: Server) { setEditingServer(server ?? null); setName(server?.name ?? ''); setValue(server ? String(server.valor) : ''); setModal('server') }
  function openPlan(plan?: Plan) { setEditingPlan(plan ?? null); setName(plan?.name ?? ''); setValue(plan ? String(plan.price) : ''); setModal('plan') }
  async function save() {
    const cleanName = name.trim(); const numericValue = Number(value.replace(',', '.'))
    if (!cleanName || !Number.isFinite(numericValue) || numericValue < 0) return
    setSaving(true)
    if (modal === 'server') {
      const payload = { name: cleanName, valor: numericValue }
      if (editingServer) await supabase.from('servidores_iptv').update(payload).eq('id', editingServer.id); else await supabase.from('servidores_iptv').insert(payload)
    }
    if (modal === 'plan') {
      const payload = { name: cleanName, price: numericValue }
      if (editingPlan) await supabase.from('plans').update(payload).eq('id', editingPlan.id); else await supabase.from('plans').insert(payload)
    }
    setSaving(false); setModal(null); await loadData()
  }
  async function toggleServer(server: Server) { await supabase.from('servidores_iptv').update({ active: server.active === false }).eq('id', server.id); await loadData() }
  async function togglePlan(plan: Plan) { await supabase.from('plans').update({ active: plan.active === false }).eq('id', plan.id); await loadData() }

  return <div className="w-full max-w-full space-y-5 px-4 py-5 sm:px-6 lg:space-y-6 lg:px-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Infraestrutura</h1><p className="mt-1 text-sm text-muted-foreground">Gerencie servidores e planos.</p></div>
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-muted/30">
      {[['servidores','Servidores'],['planos','Planos']].map(([v,l]) => <button key={v} type="button" onClick={() => setTab(v as typeof tab)} className={`min-w-0 px-2 py-3 text-xs font-semibold sm:px-4 sm:text-sm ${tab === v ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>{l}</button>)}
    </div>
    {loading ? <div className="py-10 text-center text-muted-foreground">Carregando...</div> : tab === 'servidores' ? (
      <section className="space-y-3">
        <div className="flex justify-end"><button type="button" onClick={() => openServer()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">Novo servidor</button></div>
        {servidores.length === 0 ? <div className="rounded-xl border p-6 text-center text-muted-foreground">Nenhum servidor cadastrado.</div> : servidores.map(s => <div key={s.id} className="rounded-xl border p-4"><div className="min-w-0"><div className="flex items-start justify-between gap-3"><p className="break-words font-medium">{s.name}</p><Status active={s.active} /></div><p className="mt-1 text-sm text-muted-foreground">Custo: {money(s.valor)}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => openServer(s)} className="rounded-lg border px-3 py-2 text-sm">Editar</button><button type="button" onClick={() => toggleServer(s)} className="rounded-lg border px-3 py-2 text-sm">{s.active === false ? 'Ativar' : 'Desativar'}</button></div></div>)}
      </section>
    ) : (
      <section className="space-y-3">
        <div className="flex justify-end"><button type="button" onClick={() => openPlan()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">Novo plano</button></div>
        {planos.length === 0 ? <div className="rounded-xl border p-6 text-center text-muted-foreground">Nenhum plano cadastrado.</div> : planos.map(p => <div key={p.id} className="rounded-xl border p-4"><div className="min-w-0"><div className="flex items-start justify-between gap-3"><p className="break-words font-medium">{p.name}</p><Status active={p.active} /></div><p className="mt-1 text-sm text-muted-foreground">Valor padrão: {money(p.price)}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => openPlan(p)} className="rounded-lg border px-3 py-2 text-sm">Editar</button><button type="button" onClick={() => togglePlan(p)} className="rounded-lg border px-3 py-2 text-sm">{p.active === false ? 'Ativar' : 'Desativar'}</button></div></div>)}
      </section>
    )}
    {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"><div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl sm:p-6"><h2 className="text-lg font-semibold">{modal === 'server' ? (editingServer ? 'Editar servidor' : 'Novo servidor') : (editingPlan ? 'Editar plano' : 'Novo plano')}</h2><div className="mt-4 space-y-4"><label className="block text-sm">Nome<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5" /></label><label className="block text-sm">{modal === 'server' ? 'Custo (R$)' : 'Valor padrão (R$)'}<input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5" /></label></div><div className="mt-6 grid grid-cols-2 gap-2"><button type="button" onClick={() => setModal(null)} className="rounded-lg border px-4 py-2.5 text-sm">Cancelar</button><button type="button" disabled={saving} onClick={save} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">{saving ? 'Salvando...' : 'Salvar'}</button></div></div></div>}
  </div>
}
