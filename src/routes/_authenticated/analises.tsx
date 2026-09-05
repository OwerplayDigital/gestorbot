import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Layers3, Server } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ServerBadge } from '@/components/ServerBadge'

export const Route = createFileRoute('/_authenticated/analises')({ component: AnalisesPage })

type RankingItem = {
  id: string
  name: string
  count: number
  percentage: number
}

type AnalyticsData = {
  activeClients: number
  multiServerClients: number
  serverRanking: RankingItem[]
  planRanking: RankingItem[]
}

function serverBarClass(name: string) {
  if (/uniplay/i.test(name)) return 'bg-sky-500'
  if (/goat/i.test(name)) return 'bg-orange-500'
  if (/p2braz/i.test(name)) return 'bg-purple-500'
  return 'bg-primary'
}

function serverTextClass(name: string) {
  if (/uniplay/i.test(name)) return 'text-sky-500'
  if (/goat/i.test(name)) return 'text-orange-500'
  if (/p2braz/i.test(name)) return 'text-purple-400'
  return 'text-primary'
}

function AnalisesPage() {
  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['operational-analytics'],
    staleTime: 120000,
    queryFn: async () => {
      const [clientsRes, serversRes, plansRes] = await Promise.all([
        supabase.from('clientes').select('id, status, plano_id, servidores_ids'),
        supabase.from('servidores_iptv').select('id, name').order('name'),
        supabase.from('plans').select('id, name').order('name'),
      ])

      if (clientsRes.error) throw clientsRes.error
      if (serversRes.error) throw serversRes.error
      if (plansRes.error) throw plansRes.error

      const clients = (clientsRes.data ?? []).filter((client: any) => client.status === 'ativo')
      const servers = serversRes.data ?? []
      const plans = plansRes.data ?? []

      const serverCounts = new Map<string, number>()
      const planCounts = new Map<string, number>()
      let multiServerClients = 0

      clients.forEach((client: any) => {
        const serverIds = Array.isArray(client.servidores_ids) ? client.servidores_ids : []
        if (serverIds.length > 1) multiServerClients += 1

        serverIds.forEach((serverId: string) => {
          serverCounts.set(serverId, (serverCounts.get(serverId) ?? 0) + 1)
        })

        if (client.plano_id) {
          planCounts.set(client.plano_id, (planCounts.get(client.plano_id) ?? 0) + 1)
        }
      })

      const activeClients = clients.length
      const makePercentage = (count: number) => activeClients > 0 ? (count / activeClients) * 100 : 0

      const serverRanking = servers
        .map((server: any) => ({
          id: server.id,
          name: server.name,
          count: serverCounts.get(server.id) ?? 0,
          percentage: makePercentage(serverCounts.get(server.id) ?? 0),
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      const planRanking = plans
        .map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          count: planCounts.get(plan.id) ?? 0,
          percentage: makePercentage(planCounts.get(plan.id) ?? 0),
        }))
        .filter(item => item.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

      return {
        activeClients,
        multiServerClients,
        serverRanking,
        planRanking,
      }
    },
  })

  if (isLoading) {
    return <div className="mx-auto max-w-6xl p-4 md:p-8"><div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando análises...</div></div>
  }

  if (error || !data) {
    return <div className="mx-auto max-w-6xl p-4 md:p-8"><div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Não foi possível carregar os dados.</div></div>
  }

  const topServer = data.serverRanking[0]
  const topPlan = data.planRanking[0]

  return <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:space-y-6 md:p-8">
    <div>
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Análises</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Visão da distribuição dos clientes ativos.</p>
    </div>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Servidor líder</p>
          <Server className={`h-4 w-4 shrink-0 ${topServer ? serverTextClass(topServer.name) : 'text-primary'}`} />
        </div>
        <div className="mt-2 min-w-0">
          {topServer ? <ServerBadge name={topServer.name} className="text-base" /> : <p className="text-xl font-bold tracking-tight md:text-2xl">—</p>}
        </div>
        {topServer && <p className={`mt-2 text-xs font-semibold ${serverTextClass(topServer.name)}`}>{topServer.count} clientes</p>}
      </div>

      <SummaryCard label="Plano líder" value={topPlan?.name ?? '—'} detail={topPlan ? `${topPlan.count} clientes` : undefined} icon={Layers3} />

      <div className="col-span-2 min-w-0 rounded-2xl border bg-card p-4 shadow-sm lg:col-span-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Multi-servidor</p>
          <BarChart3 className="h-4 w-4 shrink-0 text-primary" />
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight md:text-2xl">{data.multiServerClients}</p>
        <p className="mt-1 text-xs text-muted-foreground">clientes com mais de um servidor</p>
      </div>
    </section>

    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ServerRankingCard title="Clientes por servidor" subtitle="Um cliente pode aparecer em mais de um servidor." items={data.serverRanking} emptyText="Nenhum servidor vinculado a clientes ativos." />
      <RankingCard title="Clientes por plano" subtitle="Distribuição dos clientes ativos por plano." items={data.planRanking} emptyText="Nenhum plano vinculado a clientes ativos." />
    </section>
  </div>
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string | undefined; icon: any }) {
  return <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <Icon className="h-4 w-4 shrink-0 text-primary" />
    </div>
    <p className="mt-2 truncate text-xl font-bold tracking-tight md:text-2xl" title={value}>{value}</p>
    {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
  </div>
}

function ServerRankingCard({ title, subtitle, items, emptyText }: { title: string; subtitle: string; items: RankingItem[]; emptyText: string }) {
  const maxCount = items[0]?.count ?? 1

  return <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="border-b px-4 py-4 md:px-5">
      <h2 className="font-bold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>

    {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{emptyText}</p> : <div className="divide-y">
      {items.map((item, index) => <div key={item.id} className="px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">{index + 1}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <ServerBadge name={item.name} />
              <p className={`shrink-0 text-sm font-bold ${serverTextClass(item.name)}`}>{item.count}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${serverBarClass(item.name)}`} style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{item.percentage.toFixed(1).replace('.', ',')}% dos clientes ativos</p>
          </div>
        </div>
      </div>)}
    </div>}
  </div>
}

function RankingCard({ title, subtitle, items, emptyText }: { title: string; subtitle: string; items: RankingItem[]; emptyText: string }) {
  const maxCount = items[0]?.count ?? 1

  return <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="border-b px-4 py-4 md:px-5">
      <h2 className="font-bold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>

    {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">{emptyText}</p> : <div className="divide-y">
      {items.map((item, index) => <div key={item.id} className="px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">{index + 1}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold">{item.name}</p>
              <p className="shrink-0 text-sm font-bold">{item.count}</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{item.percentage.toFixed(1).replace('.', ',')}% dos clientes ativos</p>
          </div>
        </div>
      </div>)}
    </div>}
  </div>
}
