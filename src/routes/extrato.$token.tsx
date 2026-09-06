import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, CreditCard, ReceiptText, ShoppingBag } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/extrato/$token')({
  head: () => ({
    meta: [
      { title: 'Extrato de créditos | Owerplay' },
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
      if (error || !data) setInvalid(true)
      else setStatement(data as unknown as Statement)
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

  if (loading) return <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center text-sm text-slate-500">Carregando extrato...</div>
  if (invalid || !statement) return <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-6 text-center text-slate-600">Este extrato não está disponível.</div>

  const firstName = statement.nome.trim().split(/\s+/)[0] || statement.nome

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Extrato do revendedor</p>
            <h1 className="mt-1 text-[28px] font-bold tracking-[-0.04em]">Olá, {firstName}</h1>
          </div>
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="appearance-none rounded-2xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-xs font-semibold text-slate-700 shadow-[0_8px_30px_rgba(15,23,42,0.06)] outline-none"
            >
              {availableMonths.map((value) => <option key={value} value={value}>{monthLabel(value)}</option>)}
            </select>
            <CalendarDays size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#172554_56%,#1d4ed8_100%)] p-5 text-white shadow-[0_22px_55px_-28px_rgba(30,64,175,0.55)] sm:p-6">
          <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 right-8 h-40 w-40 rounded-full bg-blue-300/10" />
          <div className="relative">
            <p className="text-xs font-medium text-blue-100/75">{monthLabel(month)}</p>
            <p className="mt-2 text-sm text-blue-100/80">Investido no mês</p>
            <p className="mt-1 text-[36px] font-bold tracking-[-0.05em] sm:text-[42px]">{money(totals.value)}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-blue-100/80">
                  <CreditCard size={16} />
                  <span className="text-[11px] font-medium">Créditos</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{totals.credits}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-blue-100/80">
                  <ShoppingBag size={16} />
                  <span className="text-[11px] font-medium">Compras</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{totals.purchases}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Movimentações</p>
              <h2 className="mt-0.5 text-xl font-bold tracking-[-0.03em]">Histórico</h2>
            </div>
            <span className="text-[11px] font-medium text-slate-400">{monthLabel(month)}</span>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.25)]">
              Nenhuma compra neste período.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)]">
              {rows.map((m, index) => (
                <article
                  key={m.id}
                  className={`flex items-center justify-between gap-4 px-4 py-4 sm:px-5 ${index !== rows.length - 1 ? 'border-b border-slate-100' : ''}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <ReceiptText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold tracking-[-0.01em]">{m.quantidade_creditos} créditos</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{dateBR(m.data)} · {m.servidor}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="whitespace-nowrap text-sm font-bold text-emerald-600">{money(Number(m.custo))}</p>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-7 text-center">
          <p className="text-[11px] font-medium text-slate-400">Owerplay TV</p>
        </footer>
      </div>
    </main>
  )
}
