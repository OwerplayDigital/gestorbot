import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Calendar, ChevronDown, ReceiptText } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/movimentacoes")({ component: MovimentacoesPage });
type SelectedMonth = { label: string; value: string; date: Date };

function MovimentacoesPage() {
  const nowBr = toZonedTime(new Date(), "America/Sao_Paulo");
  const months = useMemo(() => {
    const items: SelectedMonth[] = [];
    for (let i = 1; i <= 12; i++) {
      const date = subMonths(nowBr, i);
      items.push({ label: format(date, "MMMM / yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()), value: format(date, "yyyy-MM"), date });
    }
    return items;
  }, [nowBr]);
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth>(months[0]!);
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["movimentacoes", selectedMonth.value],
    queryFn: async () => {
      const start = startOfMonth(selectedMonth.date), end = endOfMonth(selectedMonth.date);
      const { data, error } = await supabase.from("transacoes").select("*").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const clientIds = [...new Set(rows.map((row) => row.cliente_id).filter(Boolean))] as string[];
      if (!clientIds.length) return rows;
      const { data: clients, error: clientsError } = await supabase.from("clientes").select("id, nome").in("id", clientIds);
      if (clientsError) throw clientsError;
      const names = new Map((clients || []).map((client: any) => [client.id, client.nome]));
      return rows.map((row) => ({ ...row, cliente_nome: row.cliente_id ? names.get(row.cliente_id) : undefined }));
    },
  });
  const formatBRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return <div className="mx-auto w-full max-w-6xl p-4 pb-12 md:p-8">
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <h1 className="text-2xl font-black tracking-tight">Movimentações</h1>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="min-w-[176px] justify-between gap-2 rounded-xl bg-card font-semibold"><Calendar size={16} className="text-primary" /><span>{selectedMonth.label}</span><ChevronDown size={15} className="text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[200px] rounded-xl">{months.map((month) => <DropdownMenuItem key={month.value} onClick={() => setSelectedMonth(month)} className="cursor-pointer font-medium">{month.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
    </div>
    <section className="overflow-hidden rounded-[24px] border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-black tracking-tight">Histórico</h2><p className="text-xs text-muted-foreground">{transactions.length} no período</p></div><ReceiptText size={18} className="text-muted-foreground" /></div>
      <div className="divide-y">{isLoading ? <div className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando...</div> : transactions.length ? transactions.map((t: any) => {
        const entrada = Number(t.entrada || 0), custo = Number(t.custo || 0), positive = entrada > 0, value = positive ? entrada : custo;
        return <div key={t.id} className="flex items-center gap-3 px-5 py-3.5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"}`}>{positive ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.cliente_nome || t.nome || t.descricao || "Movimentação"}</p><p className="text-[11px] text-muted-foreground">{t.created_at ? format(parseISO(t.created_at), "dd/MM/yyyy") : "-"}</p></div><p className={`shrink-0 text-sm font-black ${positive ? "text-emerald-600" : "text-rose-500"}`}>{positive ? "+" : "-"} {formatBRL(value)}</p></div>;
      }) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação neste período.</div>}</div>
    </section>
  </div>;
}
