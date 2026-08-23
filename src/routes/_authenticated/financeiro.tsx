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
          clientes(nome),
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
      const serverId = t.serv_id || 'painel';
      const serverName = t.servidores_iptv?.name || 'Painel/Sistema';
      
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
    if (filteredTransactions.length === 0) return;

    const headers = ["Data", "Cliente/Descrição", "Servidor", "Tipo", "Entrada", "Saída", "Lucro"];
    const rows = filteredTransactions.map(t => [
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
      ...rows.map(row => row.join(","))
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
            disabled={filteredTransactions.length === 0}
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

      {/* Tabela de Extrato */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input 
              placeholder="Buscar por cliente ou servidor..." 
              className="pl-10 rounded-xl border-border bg-card shadow-sm h-10 font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Badge variant="secondary" className="h-10 px-4 rounded-xl border-border bg-card shadow-sm text-xs font-bold gap-2">
            <Filter size={14} className="text-muted-foreground" />
            {filteredTransactions.length} Transações
          </Badge>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border/50">
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Data</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cliente / Descrição</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Servidor</th>
                  <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-8 bg-muted/10"></td>
                    </tr>
                  ))
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-foreground">{t.created_at ? format(parseISO(t.created_at), "dd/MM/yyyy") : "N/A"}</span>
                          <span className="text-[10px] text-muted-foreground font-bold">{t.created_at ? format(parseISO(t.created_at), "HH:mm") : "N/A"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-black text-foreground uppercase tracking-tight">
                          {t.clientes?.nome || t.descricao || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="rounded-lg text-[10px] font-bold border-border bg-muted/20">
                          {t.servidores_iptv?.name || "Painel"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`text-sm font-black ${(t.entrada || 0) > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {(t.entrada || 0) > 0 ? `+ ${formatBRL(t.entrada || 0)}` : `- ${formatBRL(t.custo || 0)}`}
                          </span>
                          {(t.lucro_liquido || 0) > 0 && (t.entrada || 0) > 0 && (
                            <span className="text-[9px] font-black text-emerald-600/60">Lucro: {formatBRL(t.lucro_liquido || 0)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground font-medium">
                      Nenhuma transação encontrada para este período ou filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

