import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/creditos')({ component: CreditosPage })

type Controle = { uniplay: number; goat: number; caixinha: number; meta_caixinha: number }

function brl(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

// Fusion layout sync 2026-09-22
function CreditosPage() {
  const [data, setData] = useState<Controle | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbReady, setDbReady] = useState(true)
  const [repondo, setRepondo] = useState(false)
  const [servidor, setServidor] = useState<'uniplay' | 'goat'>('uniplay')
  const [quantidade, setQuantidade] = useState('')
  const [valorCaixinha, setValorCaixinha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

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

  async function reporCreditos() {
    if (!data) return
    const qtd = Number(quantidade.replace(',', '.'))
    const usado = Number(valorCaixinha.replace(',', '.'))
    if (!Number.isFinite(qtd) || qtd <= 0 || !Number.isFinite(usado) || usado < 0) {
      setErro('Informe uma quantidade e um valor válidos.')
      return
    }
    if (usado > Number(data.caixinha)) {
      setErro('O valor usado não pode ser maior que o saldo da caixinha.')
      return
    }
    setSalvando(true); setErro('')
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) { setErro('Sessão não encontrada.'); setSalvando(false); return }
    const novoSaldo = Number(data[servidor]) + qtd
    const novaCaixinha = Number(data.caixinha) - usado
    const { error: updateError } = await (supabase as any).from('controle_creditos')
      .update({ [servidor]: novoSaldo, caixinha: novaCaixinha, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    if (updateError) { setErro('Não foi possível repor os créditos.'); setSalvando(false); return }
    const { error: historyError } = await (supabase as any).from('movimentacoes_creditos').insert({
      user_id: userId, servidor: servidor === 'uniplay' ? 'Uniplay' : 'GOAT', tipo: 'reposicao', creditos: qtd, caixinha: -usado
    })
    if (historyError) console.error('Falha ao registrar histórico da reposição', historyError)
    setData({ ...data, [servidor]: novoSaldo, caixinha: novaCaixinha })
    setQuantidade(''); setValorCaixinha(''); setRepondo(false); setSalvando(false)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando créditos...</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">Não foi possível carregar o controle.</div>

  const meta = Number(data.meta_caixinha || 375)
  const caixa = Number(data.caixinha || 0)
  const pct = meta > 0 ? Math.min(100, (caixa / meta) * 100) : 0
  const falta = Math.max(0, meta - caixa)

  return <div className="mx-auto w-full max-w-[430px] p-4">
    <section className="rounded-[27px] border border-white/15 bg-white/[0.055] p-[11px] shadow-[0_24px_70px_rgba(0,0,0,.18),inset_0_1px_rgba(255,255,255,.14)] backdrop-blur-[18px]">
      <div className="grid grid-cols-2 gap-[10px]">
        <article className="relative min-h-[178px] overflow-hidden rounded-[21px] bg-[linear-gradient(145deg,#075ec9,#0a9ed8_52%,#19c6d4)] p-4 text-white shadow-[inset_0_1px_rgba(255,255,255,.27)]">
          <div className="text-[8px] uppercase tracking-[.22em] opacity-75">Servidor 01</div>
          <div className="mt-1 text-[15px] font-extrabold">UNIPLAY</div>
          <div className="mt-[39px] text-[63px] font-black leading-[.95] tracking-[-.05em]">{Math.floor(Number(data.uniplay))}</div>
          <div className="mt-2 whitespace-nowrap text-[10px] opacity-80">créditos disponíveis</div>
        </article>
        <article className="relative min-h-[178px] overflow-hidden rounded-[21px] bg-[linear-gradient(145deg,#d94b08,#f57612_50%,#ffb32f)] p-4 text-white shadow-[inset_0_1px_rgba(255,255,255,.27)]">
          <div className="text-[8px] uppercase tracking-[.22em] opacity-75">Servidor 02</div>
          <div className="mt-1 text-[15px] font-extrabold">GOAT</div>
          <div className="mt-[39px] text-[63px] font-black leading-[.95] tracking-[-.05em]">{Math.floor(Number(data.goat))}</div>
          <div className="mt-2 whitespace-nowrap text-[10px] opacity-80">créditos disponíveis</div>
        </article>
      </div>
      <section className="relative mt-[11px] overflow-hidden rounded-[22px] border border-[rgba(157,255,226,.29)] bg-[linear-gradient(140deg,#075d4a,#07946c_48%,#18c58e)] p-[21px] text-white shadow-[inset_0_1px_rgba(255,255,255,.22)]">
        <div className="flex justify-between gap-2">
          <div><strong className="text-[15px]">Caixinha de reposição</strong><span className="mt-1 block text-[8px] uppercase tracking-[.18em] opacity-70">Reserva operacional</span></div>
          <span className="h-max rounded-full border border-white/25 bg-white/[.09] px-[9px] py-[7px] text-[8px] tracking-[.12em]">EM DIA</span>
        </div>
        <div className="mb-[17px] mt-[27px] text-[58px] font-black leading-none tracking-[-.05em]">{brl(caixa)}</div>
        <div className="h-[7px] overflow-hidden rounded-full border border-white/10 bg-[rgba(0,45,36,.4)]"><div className="h-full bg-[linear-gradient(90deg,#a6ffe1,#fff)]" style={{ width: `${pct}%` }}/></div>
        <div className="mt-[9px] flex justify-between text-[9px] opacity-80"><span>{pct.toFixed(1).replace('.', ',')}% da meta · faltam {brl(falta).replace(',00','')}</span><span>Meta {brl(meta).replace(',00','')}</span></div>
      </section>
      <button onClick={() => { setErro(''); setRepondo(true) }} className="mt-[11px] flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/15 bg-white/[.07] px-4 py-3 text-sm font-bold transition hover:bg-white/[.11]">
        <Plus className="h-4 w-4" /> Repor créditos
      </button>
      {repondo && <section className="mt-[11px] rounded-[20px] border border-white/15 bg-white/[.055] p-4">
        <div className="text-sm font-extrabold">Repor créditos</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setServidor('uniplay')} className={`rounded-xl px-3 py-2 text-xs font-bold ${servidor === 'uniplay' ? 'bg-cyan-600 text-white' : 'bg-white/[.07]'}`}>UNIPLAY</button>
          <button onClick={() => setServidor('goat')} className={`rounded-xl px-3 py-2 text-xs font-bold ${servidor === 'goat' ? 'bg-orange-500 text-white' : 'bg-white/[.07]'}`}>GOAT</button>
        </div>
        <label className="mt-3 block text-[10px] uppercase tracking-[.12em] text-muted-foreground">Créditos comprados</label>
        <input inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Ex.: 50" className="mt-1 w-full rounded-xl border border-white/15 bg-black/10 px-3 py-2.5 text-sm outline-none" />
        <label className="mt-3 block text-[10px] uppercase tracking-[.12em] text-muted-foreground">Valor usado da caixinha</label>
        <input inputMode="decimal" value={valorCaixinha} onChange={e => setValorCaixinha(e.target.value)} placeholder="Ex.: 375" className="mt-1 w-full rounded-xl border border-white/15 bg-black/10 px-3 py-2.5 text-sm outline-none" />
        <div className="mt-1 text-[10px] text-muted-foreground">Disponível: {brl(caixa)}</div>
        {erro && <div className="mt-2 text-xs text-red-400">{erro}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button disabled={salvando} onClick={() => setRepondo(false)} className="rounded-xl bg-white/[.07] px-3 py-2.5 text-xs font-bold">Cancelar</button>
          <button disabled={salvando} onClick={reporCreditos} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-60">{salvando ? 'Salvando...' : 'Confirmar'}</button>
        </div>
      </section>}
    </section>
  </div>
}