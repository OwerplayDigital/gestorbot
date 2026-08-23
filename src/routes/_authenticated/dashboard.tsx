import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Clock, 
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ArrowRight,
  History,
  Activity,
  User,
  Calendar,
  Trash2
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as formatTz } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BOT_TEMPLATES } from "@/lib/templates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Phone } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), "MM"));
  const [selectedYear, setSelectedYear] = useState(formatTz(toZonedTime(new Date(), 'America/Sao_Paulo'), "yyyy"));
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-detailed", selectedMonth, selectedYear],
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

  const handleDeleteTransaction = async (id: string) => {
    try {
      setIsDeleting(id);
      const { error } = await supabase
        .from("transacoes")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Lançamento excluído com sucesso");
      refetch();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir lançamento");
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredExpiring = useMemo(() => {
    if (!stats?.expiringToday) return [];
    return stats.expiringToday.filter(c => 
      (c.nome || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [stats?.expiringToday, searchTerm]);

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
    <div className="flex flex-col gap-6 p-4 pb-12 max-w-lg mx-auto md:max-w-4xl">
      
      {/* Hero Card Financeiro */}
      <section>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-owerplay-cyan p-3 text-background shadow-lg shadow-owerplay-cyan/20 ring-1 ring-white/20">
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">Entradas</span>
            <div className="text-sm font-black truncate">{showValues ? formatBRL(stats?.entradas ?? 0) : "•••••"}</div>
          </div>
          <div className="rounded-2xl bg-rose-500 p-3 text-white shadow-lg shadow-rose-500/20 ring-1 ring-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">Saídas</span>
            <div className="text-sm font-black truncate">{showValues ? formatBRL(stats?.saidas ?? 0) : "•••••"}</div>
          </div>
          <div className="rounded-2xl bg-emerald-500 p-3 text-white shadow-lg shadow-emerald-500/40 ring-1 ring-emerald-400/50 animate-pulse-subtle">
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">Lucro</span>
            <div className="text-sm font-black truncate">{showValues ? formatBRL(stats?.lucro ?? 0) : "•••••"}</div>
          </div>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-tight">Ativos</span>
          </div>
          <span className="text-2xl font-bold">{stats?.activeClients}</span>
        </div>
        
        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} />
            <span className="text-xs font-bold uppercase tracking-tight">Vencendo</span>
          </div>
          <span className="text-2xl font-bold">{stats?.expiringTodayCount}</span>
        </div>

        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity size={16} />
            <span className="text-xs font-bold uppercase tracking-tight">Total</span>
          </div>
          <span className="text-2xl font-bold">{stats?.totalClients}</span>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <button className="bg-card border rounded-2xl p-4 flex flex-col gap-1 text-left hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 text-rose-500">
                <AlertCircle size={16} />
                <span className="text-xs font-bold uppercase tracking-tight">Vencidos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-rose-500">{stats?.totalVencidos}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Clientes Vencidos</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2 mt-4">
              {stats?.vencidos && stats.vencidos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum inadimplente encontrado.</p>
              ) : (
                stats?.vencidos.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 border rounded-xl">
                    <div className="flex flex-col">
                      <span className="font-bold">{c.nome}</span>
                      <span className="text-xs text-muted-foreground">Venceu em {c.vencimento ? format(parseDate(c.vencimento)!, "dd/MM/yyyy") : "?"}</span>
                    </div>
                    <Badge variant="destructive">{formatBRL(c.valor)}</Badge>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </section>



      <section className="space-y-6 pt-4 border-t">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <History className="h-5 w-5 text-owerplay-cyan" />
            FINANCEIRO
          </h2>
          
          <div className="flex gap-2">
             <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px] rounded-xl h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {[
                  { v: "01", l: "Janeiro" },
                  { v: "02", l: "Fevereiro" },
                  { v: "03", l: "Março" },
                  { v: "04", l: "Abril" },
                  { v: "05", l: "Maio" },
                  { v: "06", l: "Junho" },
                  { v: "07", l: "Julho" },
                  { v: "08", l: "Agosto" },
                  { v: "09", l: "Setembro" },
                  { v: "10", l: "Outubro" },
                  { v: "11", l: "Novembro" },
                  { v: "12", l: "Dezembro" }
                ].map(m => (
                   <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] rounded-xl h-9">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {["2024", "2025", "2026"].map(y => (
                   <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        {/* Gráfico de Barras */}
        <div className="bg-card border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Gráfico financeiro</h3>
            <Badge variant="secondary" className="text-[10px] bg-owerplay-cyan/10">VS MÊS ANTERIOR (+12%)</Badge>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.chartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = (payload[0] as any)?.payload as any;
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-xl text-xs">
                          <p className="font-bold border-b pb-1 mb-1">{data.name}</p>
                          <p className="text-emerald-500">↑ {formatBRL(data.entradas)}</p>
                          <p className="text-rose-500">↓ {formatBRL(data.saidas)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="entradas" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Extrato Recente */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-widest">Extrato Recente</h3>
            <ArrowRight size={14} className="text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            {stats && stats.recentTransactions && stats.recentTransactions.length === 0 ? (
               <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma transação este mês.</p>
            ) : (
              stats?.recentTransactions.map((t) => {
                const entrada = Number(t.entrada || 0);
                const saida = Number(t.custo || 0);
                const lucro = Number(t.lucro_liquido || 0);
                const id = t.id;

                  return (
                    <div key={id} className="bg-card border rounded-2xl p-3 flex flex-col gap-2 relative">
                      <div className="absolute top-2 right-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                              disabled={isDeleting === id}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta transação?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={async () => {
                                    await handleDeleteTransaction(id);
                                }}
                                className="bg-rose-500 hover:bg-rose-600"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs font-bold pr-8 truncate">Renovação - {t.clientes?.nome || "Geral"}</span>
                        <span className="text-[9px] text-muted-foreground">{t.data ? format(parseISO(t.data), "dd/MM/yyyy") : "?"}</span>
                      </div>

                      <div className="flex items-center gap-3 pt-1 border-t border-dashed overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">Entrada:</span>
                          <span className="text-emerald-500 font-bold text-[11px]">{formatBRL(entrada)}</span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold">Custo:</span>
                          <span className="text-rose-500 font-bold text-[11px] flex items-center">{formatBRL(saida)}</span>
                        </div>
                        <div className="flex items-center gap-1 whitespace-nowrap ml-auto">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-owerplay-cyan/10 border-owerplay-cyan/30 text-owerplay-cyan font-black">
                            LUCRO: {formatBRL(lucro)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}

          </div>
        </div>
      </section>

    </div>
  );
}
