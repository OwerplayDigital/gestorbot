import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Download, 
  ChevronDown, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Users,
  PieChart,
  Activity
} from "lucide-react";
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  subMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
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

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroHistory,
});

interface SelectedMonth {
  label: string;
  value: string;
  date: Date;
}

function FinanceiroHistory() {
  const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
  
  const pastMonths = useMemo(() => {
    const months: SelectedMonth[] = [];
    for (let i = 1; i <= 12; i++) {
      const date = subMonths(nowBr, i);
      months.push({
        label: format(date, "MMMM / yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
        value: format(date, "yyyy-MM"),
        date: date
      });
    }
    return months;
  }, [nowBr]);

  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(pastMonths[0]!);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["financeiro-history", selectedMonth.value],
    queryFn: async () => {
      const start = startOfMonth(selectedMonth.date);
      const end = endOfMonth(selectedMonth.date);
      
      const { data, error } = await supabase
        .from("transacoes")
        .select(`
          *,
          clientes(
            nome,
            servidores_iptv(name)
          ),
          servidores_iptv(name)
        `)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const stats = useMemo(() => {
    const entradas = transactions.reduce((acc, t) => acc + Number(t.entrada || 0), 0);
    const saidas = transactions.reduce((acc, t) => acc + Number(t.custo || 0), 0);
    const lucro = entradas - saidas;
    return { entradas, saidas, lucro };
  }, [transactions]);

  const serverStats = useMemo(() => {
    const serverMap: Record<string, { name: string, clients: Set<string>, receita: number, custo: number }> = {};
    
    transactions.forEach(t => {
      // 1. Tentar pegar o servidor diretamente da transação (serv_id)
      // 2. Senão, tentar pegar o servidor ATUAL do cliente (via join clientes)
      // 3. Senão, usar 'Painel/Sistema'
      
      let serverId = t.serv_id;
      let serverName = t.servidores_iptv?.name;

      if (!serverId && t.clientes) {
        // Se a transação não tem serv_id, mas tem cliente, tenta pegar o servidor do cliente
        const clientServers = t.clientes.servidores_iptv;
        if (clientServers) {
          // Se for um objeto único ou o primeiro de uma lista (dependendo do schema servidores_ids)
          const srv = Array.isArray(clientServers) ? clientServers[0] : clientServers;
          if (srv) {
            serverId = srv.id || 'painel';
            serverName = srv.name;
          }
        }
      }

      if (!serverId) {
        serverId = 'painel';
        serverName = 'Painel/Sistema';
      }
      
      if (!serverMap[serverId]) {
        serverMap[serverId] = { name: serverName, clients: new Set(), receita: 0, custo: 0 };
      }
      
      if (t.cliente_id) serverMap[serverId].clients.add(t.cliente_id);
      serverMap[serverId].receita += Number(t.entrada || 0);
      serverMap[serverId].custo += Number(t.custo || 0);
    });

    return Object.values(serverMap).sort((a, b) => b.receita - a.receita);
  }, [transactions]);

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = ["Data", "Cliente/Descrição", "Servidor", "Tipo", "Entrada", "Saída", "Lucro"];
    const rows = transactions.map((t: any) => [
      t.created_at ? format(parseISO(t.created_at), "dd/MM/yyyy HH:mm") : "N/A",
      t.clientes?.nome || t.descricao || "N/A",
      t.servidores_iptv?.name || "Painel",
      (t.entrada || 0) > 0 ? "Entrada" : "Saída",
      t.entrada || 0,
      t.custo || 0,
      t.lucro_liquido || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_${selectedMonth.value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 pb-12 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-foreground uppercase">Histórico Financeiro</h1>
          <p className="text-sm text-muted-foreground font-medium">Consulte transações e balanços de períodos anteriores.</p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl border-border bg-card shadow-sm gap-2 font-bold min-w-[180px]">
                <Calendar size={16} className="text-primary" />
                {selectedMonth.label}
                <ChevronDown size={16} className="text-muted-foreground ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-xl">
              {pastMonths.map((m) => (
                <DropdownMenuItem 
                  key={m.value}
                  onClick={() => setSelectedMonth(m)}
                  className="font-medium cursor-pointer"
                >
                  {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-xl border-border bg-card shadow-sm"
            onClick={exportToCSV}
            disabled={transactions.length === 0}
          >
            <Download size={18} />
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-lg">Faturamento</span>
              <TrendingUp size={16} className="text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatBRL(stats.entradas)}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total bruto no período</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-lg">Custos</span>
              <TrendingDown size={16} className="text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatBRL(stats.saidas)}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Total de saídas/servidores</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-600/10 px-2 py-0.5 rounded-lg">Lucro Líquido</span>
              <DollarSign size={16} className="text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{formatBRL(stats.lucro)}</div>
            <p className="text-[10px] text-muted-foreground font-bold mt-1">Resultado final limpo</p>
          </CardContent>
        </Card>
      </section>

      {/* Gráfico e Resumo por Servidor */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <Activity className="text-primary" size={18} />
              <CardTitle className="text-sm font-black uppercase tracking-tighter">Comparativo de Servidores</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              {serverStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={serverStats}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 10, fontWeight: 900 }}
                      width={80}
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: '1px solid hsl(var(--border))',
                        backgroundColor: 'hsl(var(--card))',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      formatter={(value: number) => [formatBRL(value), 'Receita']}
                    />
                    <Bar dataKey="receita" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {serverStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - (index * 0.15)})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-medium italic">
                  Sem dados para exibir
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <PieChart className="text-primary" size={18} />
              <CardTitle className="text-sm font-black uppercase tracking-tighter">Performance por Servidor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {serverStats.length > 0 ? (
                serverStats.map((srv, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-tight text-foreground">{srv.name}</div>
                        <div className="text-[9px] font-bold text-muted-foreground">{srv.clients.size} Clientes ativos</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-foreground">{formatBRL(srv.receita)}</div>
                      <div className="text-[9px] font-bold text-rose-500">Custo: {formatBRL(srv.custo)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground font-medium">Nenhum servidor registrado este mês.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

