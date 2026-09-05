import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/infraestrutura')({ component: InfraestruturaPage })

type Server = { id: string; name: string; valor: number; active: boolean | null }
type Plan = { id: string; name: string; price: number; active: boolean | null }

function money(value: number) { return `R$ ${Number(value).toFixed(2).replace('.', ',')}` }

function InfraestruturaPage() {
  const [tab, setTab] = useState<'servidores' | 'planos'>('servidores')
  const [servidores, setServidores] = useState<Server[]>([])
  const [planos, setPlanos] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
    setEditingServer(server ?? null)
    setEditingPlan(null)
    setName(server?.name ?? '')
    setValue(server ? String(server.valor) : '')
    setModal('server')
  }

  function openPlan(plan?: Plan) {
    setEditingPlan(plan ?? null)
    setEditingServer(null)
    setName(plan?.name ?? '')
    setValue(plan ? String(plan.price) : '')
    setModal('plan')
  }

  function closeModal() {
    if (saving || deleting) return
    setModal(null)
    setEditingServer(null)
    setEditingPlan(null)
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
    setSaving(false)
    setModal(null)
    setEditingServer(null)
    setEditingPlan(null)
    await loadData()
  }

  async function removeCurrent() {
    const target = modal === 'server' ? editingServer : editingPlan
    if (!target) return

    const label = modal === 'server' ? 'servidor' : 'plano'
    if (!window.confirm(`Excluir este ${label} definitivamente?`)) return

    setDeleting(true)
    const { error } = modal === 'server'
      ? await supabase.from('servidores_iptv').delete().eq('id', target.id)
      : await supabase.from('plans').delete().eq('id', target.id)
    setDeleting(false)

    if (error) {
      window.alert(`Não foi possível excluir este ${label}. Ele pode estar sendo usado em outros registros.`)
      return
    }

    setModal(null)
    setEditingServer(null)
    setEditingPlan(null)
    await loadData()
  }

  return <div className="w-full max-w-full space-y-4 px-4 py-5 sm:px-6 lg:space-y-5 lg:px-8">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Infraestrutura</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gerencie servidores e planos.</p>
    </div>

    <div className="grid grid-cols-2 overflow-hidden rounded-lg border bg-muted/30">
      {[['servidores','Servidores'],['planos','Planos']].map(([v,l]) => <button key={v} type="button" onClick={() => setTab(v as typeof tab)} className={`min-w-0 px-2 py-3 text-xs font-semibold sm:px-4 sm:text-sm ${tab === v ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}>{l}</button>)}
    </div>

    {loading ? <div className="py-10 text-center text-muted-foreground">Carregando...</div> : tab === 'servidores' ? (
      <section className="space-y-2.5">
        <div className="flex justify-end">
          <button type="button" onClick={() => openServer()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">Novo servidor</button>
        </div>
        {servidores.length === 0 ? <div className="rounded-xl border p-6 text-center text-muted-foreground">Nenhum servidor cadastrado.</div> : servidores.map(s => <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Custo: {money(s.valor)}</p>
          </div>
          <button type="button" onClick={() => openServer(s)} aria-label={`Editar ${s.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Pencil size={16} />
          </button>
        </div>)}
      </section>
    ) : (
      <section className="space-y-2.5">
        <div className="flex justify-end">
          <button type="button" onClick={() => openPlan()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">Novo plano</button>
        </div>
        {planos.length === 0 ? <div className="rounded-xl border p-6 text-center text-muted-foreground">Nenhum plano cadastrado.</div> : planos.map(p => <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Valor padrão: {money(p.price)}</p>
          </div>
          <button type="button" onClick={() => openPlan(p)} aria-label={`Editar ${p.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Pencil size={16} />
          </button>
        </div>)}
      </section>
    )}

    {modal && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold">{modal === 'server' ? (editingServer ? 'Editar servidor' : 'Novo servidor') : (editingPlan ? 'Editar plano' : 'Novo plano')}</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">Nome<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5" /></label>
          <label className="block text-sm">{modal === 'server' ? 'Custo (R$)' : 'Valor padrão (R$)'}<input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5" /></label>
        </div>

        {(editingServer || editingPlan) && <button type="button" disabled={saving || deleting} onClick={removeCurrent} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50">
          <Trash2 size={16} />
          {deleting ? 'Excluindo...' : 'Excluir'}
        </button>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving || deleting} onClick={closeModal} className="rounded-lg border px-4 py-2.5 text-sm disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={saving || deleting} onClick={save} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>}
  </div>
}
