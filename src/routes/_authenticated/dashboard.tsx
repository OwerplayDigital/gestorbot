import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Clock, 
  AlertCircle,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  History,
  Activity,
  Calendar,
  Trash2,
  RefreshCcw
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as formatTz } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type DashboardStats = {
  totalClients: number;
  activeClients: number;
  totalVencidos: number;
  expiringTodayCount: number;
  entradas: number;
  saidas: number;
  lucro: number;
  expiringToday: any[];
  vencidos: any[];
  chartData: any[];
  recentTransactions: any[];
  previousPeriodLucro: number;
  previousPeriodEntradas: number;
  transactionsCount: number;
};

const parseDate = (d: any): Date | null => {
  if (!d || typeof d !== 'string') return null;
  const parts = d.split(/[/-]/);
  if (parts.length !== 3) return null;

  const s0 = parts[0];
  const s1 = parts[1];
  const s2 = parts[2];
  if (s0 === undefined || s1 === undefined || s2 === undefined) return null;

  const p0 = Number(s0);
  const p1 = Number(s1);
  const p2 = Number(s2);

  let resultDate: Date | null = null;
  if (d.includes('/') || (d.includes('-') && s0.length === 2)) {
    // DD/MM/YYYY
    resultDate = new Date(p2, p1 - 1, p0);
  } else if (d.includes('-') && s0.length === 4) {
    // YYYY-MM-DD
    resultDate = new Date(p0, p1 - 1, p2);
  }

  if (resultDate && !isNaN(resultDate.getTime())) {
    resultDate.setHours(0, 0, 0, 0);
    return resultDate;
  }
  return null;
};

function Dashboard() {
  const [showValues, setShowValues] = useState(true);
  const [activeTab, setActiveTab] = useState("mes");
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  const currentMonthLabel = formatTz(nowBr, "MMMM/yy", { locale: ptBR })
    .replace(/^\w/, (c) => c.toUpperCase());
  

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-modern", activeTab],
    queryFn: async () => {
      try {
        const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
        const todayStr = formatTz(nowBr, "yyyy-MM-dd");
        const currentMonth = formatTz(nowBr, "MM");
        const currentYear = formatTz(nowBr, "yyyy");
        
        const [
          clientsRes, 
          transactionsRes, 
          serversRes,
        ] = await Promise.all([
          supabase.from("clientes").select("id, nome, vencimento, valor, status, servidores_ids"),
          supabase.from("transacoes").select("*, clientes(nome, servidores_ids), servidores_iptv(name)").order("created_at", { ascending: false }),
          supabase.from("servidores_iptv").select("id, name"),
        ]);

        const clients = clientsRes.data ?? [];
        const transactions = transactionsRes.data ?? [];
        const servers = serversRes.data ?? [];

        const vencidos = clients
          .filter((c: any) => {
            const vencDate = parseDate(c.vencimento);
            return vencDate && vencDate < nowBr;
          })
          .sort((a: any, b: any) => {
            const dateA = parseDate(a.vencimento);
            const dateB = parseDate(b.vencimento);
            return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
          });
          
        const expiringToday = clients.filter((c: any) => {
          const vencDate = parseDate(c.vencimento);
          return vencDate && formatTz(vencDate, "yyyy-MM-dd") === todayStr;
        });

        const totalClients = clients.length;
        const activeClients = clients.filter((c: any) => c.status === "ativo").length;
        const totalVencidos = vencidos.length;

        // Filtro do período atual
        const filteredTransactions = transactions.filter(t => {
          if (!t.data) return false;
          const tDate = parseISO(t.data);
          
          if (activeTab === "hoje") {
            return format(tDate, "yyyy-MM-dd") === todayStr;
          } else if (activeTab === "mes") {
            return format(tDate, "MM") === currentMonth && format(tDate, "yyyy") === currentYear;
          } else if (activeTab === "ano") {
            return format(tDate, "yyyy") === currentYear;
          }
          return true;
        });

        // Filtro do período anterior para comparação de lucro
        const previousTransactions = transactions.filter(t => {
          if (!t.data) return false;
          const tDate = parseISO(t.data);
          
          if (activeTab === "hoje") {
            const yesterday = new Date(nowBr);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = formatTz(yesterday, "yyyy-MM-dd");
            return format(tDate, "yyyy-MM-dd") === yesterdayStr;
          } else if (activeTab === "mes") {
            const lastMonth = new Date(nowBr);
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const lastMonthStr = format(lastMonth, "MM");
            const lastYearStr = format(lastMonth, "yyyy");
            return format(tDate, "MM") === lastMonthStr && format(tDate, "yyyy") === lastYearStr;
          } else if (activeTab === "ano") {
            const lastYear = Number(currentYear) - 1;
            return format(tDate, "yyyy") === lastYear.toString();
          }
          return false;
        });

        const entradas = filteredTransactions.reduce((acc, t) => acc + Number(t.entrada ?? 0), 0);
        const saidas = filteredTransactions.reduce((acc, t) => acc + Number(t.custo ?? 0), 0);
        const lucro = filteredTransactions.reduce((acc, t) => acc + Number(t.lucro_liquido ?? 0), 0);
        const previousPeriodLucro = previousTransactions.reduce((acc, t) => acc + Number(t.lucro_liquido ?? 0), 0);
        const previousPeriodEntradas = previousTransactions.reduce((acc, t) => acc + Number(t.entrada ?? 0), 0);
        const transactionsCount = filteredTransactions.length;

        const monthsLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const currentMonthIdx = nowBr.getMonth();
        const currentYearNum = nowBr.getFullYear();
        
        // Calcular os últimos 10 meses para garantir que Maio e Junho apareçam bem
        const lastTenMonths = [];
        for (let i = 9; i >= 0; i--) {
          let mIdx = currentMonthIdx - i;
          let y = currentYearNum;
          if (mIdx < 0) {
            mIdx += 12;
            y -= 1;
          }
          lastTenMonths.push({ mIdx, y, label: monthsLabels[mIdx] });
        }

        const chartData = lastTenMonths.map(({ mIdx, y, label }: { mIdx: number, y: number, label: string }) => {
          const monthTrans = transactions.filter(t => {
            if (!t.data) return false;
            const d = parseISO(t.data);
            return d.getFullYear() === y && d.getMonth() === mIdx;
          });
          
          const ent = monthTrans.reduce((a, b) => a + Number(b.entrada ?? 0), 0);
          const sai = monthTrans.reduce((a, b) => a + Number(b.custo ?? 0), 0);
          
          return {
            name: label,
            entradas: ent,
            saidas: sai,
            lucro: ent - sai
          };
        });

        const transactionsWithResolvedServers = filteredTransactions.map((t: any) => {
          const directServerName = t.servidores_iptv?.name;
          const clientServerId = t.clientes?.servidores_ids?.[0];
          const fallbackServerName = clientServerId ? servers.find(s => s.id === clientServerId)?.name : null;
          
          return {
            ...t,
            resolvedServerName: directServerName || fallbackServerName || "Painel"
          };
        });

        const expiringWithServers = expiringToday.map((c: any) => {
          return {
            ...c,
            valorFinal: Number(c.valor ?? 0),
            serverName: servers.find(s => c.servidores_ids?.includes(s.id))?.name || "Painel"
          };
        });

        return {
          totalClients,
          activeClients,
          totalVencidos,
          expiringTodayCount: expiringToday.length,
          entradas,
          saidas,
          lucro,
          expiringToday: expiringWithServers,
          vencidos: vencidos.map(c => ({
            id: c.id,
            nome: c.nome,
            status: c.status,
            valor: c.valor,
            vencimento: c.vencimento
          })),
          chartData,
          recentTransactions: transactionsWithResolvedServers,
          previousPeriodLucro,
          previousPeriodEntradas,
          transactionsCount
        };

      } catch (error) {
        console.error("Dashboard error:", error);
        throw error;
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-2">
          <Activity className="h-10 w-10 text-primary animate-pulse" />
          <span className="text-sm font-medium animate-pulse text-muted-foreground">Carregando painel...</span>
        </div>
      </div>
    );
  }

  const formatBRL = (val: number | string | null | undefined) => {
    const num = Number(val ?? 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 pb-12 max-w-7xl mx-auto w-full">
      
      <div className="flex flex-col md:flex-row md:items-center justify-end gap-6">
        <div className="bg-card border border-border p-1 rounded-2xl flex items-center gap-1 self-start md:self-center shadow-sm">
          {[
            { id: "hoje", label: "Hoje" },
            { id: "mes", label: currentMonthLabel },
            { id: "ano", label: "Ano" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Grid de Métricas Principais */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-sm dark:shadow-[0_0_12px_rgba(34,197,94,0.05)] dark:hover:shadow-[0_0_12px_rgba(34,197,94,0.25)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">Lucro Líquido</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-foreground dark:text-white">{showValues ? formatBRL(stats?.lucro ?? 0) : "•••••"}</div>
          <div className="text-[10px] font-bold text-muted-foreground mt-2 flex items-center gap-1">
            {stats && stats.previousPeriodLucro !== 0 && (
              <>
                {((stats.lucro - stats.previousPeriodLucro) / Math.abs(stats.previousPeriodLucro)) >= 0 ? (
                  <TrendingUp size={10} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={10} className="text-rose-500" />
                )}
                <span className={((stats.lucro - stats.previousPeriodLucro) / Math.abs(stats.previousPeriodLucro)) >= 0 ? "text-emerald-500" : "text-rose-500"}>
                  {((stats.lucro - stats.previousPeriodLucro) / Math.abs(stats.previousPeriodLucro) * 100).toFixed(1)}%
                </span>
                em relação ao período anterior
              </>
            )}
            {(!stats || stats.previousPeriodLucro === 0) && (
              <span className="text-muted-foreground opacity-50">Sem dados comparativos</span>
            )}
          </div>
        </div>

        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-lg">Faturamento</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="text-3xl font-black text-foreground dark:text-white">{showValues ? formatBRL(stats?.entradas ?? 0) : "•••••"}</div>
          <div className="text-[10px] font-bold text-muted-foreground mt-2">
            {activeTab === 'hoje' 
              ? `${stats?.transactionsCount ?? 0} renovações hoje` 
              : `${stats?.activeClients ?? 0} clientes ativos pagantes`}
          </div>
        </div>

        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded-lg">Custo Operacional</span>
            <TrendingDown size={18} className="text-rose-500" />
          </div>
          <div className="text-3xl font-black text-foreground dark:text-white">{showValues ? formatBRL(stats?.saidas ?? 0) : "•••••"}</div>
          <div className="text-[10px] font-bold text-muted-foreground mt-2">Investimento total em painéis/servidores</div>
        </div>
      </section>

      {/* Seção de Extrato Recente de Renovações */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black tracking-tighter text-foreground uppercase">Extrato Recente</h2>
          <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:bg-primary/10 transition-colors">Ver Histórico</Button>
        </div>

        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Tabela para Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border/50">
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cliente / Servidor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Plano</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Custo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Lucro</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats?.recentTransactions?.slice(0, 5).map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-foreground text-sm tracking-tight uppercase">{t.clientes?.nome || "Cliente"}</span>
                        <span className="text-[10px] text-muted-foreground font-bold">{t.resolvedServerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-foreground">{formatBRL(t.entrada)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-rose-500">{formatBRL(t.custo)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-emerald-500">{formatBRL(t.lucro_liquido)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[350px] rounded-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-center uppercase font-black tracking-tighter">Confirmar Exclusão</DialogTitle>
                          </DialogHeader>
                          <p className="text-center text-sm text-muted-foreground font-medium py-4">Deseja realmente excluir este registro de transação?</p>
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => {}}>Cancelar</Button>
                            <Button variant="destructive" className="flex-1 rounded-xl font-black uppercase" onClick={async () => {
                              const { error } = await supabase.from('transacoes').delete().eq('id', t.id);
                              if (error) {
                                toast.error("Erro ao excluir registro");
                              } else {
                                toast.success("Registro removido");
                              }
                            }}>Excluir</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista Compacta para Mobile */}
          <div className="md:hidden divide-y divide-border/50">
            {stats?.recentTransactions?.slice(0, 5).map((t: any) => (
              <div key={t.id} className="p-3 flex flex-col gap-1.5 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <span className="font-black text-foreground text-sm tracking-tight uppercase leading-tight truncate max-w-[140px] shrink">
                      {t.clientes?.nome || "Cliente"}
                    </span>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0">
                      {t.resolvedServerName.split(',').map((s: string, idx: number) => (
                        <Badge key={idx} className="bg-primary/10 text-primary border-primary/20 text-[8px] px-1 py-0 font-black h-3.5 uppercase whitespace-nowrap">
                          {s.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <span className="text-[9px] text-muted-foreground font-black uppercase whitespace-nowrap">
                      {t.data ? format(parseISO(t.data), "dd/MM/yyyy") : "-"}
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors">
                          <Trash2 size={12} />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[90vw] rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="text-center uppercase font-black tracking-tighter">Confirmar Exclusão</DialogTitle>
                        </DialogHeader>
                        <p className="text-center text-sm text-muted-foreground font-medium py-4">Deseja realmente excluir este registro de transação?</p>
                        <div className="flex gap-2">
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1 rounded-xl font-bold">Cancelar</Button>
                          </DialogTrigger>
                          <Button variant="destructive" className="flex-1 rounded-xl font-black uppercase" onClick={async () => {
                            const { error } = await supabase.from('transacoes').delete().eq('id', t.id);
                            if (error) {
                              toast.error("Erro ao excluir registro");
                            } else {
                              toast.success("Registro removido");
                            }
                          }}>Excluir</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 bg-muted/20 p-2 rounded-xl border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-0.5">Plano</span>
                    <span className="text-xs font-black text-foreground leading-tight">{formatBRL(t.entrada)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-0.5">Custo</span>
                    <span className="text-xs font-black text-rose-500 leading-tight">{formatBRL(t.custo)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-0.5">Lucro</span>
                    <span className="text-xs font-black text-emerald-500 leading-tight">{formatBRL(t.lucro_liquido)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
            <div className="px-6 py-12 text-center text-muted-foreground font-medium text-sm">
              Nenhuma renovação registrada recentemente.
            </div>
          )}
        </div>
      </section>

      <section className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground dark:text-white uppercase leading-none">Performance Mensal</h3>
          </div>
          <div className="bg-muted/30 border border-border/50 rounded-2xl px-3 py-2 text-right">
            <span className="block text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">VS Mês Anterior</span>
            {stats && stats.previousPeriodEntradas !== 0 ? (
              <span className={`text-xs font-black ${((stats.entradas - stats.previousPeriodEntradas) / stats.previousPeriodEntradas) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {((stats.entradas - stats.previousPeriodEntradas) / stats.previousPeriodEntradas * 100) >= 0 ? "+" : ""}
                {((stats.entradas - stats.previousPeriodEntradas) / stats.previousPeriodEntradas * 100).toFixed(1)}%
              </span>
            ) : (
              <span className="text-xs font-black text-muted-foreground opacity-50">-%</span>
            )}
          </div>
        </div>
        
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={stats?.chartData ?? []} 
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              barGap={2}
              barCategoryGap="10%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = (payload[0] as any)?.payload as any;
                    return (
                      <div className="bg-card dark:bg-[#090D16] border border-border dark:border-slate-800 rounded-xl p-3 shadow-2xl text-xs">
                        <p className="font-black text-foreground dark:text-white mb-2 pb-1 border-b border-border dark:border-slate-800">{data.name}</p>
                        <div className="space-y-1">
                          <p className="text-[#0284c7] flex justify-between gap-4 font-bold"><span>Entradas</span> <span>{formatBRL(data.entradas)}</span></p>
                          <p className="text-[#ef4444] flex justify-between gap-4 font-bold"><span>Saídas</span> <span>{formatBRL(data.saidas)}</span></p>
                          <p className="text-[#22c55e] flex justify-between gap-4 font-bold border-t border-border dark:border-slate-800 pt-1 mt-1"><span>Lucro</span> <span>{formatBRL(data.lucro)}</span></p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="center" 
                height={40} 
                iconType="rect" 
                formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-4">{value}</span>}
              />
              <Bar name="Entradas" dataKey="entradas" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar name="Saídas" dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={16} />
              <Bar name="Lucro" dataKey="lucro" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  );
}
