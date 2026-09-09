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
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroHistory,
});

interface SelectedMonth {
  label: string;
  value: string;
  date: Date;
}

function FinanceiroHistory() {
  const nowBr = toZonedTime(new Date(), "America/Sao_Paulo");

  const pastMonths = useMemo(() => {
    const months: SelectedMonth[] = [];
    for (let i = 1; i <= 12; i++) {
      const date = subMonths(nowBr, i);
      months.push({
        label: format(date, "MMMM / yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
        value: format(date, "yyyy-MM"),
        date,
      });
    }
    return months;
  }, [nowBr]);

  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(pastMonths[0]!);

  const { data: transactions = [] } = useQuery({
    queryKey: ["financeiro-history", selectedMonth.value],
    queryFn: async () => {
      const start = startOfMonth(selectedMonth.date);
      const end = endOfMonth(selectedMonth.date);

      const { data, error } = await supabase
        .from("transacoes")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const stats = useMemo(() => {
    const entradas = transactions.reduce((acc: number, t: any) => acc + Number(t.entrada || 0), 0);
    const saidas = transactions.reduce((acc: number, t: any) => acc + Number(t.custo || 0), 0);
    const lucro = entradas - saidas;
    return { entradas, saidas, lucro };
  }, [transactions]);

  const formatBRL = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
      t.lucro_liquido || 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row: any) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_${selectedMonth.value}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex w-full max-w-7xl flex-col gap-8 p-4 pb-12 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">Histórico Financeiro</h1>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[180px] gap-2 rounded-xl border-border bg-card font-bold shadow-sm">
                <Calendar size={16} className="text-primary" />
                {selectedMonth.label}
                <ChevronDown size={16} className="ml-auto text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-xl">
              {pastMonths.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setSelectedMonth(m)}
                  className="cursor-pointer font-medium"
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

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">Faturamento</span>
              <TrendingUp size={16} className="text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatBRL(stats.entradas)}</div>
            <p className="mt-1 text-[10px] font-bold text-muted-foreground">Total bruto no período</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-rose-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-500">Custos</span>
              <TrendingDown size={16} className="text-rose-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatBRL(stats.saidas)}</div>
            <p className="mt-1 text-[10px] font-bold text-muted-foreground">Total de saídas/servidores</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-emerald-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">Lucro Líquido</span>
              <DollarSign size={16} className="text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{formatBRL(stats.lucro)}</div>
            <p className="mt-1 text-[10px] font-bold text-muted-foreground">Resultado final limpo</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
