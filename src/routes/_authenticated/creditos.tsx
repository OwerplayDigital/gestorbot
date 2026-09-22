import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/creditos')({ component: CreditosPage })

type Controle = { uniplay: number; goat: number; caixinha: number; meta_caixinha: number }

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

// Fusion layout sync 2026-09-22
function CreditosPage() {
  const [data, setData] = useState<Controle | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbReady, setDbReady] = useState(true)

  async function load() {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) { setLoading(false); return }
    let { data: row, error: readError } = await (supabase as any).from('controle_creditos').select('uniplay, goat, caixinha, meta_caixinha').eq('user_id', userId).maybeSingle()
    if (readError) {
      setDbReady(false)
      setData({ uniplay: 64.70, goat: 7.84, caixinha: 80, meta_caixinha: 375 })
      setLoading(false)
      return
    }
    if (!row) {
      const { data: created } = await (supabase as any).from('controle_creditos').insert({ user_id: userId, uniplay: 64.70, goat: 7.84, caixinha: 80, meta_caixinha: 375 }).select('uniplay, goat, caixinha, meta_caixinha').single()
      row = created
    }
    setData(row)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando créditos...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">Não foi possível carregar o controle.</div>

  const meta = Number(data.meta_caixinha || 375)
  const caixa = Number(data.caixinha || 0)
  const pct = meta > 0 ? Math.min(100, (caixa / meta) * 100) : 0
  const falta = Math.max(0, meta - caixa)

  return <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
    <section className="rounded-[28px] border border-border/70 bg-card/45 p-4 shadow-sm backdrop-blur-md">
      <div className="grid grid-cols-2 gap-3">
        <article className="flex h-[210px] flex-col rounded-[24px] border border-sky-300/50 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 p-5 text-white shadow-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Servidor 01</div>
            <div className="mt-1 text-lg font-black uppercase tracking-wide">Uniplay</div>
          </div>
          <div className="mt-auto">
            <div className="text-6xl font-black leading-none tracking-tighter">{Math.floor(Number(data.uniplay))}</div>
            <p className="mt-4 whitespace-nowrap text-[10px] font-semibold text-white/85">créditos disponíveis</p>
          </div>
        </article>

        <article className="flex h-[210px] flex-col rounded-[24px] border border-orange-300/50 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-5 text-white shadow-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/75">Servidor 02</div>
            <div className="mt-1 text-lg font-black uppercase tracking-wide">GOAT</div>
          </div>
          <div className="mt-auto">
            <div className="text-6xl font-black leading-none tracking-tighter">{Math.floor(Number(data.goat))}</div>
            <p className="mt-4 whitespace-nowrap text-[10px] font-semibold text-white/85">créditos disponíveis</p>
          </div>
        </article>
      </div>

      <article className="mt-3 rounded-[24px] border border-emerald-300/50 bg-gradient-to-br from-emerald-800 via-emerald-600 to-emerald-400 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="whitespace-nowrap text-base font-black">Caixinha de reposição</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-white/65">Reserva operacional</div>
          </div>
          <span className="rounded-full border border-white/25 bg-white/5 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white/90">Em dia</span>
        </div>
        <div className="mt-7 text-5xl font-black leading-none tracking-tight">{brl(caixa)}</div>
        <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full bg-white/85 transition-all" style={{ width: `${pct}%` }}/></div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-semibold text-white/80">
          <span>{pct.toFixed(1).replace('.', ',')}% da meta · faltam {brl(falta).replace(',00','')}</span>
          <span className="whitespace-nowrap">Meta {brl(meta).replace(',00','')}</span>
        </div>
      </article>
    </section>
  </div>}
