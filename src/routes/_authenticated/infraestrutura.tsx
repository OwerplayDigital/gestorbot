import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/infraestrutura')({ component: InfraestruturaPage })

type Server = { id: string; name: string; valor: number; active: boolean | null }
type Plan = { id: string; name: string; price: number; active: boolean | null }

function money(value: number) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`
}

function InfraestruturaPage() {
  const [tab, setTab] = useState<'servidores' | 'aplicativos' | 'planos'>('servidores')
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
    setServidores(s ?? [])
    setPlanos(p ?? [])
    setLoading(false)
  }

  function openServer(server?: Server) {
    setEditingServer(server ?? null); setName(server?.name ?? ''); setValue(server ? String(server.valor) : ''); setModal('server')
  }

  function openPlan(plan?: Plan) {
    setEditingPlan(plan ?? null); setName(plan?.name ?? ''); setValue(plan ? String(plan.price) : ''); setModal('plan')
  }

  async function save() {
    const cleanName = name.trim()
    const numericValue = Number(value.replace(',', '.'))
    if (!cleanName || !Number.isFinite(numericValue) || numericValue < 0) return
    setSaving(true)
    if (modal === 'server') {
      const payload = { name: cleanName, valor: numericValue }
      if (editingServer) await supabase.from('servidores_iptv').update(payload).eq('id', editingServer.id)
      else await supabase.from('servidores_iptv').insert(payload)
    }
    if (modal === 'plan') {
      const payload = { name: cleanName, price: numericValue }
      if (editingPlan) await supabase.from('plans').update(payload).eq('id', editingPlan.id)
      else await supabase.from('plans').insert(payload)
    }
    setSaving(false); setModal(null); await loadData()
  }

  async function toggleServer(server: Server) {
    await supabase.from('servidores_iptv').update({ active: server.active === false }).eq('id', server.id)
    await loadData()
  }

  async function togglePlan(plan: Plan) {
    await supabase.from('plans').update({ active: plan.active === false }).eq('id', plan.id)
    await loadData()
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight">Infraestrutura</h1><p className="text-muted-foreground">Gerencie servidores, aplicativos e planos.</p></div>
      <div className="flex gap-2 border-b">{[['servidores','Servidores'],['aplicativos','Aplicativos'],['planos','Planos']].map(([v,l]) => <button key={v} type="button" onClick={() => setTab(v as typeof tab)} className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === v ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{l}</button>)}</div>
      {loading ? <div className="py-10 text-center text-muted-foreground">Carregando...</div> : tab === 'aplicativos' ? <div className="rounded-lg border p-6 text-center text-muted-foreground">Aplicativos ainda não possuem estrutura própria no banco. Vamos definir essa parte depois.</div> : tab === 'servidores' ? (
        <section className="space-y-4"><div className="flex justify-end"><button type="button" onClick={() => openServer()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Novo servidor</button></div>{servidores.length === 0 ? <div className="rounded-lg border p-6 text-center text-muted-foreground">Nenhum servidor cadastrado.</div> : servidores.map(s => <div key={s.id} className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">Custo: {money(s.valor)}</p></div><div className="flex gap-2"><button type="button" onClick={() => openServer(s)} className="rounded-md border px-3 py-1.5 text-sm">Editar</button><button type="button" onClick={() => toggleServer(s)} className="rounded-md border px-3 py-1.5 text-sm">{s.active === false ? 'Ativar' : 'Desativar'}</button></div></div>)}</section>
      ) : (
        <section className="space-y-4"><div className="flex justify-end"><button type="button" onClick={() => openPlan()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Novo plano</button></div>{planos.length === 0 ? <div className="rounded-lg border p-6 text-center text-muted-foreground">Nenhum plano cadastrado.</div> : planos.map(p => <div key={p.id} className="flex items-center justify-between rounded-lg border p-4"><div><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">Valor padrão: {money(p.price)}</p></div><div className="flex gap-2"><button type="button" onClick={() => openPlan(p)} className="rounded-md border px-3 py-1.5 text-sm">Editar</button><button type="button" onClick={() => togglePlan(p)} className="rounded-md border px-3 py-1.5 text-sm">{p.active === false ? 'Ativar' : 'Desativar'}</button></div></div>)}</section>
      )}
      {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl"><h2 className="text-lg font-semibold">{modal === 'server' ? (editingServer ? 'Editar servidor' : 'Novo servidor') : (editingPlan ? 'Editar plano' : 'Novo plano')}</h2><div className="mt-4 space-y-4"><label className="block text-sm">Nome<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label><label className="block text-sm">{modal === 'server' ? 'Custo (R$)' : 'Valor padrão (R$)'}<input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border bg-background px-3 py-2" /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModal(null)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={saving} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{saving ? 'Salvando...' : 'Salvar'}</button></div></div></div>}
    </div>
  )
}
