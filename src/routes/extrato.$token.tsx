import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CreditCard, ReceiptText } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/extrato/$token')({
  head: () => ({
    meta: [
      { title: 'Extrato de créditos — Owerplay' },
      { name: 'description', content: 'Histórico de créditos e pagamentos.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: StatementPage,
})

type Movement = {
  id: string
  data: string
  quantidade_creditos: number
  custo: number
  servidor: string
}

type Statement = { nome: string; movimentacoes: Movement[] }

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function currentMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dateBR(value: string) {
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
}

function monthLabel(value: string) {
  const [year, month] = value.split('-')
  return `${MONTHS[Number(month) - 1]} de ${year}`
}

function StatementPage() {
  const { token } = Route.useParams()
  const [statement, setStatement] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [month, setMonth] = useState(currentMonth())

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_reseller_statement' as any, { p_token: token })
      if (error || !data) {
        setInvalid(true)
      } else {
        setStatement(data as unknown as Statement)
      }
      setLoading(false)
    }
    load()
  }, [token])

  const availableMonths = useMemo(() => {
    const values = new Set((statement?.movimentacoes ?? []).map((m) => m.data.slice(0, 7)))
    values.add(currentMonth())
    return Array.from(values).sort().reverse()
  }, [statement])

  const rows = useMemo(
    () => (statement?.movimentacoes ?? []).filter((m) => m.data.startsWith(month)),
    [statement, month],
  )

  const totals = useMemo(() => ({
    credits: rows.reduce((sum, m) => sum + Number(m.quantidade_creditos || 0), 0),
    value: rows.reduce((sum, m) => sum + Number(m.custo || 0), 0),
    purchases: rows.length,
  }), [rows])

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400">Carregando extrato...</div>
  if (invalid || !statement) return <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 text-center text-slate-300">Este extrato não está disponível.</div>

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">Owerplay</p>
          <h1 className="mt-2 text-2xl font-bold">Olá, {statement.nome.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-slate-400">Seu histórico de créditos e pagamentos.</p>
        </header>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-300"><CalendarDays size={17} /> Período</div>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-[190px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none">
            {availableMonths.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
          </select>
        </div>

        <section className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
            <CreditCard size={17} className="text-blue-400" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Créditos</p>
            <p className="mt-1 text-xl font-bold">{totals.credits}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
            <ReceiptText size={17} className="text-emerald-400" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Investido</p>
            <p className="mt-1 text-base font-bold sm:text-xl">{money(totals.value)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:p-4">
            <CalendarDays size={17} className="text-violet-400" />
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Compras</p>
            <p className="mt-1 text-xl font-bold">{totals.purchases}</p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Histórico</h2>
            <span className="text-xs text-slate-500">{monthLabel(month)}</span>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">Nenhuma compra neste período.</div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((m) => (
                <article key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{m.quantidade_creditos} créditos</p>
                      <p className="mt-1 text-xs text-slate-500">{dateBR(m.data)} · {m.servidor}</p>
                    </div>
                    <p className="whitespace-nowrap font-bold text-emerald-400">{money(Number(m.custo))}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="pt-3 text-center text-[11px] text-slate-600">Owerplay TV</footer>
      </div>
    </main>
  )
}
