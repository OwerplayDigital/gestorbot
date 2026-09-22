import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Coins, PiggyBank, RefreshCw } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/creditos')({ component: CreditosPage })

type Controle = { uniplay: number; goat: number; caixinha: number; meta_caixinha: number }

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

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

  return <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-8">
    <div className="flex items-center justify-between">
      <div><h1 className="text-2xl font-black tracking-tight">Créditos</h1><p className="text-sm text-muted-foreground">{dbReady ? "Controle automático das renovações." : "Saldo atual do controle."}</p></div>
      <button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground" aria-label="Atualizar"><RefreshCw size={17}/></button>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <article className="overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/15 to-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sky-500"><Coins size={18}/><span className="text-xs font-bold uppercase tracking-wider">Uniplay</span></div>
        <div className="mt-5 text-5xl font-black tracking-tighter">{Math.floor(Number(data.uniplay))}</div>
        <p className="mt-1 text-xs text-muted-foreground">créditos disponíveis</p>
      </article>
      <article className="overflow-hidden rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/15 to-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-orange-500"><Coins size={18}/><span className="text-xs font-bold uppercase tracking-wider">GOAT</span></div>
        <div className="mt-5 text-5xl font-black tracking-tighter">{Math.floor(Number(data.goat))}</div>
        <p className="mt-1 text-xs text-muted-foreground">créditos disponíveis</p>
      </article>
    </div>

    <article className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-emerald-500"><PiggyBank size={19}/><span className="font-bold">Caixinha de reposição</span></div><span className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meta {brl(meta)}</span></div>
      <div className="mt-6 text-4xl font-black tracking-tight">{brl(caixa)}</div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }}/></div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{pct.toFixed(1).replace('.', ',')}% da meta</span><span>Faltam {brl(falta)}</span></div>
    </article>
  </div>
}
