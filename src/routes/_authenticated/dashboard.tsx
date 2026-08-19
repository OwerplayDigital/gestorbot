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

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
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

function Dashboard() {
  const [showValues, setShowValues] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "MM"));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), "yyyy"));
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats-detailed", selectedMonth, selectedYear],
    queryFn: async () => {
      try {
        const now = new Date();
        const todayStr = format(now, "yyyy-MM-dd");
        
        const [
          clientsRes, 
          transactionsRes, 
          serversRes, 
          expiringTodayRes,
          vencidosRes
        ] = await Promise.all([
          supabase.from("clientes").select("id, status"),
          supabase.from("transacoes").select("*, clientes(nome), servidores_iptv(name)"),
          supabase.from("servidores_iptv").select("id, name"),
          supabase.from("clientes")
            .select("id, nome, vencimento, valor, desconto, servidores_ids, plano_id, plans(price)")
            .eq("vencimento", todayStr)
            .order("nome"),
          supabase.from("clientes")
            .select("id, nome, vencimento, valor, status")
            .eq("status", "vencido")
            .order("vencimento", { ascending: false })
        ]);

        const clients = clientsRes.data ?? [];
        const transactions = transactionsRes.data ?? [];
        const servers = serversRes.data ?? [];
        const expiringToday = expiringTodayRes.data ?? [];
        const vencidos = vencidosRes.data ?? [];

        const totalClients = clients.length;
        const activeClients = clients.filter(c => c.status === "ativo").length;
        const totalVencidos = clients.filter(c => c.status === "vencido").length;

        const currentMonthTransactions = transactions.filter(t => {
          if (!t.data) return false;
          const tDate = parseISO(t.data);
          return format(tDate, "MM") === selectedMonth && format(tDate, "yyyy") === selectedYear;
        });

        const entradas = currentMonthTransactions
          .filter(t => t.tipo === "entrada")
          .reduce((acc, t) => acc + Number(t.valor ?? 0), 0);
        
        const saidas = currentMonthTransactions
          .filter(t => t.tipo === "saida")
          .reduce((acc, t) => acc + Number(t.valor ?? 0), 0);

        const lucro = entradas - saidas;

        const monthsLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const chartData = monthsLabels.map((m, idx) => {
          const monthStr = (idx + 1).toString().padStart(2, '0');
          const monthTrans = transactions.filter(t => {
            if (!t.data) return false;
            const d = parseISO(t.data);
            return format(d, "MM") === monthStr && format(d, "yyyy") === selectedYear;
          });
          const ent = monthTrans.filter(t => t.tipo === "entrada").reduce((a, b) => a + Number(b.valor ?? 0), 0);
          const sai = monthTrans.filter(t => t.tipo === "saida").reduce((a, b) => a + Number(b.valor ?? 0), 0);
          return {
            name: m,
            entradas: ent,
            saidas: sai,
            lucro: ent - sai
          };
        });

        const expiringWithServers = expiringToday.map((c: any) => {
          const planPrice = Number(c.plans?.price ?? 0);
          const base = planPrice > 0 ? planPrice : Number(c.valor ?? 0);
          return {
            ...c,
            valorFinal: Math.max(0, base - Number(c.desconto || 0)),
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
        <div className="relative overflow-hidden rounded-3xl bg-owerplay-cyan p-6 text-background shadow-lg shadow-owerplay-cyan/20">
          <div className="relative z-10 flex flex-col gap-1">
            <div className="flex items-center justify-between opacity-80">
              <span className="text-sm font-semibold tracking-wider uppercase">Lucro do Mês</span>
              <button onClick={() => setShowValues(!showValues)} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                {showValues ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div className="text-4xl font-black tracking-tighter">
              {showValues ? formatBRL(stats?.lucro ?? 0) : "••••••"}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-bold">
              <span className="bg-background/20 px-2 py-0.5 rounded-full">
                {selectedMonth}/{selectedYear}
              </span>
              {stats && stats.lucro > 0 && (
                <span className="flex items-center gap-0.5 text-emerald-900">
                  <TrendingUp size={12} /> Em alta
                </span>
              )}
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-black/5 blur-2xl" />
        </div>
      </section>

      {/* Quick Stats Grid */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} />
            <span className="text-xs font-bold uppercase tracking-tight">Ativos</span>
          </div>
          <span className="text-2xl font-bold">{stats?.activeClients}</span>
        </div>
        
        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={16} />
            <span className="text-xs font-bold uppercase tracking-tight">Vencendo</span>
          </div>
          <span className="text-2xl font-bold">{stats?.expiringTodayCount}</span>
        </div>

        <div className="bg-card border rounded-2xl p-4 flex flex-col gap-1">
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
                      <span className="text-xs text-muted-foreground">Venceu em {c.vencimento ? format(parseISO(c.vencimento), "dd/MM/yyyy") : "?"}</span>
                    </div>
                    <Badge variant="destructive">{formatBRL(c.valor)}</Badge>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </section>

      {/* Feed Principal: Vencendo Hoje */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-tighter">VENCENDO HOJE</h2>
          <Badge variant="secondary" className="rounded-full">{stats?.expiringTodayCount}</Badge>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Buscar por nome..." 
            className="pl-10 rounded-xl bg-card border-none ring-1 ring-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3">
          {filteredExpiring.length === 0 ? (
            <div className="bg-card border-dashed border-2 rounded-2xl p-8 text-center text-muted-foreground">
              Nenhum vencimento para hoje {searchTerm && "com este nome"}.
            </div>
          ) : (
            filteredExpiring.map(client => (
              <div key={client.id} className="bg-card border rounded-2xl p-4 shadow-sm transition-all active:scale-[0.98]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-owerplay-cyan/10 flex items-center justify-center text-owerplay-cyan font-black">
                      {(client.nome || "C").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold tracking-tight">{client.nome}</span>
                      <Badge variant="outline" className="w-fit text-[10px] h-4 bg-owerplay-silver/10 border-owerplay-silver/30">
                        {client.serverName}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-owerplay-cyan">
                      {formatBRL(Number((client as any).valorFinal ?? 0))}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">A pagar</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Financeiro Detalhado & Histórico */}
      <section className="space-y-6 pt-4 border-t">
        <div className="flex flex-col gap-2">
           <h2 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <History className="h-5 w-5 text-owerplay-cyan" />
            FINANCEIRO
          </h2>
          
          <div className="flex gap-2">
             <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[120px] rounded-xl h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => (
                   <SelectItem key={m} value={m}>{m}</SelectItem>
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

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-card border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">Entradas</span>
                <span className="font-black">{formatBRL(stats?.entradas || 0)}</span>
              </div>
            </div>
            <div className="text-[10px] text-emerald-500 font-bold bg-emerald-500/5 px-2 py-1 rounded-full">+ Pix</div>
          </div>

          <div className="bg-card border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <TrendingDown size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-muted-foreground uppercase">Saídas</span>
                <span className="font-black">{formatBRL(stats?.saidas || 0)}</span>
              </div>
            </div>
            <div className="text-[10px] text-rose-500 font-bold bg-rose-500/5 px-2 py-1 rounded-full">- Infra</div>
          </div>
        </div>

        {/* Gráfico de Barras */}
        <div className="bg-card border rounded-3xl p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">Comparativo Mensal</h3>
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
                <Bar dataKey="entradas" fill="var(--color-owerplay-cyan)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="var(--color-destructive)" radius={[4, 4, 0, 0]} />
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
              (() => {
                const grouped = stats?.recentTransactions.reduce((acc: any, t) => {
                  const key = t.cliente_id || `other-${t.id}`;
                  if (!acc[key]) acc[key] = { items: [], date: t.data, cliente: t.clientes?.nome || "Geral" };
                  acc[key].items.push(t);
                  return acc;
                }, {});

                return Object.entries(grouped || {}).map(([key, group]: [string, any]) => {
                  const items = group.items;
                  const entrada = items.find((i: any) => i.tipo === 'entrada')?.valor || 0;
                  const saida = items.filter((i: any) => i.tipo === 'saida').reduce((acc: number, i: any) => acc + Number(i.valor), 0);
                  const lucro = entrada - saida;
                  const ids = items.map((i: any) => i.id);

                  return (
                    <div key={key} className="bg-card border rounded-2xl p-4 flex flex-col gap-3 relative">
                      <div className="absolute top-4 right-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                              disabled={ids.some(id => isDeleting === id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta transação? Isso removerá tanto a entrada quanto os custos associados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={async () => {
                                  for (const id of ids as string[]) {
                                    await handleDeleteTransaction(id);
                                  }
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
                        <span className="text-sm font-bold pr-8">Renovação - {group.cliente}</span>
                        <span className="text-[10px] text-muted-foreground">{group.date ? format(parseISO(group.date), "dd/MM/yyyy") : "?"}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Entrada</span>
                          <span className="text-emerald-500 font-bold text-sm">{formatBRL(entrada)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Custo</span>
                          <span className="text-rose-500 font-bold text-sm">{formatBRL(saida)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col pt-2 border-t">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Lucro Líquido</span>
                        <span className="text-owerplay-cyan font-black text-lg">{formatBRL(lucro)}</span>
                      </div>
                    </div>
                  );
                });
              })()
            )}

          </div>
        </div>
      </section>

    </div>
  );
}
