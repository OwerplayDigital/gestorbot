import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { ServerBadge } from '@/components/ServerBadge'

export const Route = createFileRoute('/_authenticated/revendedores')({
  head: () => ({
    meta: [
      { title: 'Revendedores — Owerplay Gestor' },
      { name: 'description', content: 'Controle de revendedores, créditos adicionados e pagamentos do mês.' },
      { property: 'og:title', content: 'Revendedores — Owerplay Gestor' },
      { property: 'og:description', content: 'Controle de revendedores, créditos adicionados e pagamentos do mês.' },
    ],
  }),
  component: RevendedoresPage,
})

type Reseller = {
  id: string
  nome: string
  whatsapp: string | null
  servidor_principal_id: string | null
  ativo: boolean
}

type Movement = {
  id: string
  reseller_id: string
  data: string
  quantidade_creditos: number
  custo: number
  servidor_id: string | null
  observacao: string | null
}

type Server = { id: string; name: string }

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`
}

function formatDate(value: string) {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isCurrentMonth(value: string) {
  return value.slice(0, 7) === todayISO().slice(0, 7)
}

function RevendedoresPage() {
  const [resellers, setResellers] = useState<Reseller[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [resellerModal, setResellerModal] = useState(false)
  const [editing, setEditing] = useState<Reseller | null>(null)
  const [nome, setNome] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [servidorId, setServidorId] = useState('')
  const [ativo, setAtivo] = useState(true)

  const [movModal, setMovModal] = useState(false)
  const [movData, setMovData] = useState(todayISO())
  const [movCreditos, setMovCreditos] = useState('')
  const [movValor, setMovValor] = useState('')
  const [movServidor, setMovServidor] = useState('')
  const [movObs, setMovObs] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Movement | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: r }, { data: m }, { data: s }] = await Promise.all([
      supabase.from('revendedores').select('id, nome, whatsapp, servidor_principal_id, ativo').order('nome'),
      supabase.from('reseller_credits').select('id, reseller_id, data, quantidade_creditos, custo, servidor_id, observacao').order('data', { ascending: false }),
      supabase.from('servidores_iptv').select('id, name').order('name'),
    ])
    setResellers((r ?? []) as Reseller[])
    setMovements((m ?? []) as Movement[])
    setServers((s ?? []) as Server[])
    setLoading(false)
  }

  const serverName = useMemo(() => {
    const map = new Map(servers.map((s) => [s.id, s.name]))
    return (id: string | null) => (id ? map.get(id) ?? 'N/A' : 'N/A')
  }, [servers])

  const selected = resellers.find((r) => r.id === selectedId) ?? null
  const selectedMovements = useMemo(
    () => movements.filter((m) => m.reseller_id === selectedId).sort((a, b) => (a.data < b.data ? 1 : -1)),
    [movements, selectedId],
  )
  const monthTotals = useMemo(() => {
    const rows = selectedMovements.filter((m) => isCurrentMonth(m.data))
    return {
      creditos: rows.reduce((acc, m) => acc + Number(m.quantidade_creditos || 0), 0),
      pago: rows.reduce((acc, m) => acc + Number(m.custo || 0), 0),
    }
  }, [selectedMovements])

  function openReseller(reseller?: Reseller) {
    setEditing(reseller ?? null)
    setNome(reseller?.nome ?? '')
    setWhatsapp(reseller?.whatsapp ?? '')
    setServidorId(reseller?.servidor_principal_id ?? '')
    setAtivo(reseller ? reseller.ativo : true)
    setResellerModal(true)
  }

  async function saveReseller() {
    if (!nome.trim()) return toast.error('Informe o nome.')
    setSaving(true)
    const payload = {
      nome: nome.trim(),
      whatsapp: whatsapp.trim() || null,
      servidor_principal_id: servidorId || null,
      ativo,
    }
    const { error } = editing
      ? await supabase.from('revendedores').update(payload).eq('id', editing.id)
      : await supabase.from('revendedores').insert(payload as never)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(editing ? 'Revendedor atualizado.' : 'Revendedor cadastrado.')
    setResellerModal(false)
    loadData()
  }

  function openMovement() {
    setMovData(todayISO())
    setMovCreditos('')
    setMovValor('')
    setMovServidor(selected?.servidor_principal_id ?? '')
    setMovObs('')
    setMovModal(true)
  }

  async function saveMovement() {
    if (!selected) return
    const creditos = parseInt(movCreditos, 10)
    const valor = Number(movValor.replace(',', '.'))
    if (!creditos || creditos <= 0) return toast.error('Informe a quantidade de créditos.')
    if (Number.isNaN(valor)) return toast.error('Informe o valor pago.')
    setSaving(true)
    const { error } = await supabase.from('reseller_credits').insert({
      reseller_id: selected.id,
      data: movData,
      quantidade_creditos: creditos,
      custo: valor,
      servidor_id: movServidor || null,
      servidor: movServidor ? serverName(movServidor) : null,
      observacao: movObs.trim() || null,
    } as never)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Movimentação registrada.')
    setMovModal(false)
    loadData()
  }

  async function deleteMovement() {
    if (!confirmDelete) return
    setSaving(true)
    const { error } = await supabase.from('reseller_credits').delete().eq('id', confirmDelete.id)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Movimentação excluída.')
    setConfirmDelete(null)
    loadData()
  }

  if (loading) {
    return <div className="p-4 lg:p-8 text-sm text-muted-foreground">Carregando...</div>
  }

  return (
    <div className="p-4 lg:p-8 space-y-4">
      {!selected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-semibold text-foreground">Revendedores</h1>
            <button type="button" onClick={() => openReseller()} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              <Plus size={16} />Novo
            </button>
          </div>

          {resellers.length === 0 ? (
            <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Nenhum revendedor cadastrado.</div>
          ) : (
            <div className="space-y-2.5">
              {resellers.map((r) => (
                <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-muted">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{r.whatsapp || 'Sem WhatsApp'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ServerBadge name={serverName(r.servidor_principal_id)} />
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${r.ativo ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500' : 'border-border bg-muted text-muted-foreground'}`}>
                      {r.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Voltar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
                <ArrowLeft size={16} />
              </button>
              <h1 className="truncate text-lg font-semibold text-foreground">{selected.nome}</h1>
            </div>
            <button type="button" onClick={() => openReseller(selected)} aria-label="Editar revendedor" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted">
              <Pencil size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Créditos no mês</p>
              <p className="mt-1 text-xl font-bold text-foreground">{monthTotals.creditos}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pago no mês</p>
              <p className="mt-1 text-xl font-bold text-emerald-500">{money(monthTotals.pago)}</p>
            </div>
          </div>

          <button type="button" onClick={openMovement} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">
            <Plus size={16} />Nova movimentação
          </button>

          {selectedMovements.length === 0 ? (
            <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
          ) : (
            <div className="space-y-2.5">
              {selectedMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{formatDate(m.data)} · {m.quantidade_creditos} créditos</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-500">{money(Number(m.custo))}</span>
                      <ServerBadge name={serverName(m.servidor_id)} />
                    </div>
                    {m.observacao && <p className="mt-1 truncate text-xs text-muted-foreground">{m.observacao}</p>}
                  </div>
                  <button type="button" onClick={() => setConfirmDelete(m)} aria-label="Excluir movimentação" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {resellerModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">{editing ? 'Editar revendedor' : 'Novo revendedor'}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">Nome<input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
              <label className="block text-sm">WhatsApp<input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
              <label className="block text-sm">Servidor
                <select value={servidorId} onChange={(e) => setServidorId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5">
                  <option value="">Sem servidor</option>
                  {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
                Ativo
                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
              </label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setResellerModal(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={saving} onClick={saveReseller} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {movModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">Nova movimentação</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">Data<input type="date" value={movData} onChange={(e) => setMovData(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">Créditos<input value={movCreditos} onChange={(e) => setMovCreditos(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
                <label className="block text-sm">Valor pago<input value={movValor} onChange={(e) => setMovValor(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
              </div>
              <label className="block text-sm">Servidor
                <select value={movServidor} onChange={(e) => setMovServidor(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5">
                  <option value="">Sem servidor</option>
                  {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">Observação<input value={movObs} onChange={(e) => setMovObs(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5" /></label>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setMovModal(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={saving} onClick={saveMovement} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Excluir movimentação?</h2>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(confirmDelete.data)} · {confirmDelete.quantidade_creditos} créditos · {money(Number(confirmDelete.custo))}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setConfirmDelete(null)} className="rounded-lg border border-border px-4 py-2.5 text-sm disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={saving} onClick={deleteMovement} className="rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-50">{saving ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
