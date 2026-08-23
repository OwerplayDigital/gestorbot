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
  Trash2
} from "lucide-react";
import { format, parseISO } from "date-fns";
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
  
  const selectedMonth = formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), "MM");
  const selectedYear = formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), "yyyy");

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-modern", selectedMonth, selectedYear],
    queryFn: async () => {
      try {
        const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
        nowBr.setHours(0, 0, 0, 0);
        const todayStr = formatTz(nowBr, "yyyy-MM-dd");
        
        const [
          clientsRes, 
          transactionsRes, 
          serversRes,
        ] = await Promise.all([
          supabase.from("clientes").select("id, nome, vencimento, valor, status"),
          supabase.from("transacoes").select("*, clientes(nome), servidores_iptv(name)").order("created_at", { ascending: false }),
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

        const currentMonthTransactions = transactions.filter(t => {
          if (!t.data) return false;
          const tDate = parseISO(t.data);
          return format(tDate, "MM") === selectedMonth && format(tDate, "yyyy") === selectedYear;
        });

        const entradas = currentMonthTransactions
          .reduce((acc, t) => acc + Number(t.entrada ?? 0), 0);
        
        const saidas = currentMonthTransactions
          .reduce((acc, t) => acc + Number(t.custo ?? 0), 0);

        const lucro = currentMonthTransactions
          .reduce((acc, t) => acc + Number(t.lucro_liquido ?? 0), 0);

        const monthsLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const chartData = monthsLabels.map((m, idx) => {
          const monthStr = (idx + 1).toString().padStart(2, '0');
          const monthTrans = transactions.filter(t => {
            if (!t.data) return false;
            const d = parseISO(t.data);
            return format(d, "MM") === monthStr && format(d, "yyyy") === selectedYear;
          });
          const ent = monthTrans.reduce((a, b) => a + Number(b.entrada ?? 0), 0);
          const sai = monthTrans.reduce((a, b) => a + Number(b.custo ?? 0), 0);
          return {
            name: m,
            entradas: ent,
            saidas: sai,
            lucro: ent - sai
          };
        });

        const expiringWithServers = expiringToday.map((c: any) => {
          return {
            ...c,
            valorFinal: Number(c.valor ?? 0),
            serverName: servers.find(s => c.servidores_ids?.includes(s.id))?.name || "N/A"
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
          vencidos,
          chartData,
          recentTransactions: currentMonthTransactions
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
      
      {/* Cabeçalho de Visão Geral */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Visão Geral do Negócio</h1>
          <p className="text-muted-foreground font-medium">Controle de métricas e performance em tempo real.</p>
        </div>

        <div className="bg-card border border-border p-1 rounded-2xl flex items-center gap-1 self-start md:self-center shadow-sm">
          {[
            { id: "hoje", label: "Hoje" },
            { id: "mes", label: "Agosto/26" },
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
            <TrendingUp size={10} className="text-emerald-500" />
            <span className="text-emerald-500">+12.4%</span> em relação ao período anterior
          </div>
        </div>

        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-owerplay-cyan uppercase tracking-widest bg-owerplay-cyan/10 px-2 py-1 rounded-lg">Faturamento</span>
            <Users size={18} className="text-owerplay-cyan" />
          </div>
          <div className="text-3xl font-black text-foreground dark:text-white">{showValues ? formatBRL(stats?.entradas ?? 0) : "•••••"}</div>
          <div className="text-[10px] font-bold text-muted-foreground mt-2">{stats?.activeClients} clientes ativos pagantes</div>
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

      {/* Seção de Revendedores */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black tracking-tighter text-foreground uppercase">Revendedores Parceiros</h2>
          <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:bg-primary/10">Ver Todos</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 1, nome: "João Silva", servidor: "P2Braz", creditos: 150, investido: 450, color: "bg-blue-500" },
            { id: 2, nome: "Maria Santos", servidor: "Goat", creditos: 85, investido: 255, color: "bg-purple-500" },
            { id: 3, nome: "Pedro Oliveira", servidor: "Uniplay", creditos: 200, investido: 600, color: "bg-emerald-500" },
            { id: 4, nome: "Ana Costa", servidor: "P2Braz", creditos: 120, investido: 360, color: "bg-amber-500" }
          ].map((rev) => (
            <div key={rev.id} className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-5 hover:bg-card transition-colors group shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-black text-lg ${rev.color} shadow-lg`}>
                  {rev.nome.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-foreground dark:text-white tracking-tight">{rev.nome}</span>
                  <Badge variant="secondary" className="w-fit text-[10px] h-5 font-bold bg-white/5 border-white/10">{rev.servidor}</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Créditos</span>
                  <span className="text-sm font-black text-foreground dark:text-white">{rev.creditos} un.</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Investido</span>
                  <span className="text-sm font-black text-emerald-500">{formatBRL(rev.investido)}</span>
                </div>
              </div>

              <Button className="w-full bg-secondary dark:bg-[#1e293b] hover:bg-secondary/80 dark:hover:bg-[#2e3b4e] text-foreground dark:text-white font-bold rounded-xl h-10 border border-border dark:border-slate-700 transition-all text-xs shadow-sm">
                Copiar Link
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Gráfico de Performance Financeira */}
      <section className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground dark:text-white uppercase">Performance Mensal</h3>
            <p className="text-xs text-muted-foreground font-medium">Comparativo de lucros e perdas do ano vigente.</p>
          </div>
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 font-black text-[10px]">
            ALTA DE +18% NO TRIMESTRE
          </Badge>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = (payload[0] as any)?.payload as any;
                    return (
                      <div className="bg-card dark:bg-[#090D16] border border-border dark:border-slate-800 rounded-xl p-3 shadow-2xl text-xs">
                        <p className="font-black text-foreground dark:text-white mb-2 pb-1 border-b border-border dark:border-slate-800">{data.name}</p>
                        <div className="space-y-1">
                          <p className="text-emerald-500 flex justify-between gap-4 font-bold"><span>Entradas</span> <span>{formatBRL(data.entradas)}</span></p>
                          <p className="text-rose-500 flex justify-between gap-4 font-bold"><span>Saídas</span> <span>{formatBRL(data.saidas)}</span></p>
                          <p className="text-foreground dark:text-white flex justify-between gap-4 font-black border-t border-border dark:border-slate-800 pt-1 mt-1"><span>Lucro</span> <span>{formatBRL(data.lucro)}</span></p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </div>
  );
}
