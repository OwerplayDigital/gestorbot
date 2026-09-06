import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, CircleDollarSign, CreditCard, History, ShoppingBag } from 'lucide-react'

export const Route = createFileRoute('/extrato-demo')({
  head: () => ({
    meta: [
      { title: 'Prévia do extrato | Owerplay' },
      { name: 'description', content: 'Prévia visual do extrato do revendedor.' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ExtratoDemoPage,
})

const movements = [
  { date: '28/09/2026', credits: 20, server: 'Owerplay 1', value: 'R$ 100,00' },
  { date: '20/09/2026', credits: 20, server: 'Owerplay 2', value: 'R$ 100,00' },
  { date: '12/09/2026', credits: 20, server: 'Owerplay 1', value: 'R$ 100,00' },
  { date: '05/09/2026', credits: 20, server: 'Owerplay 2', value: 'R$ 100,00' },
]

function ExtratoDemoPage() {
  return (
    <main className="min-h-screen bg-[#071019] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="mb-7 flex items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">Owerplay TV</p>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Meu extrato</h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            João
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400">Período</p>
              <p className="mt-1 text-base font-semibold">Setembro de 2026</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-slate-300">
              <CalendarDays size={19} />
            </div>
          </div>
        </section>

        <section className="mb-7 grid grid-cols-3 gap-2.5">
          <article className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5 sm:p-4">
            <CreditCard size={18} className="text-amber-400" />
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Créditos</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">80</p>
          </article>

          <article className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3.5 sm:p-4">
            <CircleDollarSign size={18} className="text-emerald-400" />
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Investido</p>
            <p className="mt-1 text-lg font-bold sm:text-2xl">R$ 400</p>
          </article>

          <article className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.06] p-3.5 sm:p-4">
            <ShoppingBag size={18} className="text-blue-400" />
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Compras</p>
            <p className="mt-1 text-xl font-bold sm:text-2xl">4</p>
          </article>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              <h2 className="font-semibold">Histórico</h2>
            </div>
            <span className="text-xs text-slate-500">Setembro</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
            {movements.map((movement, index) => (
              <article
                key={movement.date}
                className={`flex items-center justify-between gap-4 px-4 py-4 sm:px-5 ${index !== movements.length - 1 ? 'border-b border-white/10' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-semibold">{movement.credits} créditos</p>
                  <p className="mt-1 text-xs text-slate-500">{movement.date} · {movement.server}</p>
                </div>
                <p className="whitespace-nowrap text-sm font-bold text-emerald-400 sm:text-base">{movement.value}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-8 border-t border-white/10 pt-5 text-center">
          <p className="text-xs font-medium text-slate-400">Owerplay TV</p>
        </footer>
      </div>
    </main>
  )
}
