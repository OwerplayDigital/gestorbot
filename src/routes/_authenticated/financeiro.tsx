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

function pdfSafe(value: unknown) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .split("")
    .map((char) => (char.charCodeAt(0) <= 255 ? char : "?"))
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function truncatePdfText(value: string, max = 34) {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`;
}

function buildFinancialPdf(
  monthLabel: string,
  transactions: any[],
  stats: { entradas: number; saidas: number; lucro: number },
  formatBRL: (value: number) => string,
) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const rowsPerPage = 22;
  const pages = Math.max(1, Math.ceil(transactions.length / rowsPerPage));
  const pageStreams: string[] = [];

  const text = (x: number, y: number, size: number, value: string, bold = false, color = "0.12 0.16 0.24") =>
    `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${pdfSafe(value)}) Tj ET\n`;
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    `${fill} rg ${x} ${y} ${w} ${h} re f\n`;
  const line = (x1: number, y1: number, x2: number, y2: number, stroke = "0.88 0.90 0.94") =>
    `${stroke} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S\n`;

  for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
    let stream = "";
    stream += rect(0, pageHeight - 126, pageWidth, 126, "0.055 0.18 0.42");
    stream += text(margin, 786, 11, "OWERPLAY GESTOR", true, "1 1 1");
    stream += text(margin, 758, 24, "Historico Financeiro", true, "1 1 1");
    stream += text(margin, 737, 11, monthLabel, false, "0.78 0.86 1");
    stream += text(pageWidth - 115, 787, 9, `Pagina ${pageIndex + 1}/${pages}`, false, "0.78 0.86 1");

    if (pageIndex === 0) {
      const cardY = 646;
      const cardW = 162;
      const gap = 14;
      const cards = [
        { label: "FATURAMENTO", value: formatBRL(stats.entradas), accent: "0.12 0.42 0.90" },
        { label: "CUSTOS", value: formatBRL(stats.saidas), accent: "0.86 0.16 0.22" },
        { label: "LUCRO LIQUIDO", value: formatBRL(stats.lucro), accent: "0.06 0.58 0.34" },
      ];

      cards.forEach((card, index) => {
        const x = margin + index * (cardW + gap);
        stream += rect(x, cardY, cardW, 72, "0.97 0.98 1");
        stream += rect(x, cardY + 68, cardW, 4, card.accent);
        stream += text(x + 12, cardY + 47, 8, card.label, true, card.accent);
        stream += text(x + 12, cardY + 20, 15, card.value, true);
      });
    }

    const tableTop = pageIndex === 0 ? 614 : 684;
    stream += text(margin, tableTop, 12, "Movimentacoes do periodo", true);
    stream += text(pageWidth - 160, tableTop, 8, `${transactions.length} registros`, false, "0.42 0.46 0.54");

    const headerY = tableTop - 30;
    stream += rect(margin, headerY, pageWidth - margin * 2, 24, "0.94 0.96 0.99");
    stream += text(margin + 8, headerY + 8, 8, "DATA", true, "0.35 0.40 0.50");
    stream += text(margin + 75, headerY + 8, 8, "DESCRICAO", true, "0.35 0.40 0.50");
    stream += text(margin + 287, headerY + 8, 8, "TIPO", true, "0.35 0.40 0.50");
    stream += text(margin + 350, headerY + 8, 8, "ENTRADA", true, "0.35 0.40 0.50");
    stream += text(margin + 430, headerY + 8, 8, "CUSTO", true, "0.35 0.40 0.50");

    const pageRows = transactions.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    let rowY = headerY - 25;

    if (pageRows.length === 0) {
      stream += text(margin + 8, rowY - 2, 10, "Nenhuma movimentacao registrada neste periodo.", false, "0.42 0.46 0.54");
    } else {
      pageRows.forEach((transaction, index) => {
        if (index % 2 === 1) stream += rect(margin, rowY - 7, pageWidth - margin * 2, 23, "0.985 0.99 1");

        const entrada = Number(transaction.entrada || 0);
        const custo = Number(transaction.custo || 0);
        const description = truncatePdfText(
          String(transaction.descricao || transaction.nome || transaction.cliente_nome || "Movimentacao"),
          35,
        );
        const date = transaction.created_at ? format(parseISO(transaction.created_at), "dd/MM/yyyy") : "-";
        const type = entrada > 0 ? "Entrada" : "Saida";

        stream += text(margin + 8, rowY, 8.5, date);
        stream += text(margin + 75, rowY, 8.5, description);
        stream += text(margin + 287, rowY, 8.5, type, true, entrada > 0 ? "0.06 0.58 0.34" : "0.86 0.16 0.22");
        stream += text(margin + 350, rowY, 8.5, entrada > 0 ? formatBRL(entrada) : "-", true);
        stream += text(margin + 430, rowY, 8.5, custo > 0 ? formatBRL(custo) : "-", false, "0.50 0.28 0.30");
        stream += line(margin, rowY - 8, pageWidth - margin, rowY - 8);
        rowY -= 25;
      });
    }

    stream += line(margin, 48, pageWidth - margin, 48);
    stream += text(margin, 30, 7.5, "Relatorio gerado pelo Owerplay Gestor", false, "0.48 0.52 0.60");
    stream += text(pageWidth - 167, 30, 7.5, format(new Date(), "dd/MM/yyyy HH:mm"), false, "0.48 0.52 0.60");
    pageStreams.push(stream);
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];

  pageStreams.forEach((stream) => {
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
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

  const exportToPDF = () => {
    if (transactions.length === 0) return;

    const blob = buildFinancialPdf(selectedMonth.label, transactions, stats, formatBRL);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico_financeiro_${selectedMonth.value}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            title="Baixar relatório em PDF"
            aria-label="Baixar relatório em PDF"
            className="rounded-xl border-border bg-card shadow-sm"
            onClick={exportToPDF}
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
