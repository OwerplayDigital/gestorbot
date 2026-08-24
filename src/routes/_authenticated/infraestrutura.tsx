import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/infraestrutura')({
  component: InfraestruturaPage,
})

function InfraestruturaPage() {
  const [tab, setTab] = useState<'servidores' | 'aplicativos' | 'planos'>('servidores')
  const [servidores, setServidores] = useState<Array<{ id: string; name: string; valor: number; active: boolean | null }>>([])
  const [planos, setPlanos] = useState<Array<{ id: string; name: string; price: number; active: boolean | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: servidoresData }, { data: planosData }] = await Promise.all([
      supabase.from('servidores_iptv').select('id, name, valor, active').order('name'),
      supabase.from('plans').select('id, name, price, active').order('name'),
    ])

    setServidores(servidoresData ?? [])
    setPlanos(planosData ?? [])
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Infraestrutura</h1>
        <p className="text-muted-foreground">Gerencie servidores, aplicativos e planos.</p>
      </div>

      <div className="flex gap-2 border-b">
        {[
          ['servidores', 'Servidores'],
          ['aplicativos', 'Aplicativos'],
          ['planos', 'Planos'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value as typeof tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">Carregando...</div>
      ) : tab === 'servidores' ? (
        <div className="space-y-3">
          {servidores.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">Nenhum servidor cadastrado.</div>
          ) : servidores.map((servidor) => (
            <div key={servidor.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{servidor.name}</p>
                <p className="text-sm text-muted-foreground">Custo: R$ {Number(servidor.valor).toFixed(2).replace('.', ',')}</p>
              </div>
              <span className="text-sm text-muted-foreground">{servidor.active === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          ))}
        </div>
      ) : tab === 'planos' ? (
        <div className="space-y-3">
          {planos.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">Nenhum plano cadastrado.</div>
          ) : planos.map((plano) => (
            <div key={plano.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{plano.name}</p>
                <p className="text-sm text-muted-foreground">Valor padrão: R$ {Number(plano.price).toFixed(2).replace('.', ',')}</p>
              </div>
              <span className="text-sm text-muted-foreground">{plano.active === false ? 'Inativo' : 'Ativo'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          Cadastro de aplicativos será definido posteriormente. Nenhuma tabela nova foi criada.
        </div>
      )}
    </div>
  )
}
