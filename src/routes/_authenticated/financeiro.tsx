import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, Layers3, Server, Users, WalletCards } from "lucide-react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ServerBadge } from "@/components/ServerBadge";

export const Route = createFileRoute("/_authenticated/financeiro")({ component: FinanceiroPage });

type SelectedMonth = { label: string; value: string; date: Date };
type RankingItem = { id: string; name: string; count: number; percentage: number };
type AnalyticsData = { activeClients: number; multiServerClients: number; serverRanking: RankingItem[]; planRanking: RankingItem[] };

function serverAccent(name: string) {
  if (/uniplay/i.test(name)) return { bar: "bg-sky-500", text: "text-sky-500", soft: "bg-sky-500/10" };
  if (/goat/i.test(name)) return { bar: "bg-orange-500", text: "text-orange-500", soft: "bg-orange-500/10" };
  if (/p2braz/i.test(name)) return { bar: "bg-purple-500", text: "text-purple-500", soft: "bg-purple-500/10" };
  return { bar: "bg-primary", text: "text-primary", soft: "bg-primary/10" };
}

function FinanceiroPage() {
  const nowBr = toZonedTime(new Date(), "America/Sao_Paulo");
  const months = useMemo(() => {
    const items: SelectedMonth[] = [];
    for (let i = 1; i <= 12; i++) {
      const date = subMonths(nowBr, i);
      items.push({
        label: format(date, "MMMM / yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
        value: format(date, "yyyy-MM"),
        date,
      });
    }
    return items;
  }, [nowBr]);
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(months[0]!);

  const { data: transactions = [], isLoading: loadingFinance } = useQuery({
    queryKey: ["financeiro-summary", selectedMonth.value],
    queryFn: async () => {
      const start = startOfMonth(selectedMonth.date);
      const end = endOfMonth(selectedMonth.date);
      const { data, error } = await supabase
        .from("transacoes")
        .select("entrada, custo")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const { data: analytics, isLoading: loadingAnalytics } = useQuery<AnalyticsData>({
    queryKey: ["financeiro-operational-analytics"],
    staleTime: 120000,
    queryFn: async () => {
      const [clientsRes, serversRes, plansRes] = await Promise.all([
        supabase.from("clientes").select("id, status, plano_id, servidores_ids"),
        supabase.from("servidores_iptv").select("id, name").order("name"),
        supabase.from("plans").select("id, name").order("name"),
      ]);
      if (clientsRes.error) throw clientsRes.error;
      if (serversRes.error) throw serversRes.error;
      if (plansRes.error) throw plansRes.error;

      const clients = (clientsRes.data || []).filter((client: any) => client.status === "ativo");
      const serverCounts = new Map<string, number>();
      const planCounts = new Map<string, number>();
      let multiServerClients = 0;

      clients.forEach((client: any) => {
        const serverIds = Array.isArray(client.servidores_ids) ? client.servidores_ids : [];
        if (serverIds.length > 1) multiServerClients += 1;
        serverIds.forEach((id: string) => serverCounts.set(id, (serverCounts.get(id) || 0) + 1));
        if (client.plano_id) planCounts.set(client.plano_id, (planCounts.get(client.plano_id) || 0) + 1);
      });

      const activeClients = clients.length;
      const percentage = (count: number) => activeClients ? (count / activeClients) * 100 : 0;
      const serverRanking = (serversRes.data || []).map((server: any) => ({ id: server.id, name: server.name, count: serverCounts.get(server.id) || 0, percentage: percentage(serverCounts.get(server.id) || 0) })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      const planRanking = (plansRes.data || []).map((plan: any) => ({ id: plan.id, name: plan.name, count: planCounts.get(plan.id) || 0, percentage: percentage(planCounts.get(plan.id) || 0) })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
      return { activeClients, multiServerClients, serverRanking, planRanking };
    },
  });

  const stats = useMemo(() => {
    const entradas = transactions.reduce((sum: number, row: any) => sum + Number(row.entrada || 0), 0);
    const custos = transactions.reduce((sum: number, row: any) => sum + Number(row.custo || 0), 0);
    return { entradas, custos, lucro: entradas - custos };
  }, [transactions]);

  const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const topServer = analytics?.serverRanking[0];
  const topPlan = analytics?.planRanking[0];

  if (loadingFinance || loadingAnalytics) {
    return <div className="mx-auto max-w-7xl p-4 md:p-8"><div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando...</div></div>;
  }

  return <div className="mx-auto w-full max-w-7xl p-4 pb-12 md:p-8">
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <h1 className="text-2xl font-black tracking-tight">Financeiro</h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[176px] justify-between gap-2 rounded-xl bg-card font-semibold">
            <Calendar size={16} className="text-primary" />
            <span>{selectedMonth.label}</span>
            <ChevronDown size={15} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px] rounded-xl">
          {months.map((month) => <DropdownMenuItem key={month.value} onClick={() => setSelectedMonth(month)} className="cursor-pointer font-medium">{month.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <section className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl shadow-primary/10 md:p-7">
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/15 blur-2xl" />
      <div className="relative">
        <div className="mb-8 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Resultado do período</span>
          <span className="rounded-xl bg-white/10 p-2.5"><WalletCards size={19} /></span>
        </div>
        <div className="text-4xl font-black tracking-[-.04em] md:text-5xl">{formatBRL(stats.lucro)}</div>
        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          <span className="flex items-center gap-2 text-emerald-300"><ArrowUpRight size={16} /><b>{formatBRL(stats.entradas)}</b> entradas</span>
          <span className="flex items-center gap-2 text-rose-300"><ArrowDownRight size={16} /><b>{formatBRL(stats.custos)}</b> custos</span>
        </div>
      </div>
    </section>

    <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Clientes ativos" value={String(analytics?.activeClients || 0)} icon={Users} />
      <MetricCard label="Multi-servidor" value={String(analytics?.multiServerClients || 0)} icon={Server} />
      <MetricCard label="Servidor líder" value={topServer?.name || "—"} detail={topServer ? `${topServer.count} clientes` : undefined} icon={Server} />
      <MetricCard label="Plano líder" value={topPlan?.name || "—"} detail={topPlan ? `${topPlan.count} clientes` : undefined} icon={Layers3} />
    </section>

    <section className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-[24px] border bg-card shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-black tracking-tight">Servidores</h2></div>
        <div className="space-y-4 p-5">{analytics?.serverRanking.length ? analytics.serverRanking.map((item, index) => {
          const accent = serverAccent(item.name);
          return <div key={item.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground">{index + 1}</span><ServerBadge name={item.name} /></div>
              <div className="shrink-0 text-right"><p className={`text-sm font-black ${accent.text}`}>{item.count}</p><p className="text-[10px] text-muted-foreground">{item.percentage.toFixed(1).replace('.', ',')}%</p></div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${Math.max(4, item.percentage)}%` }} /></div>
          </div>;
        }) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum servidor em uso.</p>}</div>
      </div>

      <div className="overflow-hidden rounded-[24px] border bg-card shadow-sm">
        <div className="border-b px-5 py-4"><h2 className="font-black tracking-tight">Planos</h2></div>
        <div className="space-y-4 p-5">{analytics?.planRanking.length ? analytics.planRanking.map((item, index) => <div key={item.id}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground">{index + 1}</span><p className="truncate text-sm font-bold">{item.name}</p></div>
            <div className="shrink-0 text-right"><p className="text-sm font-black text-primary">{item.count}</p><p className="text-[10px] text-muted-foreground">{item.percentage.toFixed(1).replace('.', ',')}%</p></div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, item.percentage)}%` }} /></div>
        </div>) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum plano em uso.</p>}</div>
      </div>
    </section>
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: any }) {
  return <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Icon size={15} /></span></div>
    <p className="truncate text-xl font-black tracking-tight" title={value}>{value}</p>
    {detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}
  </div>;
}
