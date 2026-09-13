import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronDown, Download, ArrowDownRight, ArrowUpRight, WalletCards, ReceiptText } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/financeiro")({ component: FinanceiroHistory });
type SelectedMonth = { label: string; value: string; date: Date };

function pdfSafe(value: unknown) {
  return String(value ?? "").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").split("").map((char) => (char.charCodeAt(0) <= 255 ? char : "?")).join("").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function truncatePdfText(value: string, max = 34) { return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3))}...`; }
function buildFinancialPdf(monthLabel: string, transactions: any[], stats: { entradas: number; saidas: number; lucro: number }, formatBRL: (value: number) => string) {
  const pageWidth = 595, pageHeight = 842, margin = 40, rowsPerPage = 22;
  const pages = Math.max(1, Math.ceil(transactions.length / rowsPerPage));
  const pageStreams: string[] = [];
  const text = (x:number,y:number,size:number,value:string,bold=false,color="0.12 0.16 0.24") => `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x} ${y} Td (${pdfSafe(value)}) Tj ET\n`;
  const rect = (x:number,y:number,w:number,h:number,fill:string) => `${fill} rg ${x} ${y} ${w} ${h} re f\n`;
  const line = (x1:number,y1:number,x2:number,y2:number,stroke="0.88 0.90 0.94") => `${stroke} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
  for (let pageIndex=0; pageIndex<pages; pageIndex++) {
    let stream="";
    stream+=rect(0,pageHeight-126,pageWidth,126,"0.055 0.18 0.42");
    stream+=text(margin,786,11,"OWERPLAY GESTOR",true,"1 1 1");
    stream+=text(margin,758,24,"Historico Financeiro",true,"1 1 1");
    stream+=text(margin,737,11,monthLabel,false,"0.78 0.86 1");
    stream+=text(pageWidth-115,787,9,`Pagina ${pageIndex+1}/${pages}`,false,"0.78 0.86 1");
    if(pageIndex===0){
      const cardY=646,cardW=162,gap=14;
      [{label:"FATURAMENTO",value:formatBRL(stats.entradas),accent:"0.12 0.42 0.90"},{label:"CUSTOS",value:formatBRL(stats.saidas),accent:"0.86 0.16 0.22"},{label:"LUCRO LIQUIDO",value:formatBRL(stats.lucro),accent:"0.06 0.58 0.34"}].forEach((card,index)=>{const x=margin+index*(cardW+gap);stream+=rect(x,cardY,cardW,72,"0.97 0.98 1");stream+=rect(x,cardY+68,cardW,4,card.accent);stream+=text(x+12,cardY+47,8,card.label,true,card.accent);stream+=text(x+12,cardY+20,15,card.value,true);});
    }
    const tableTop=pageIndex===0?614:684; stream+=text(margin,tableTop,12,"Movimentacoes do periodo",true); stream+=text(pageWidth-160,tableTop,8,`${transactions.length} registros`,false,"0.42 0.46 0.54");
    const headerY=tableTop-30; stream+=rect(margin,headerY,pageWidth-margin*2,24,"0.94 0.96 0.99");
    stream+=text(margin+8,headerY+8,8,"DATA",true,"0.35 0.40 0.50");stream+=text(margin+75,headerY+8,8,"CLIENTE / DESCRICAO",true,"0.35 0.40 0.50");stream+=text(margin+287,headerY+8,8,"TIPO",true,"0.35 0.40 0.50");stream+=text(margin+350,headerY+8,8,"ENTRADA",true,"0.35 0.40 0.50");stream+=text(margin+430,headerY+8,8,"CUSTO",true,"0.35 0.40 0.50");
    const pageRows=transactions.slice(pageIndex*rowsPerPage,(pageIndex+1)*rowsPerPage); let rowY=headerY-25;
    if(!pageRows.length) stream+=text(margin+8,rowY-2,10,"Nenhuma movimentacao registrada neste periodo.",false,"0.42 0.46 0.54");
    else pageRows.forEach((transaction,index)=>{if(index%2===1)stream+=rect(margin,rowY-7,pageWidth-margin*2,23,"0.985 0.99 1");const entrada=Number(transaction.entrada||0),custo=Number(transaction.custo||0);const description=truncatePdfText(String(transaction.cliente_nome||transaction.nome||transaction.descricao||"Movimentacao"),35);const date=transaction.created_at?format(parseISO(transaction.created_at),"dd/MM/yyyy"):"-";const type=entrada>0?"Entrada":"Saida";stream+=text(margin+8,rowY,8.5,date);stream+=text(margin+75,rowY,8.5,description);stream+=text(margin+287,rowY,8.5,type,true,entrada>0?"0.06 0.58 0.34":"0.86 0.16 0.22");stream+=text(margin+350,rowY,8.5,entrada>0?formatBRL(entrada):"-",true);stream+=text(margin+430,rowY,8.5,custo>0?formatBRL(custo):"-",false,"0.50 0.28 0.30");stream+=line(margin,rowY-8,pageWidth-margin,rowY-8);rowY-=25;});
    stream+=line(margin,48,pageWidth-margin,48);stream+=text(margin,30,7.5,"Relatorio gerado pelo Owerplay Gestor",false,"0.48 0.52 0.60");stream+=text(pageWidth-167,30,7.5,format(new Date(),"dd/MM/yyyy HH:mm"),false,"0.48 0.52 0.60");pageStreams.push(stream);
  }
  const objects:string[]=[];const addObject=(body:string)=>{objects.push(body);return objects.length;};const catalogId=addObject(""),pagesId=addObject("");const fontRegularId=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");const fontBoldId=addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");const pageIds:number[]=[];
  pageStreams.forEach((stream)=>{const contentId=addObject(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);pageIds.push(addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`));});
  objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf="%PDF-1.4\n%âãÏÓ\n";const offsets=[0];objects.forEach((object,index)=>{offsets[index+1]=pdf.length;pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xrefOffset=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)pdf+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&0xff;return new Blob([bytes],{type:"application/pdf"});
}

function FinanceiroHistory() {
  const nowBr=toZonedTime(new Date(),"America/Sao_Paulo");
  const pastMonths=useMemo(()=>{const months:SelectedMonth[]=[];for(let i=1;i<=12;i++){const date=subMonths(nowBr,i);months.push({label:format(date,"MMMM / yyyy",{locale:ptBR}).replace(/^\w/,(c)=>c.toUpperCase()),value:format(date,"yyyy-MM"),date});}return months;},[nowBr]);
  const [selectedMonth,setSelectedMonth]=useState<SelectedMonth>(pastMonths[0]!);
  const {data:transactions=[]}=useQuery({queryKey:["financeiro-history",selectedMonth.value],queryFn:async()=>{const start=startOfMonth(selectedMonth.date),end=endOfMonth(selectedMonth.date);const {data,error}=await supabase.from("transacoes").select("*").gte("created_at",start.toISOString()).lte("created_at",end.toISOString()).order("created_at",{ascending:false});if(error)throw error;const rows=(data||[]) as any[];const clientIds=[...new Set(rows.map((row)=>row.cliente_id).filter(Boolean))] as string[];if(!clientIds.length)return rows;const {data:clients,error:clientsError}=await supabase.from("clientes").select("id, nome").in("id",clientIds);if(clientsError)throw clientsError;const clientNames=new Map((clients||[]).map((client:any)=>[client.id,client.nome]));return rows.map((row)=>({...row,cliente_nome:row.cliente_id?clientNames.get(row.cliente_id):undefined}));}});
  const stats=useMemo(()=>{const entradas=transactions.reduce((acc:number,t:any)=>acc+Number(t.entrada||0),0),saidas=transactions.reduce((acc:number,t:any)=>acc+Number(t.custo||0),0);return{entradas,saidas,lucro:entradas-saidas};},[transactions]);
  const formatBRL=(val:number)=>val.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const exportToPDF=()=>{if(!transactions.length)return;const blob=buildFinancialPdf(selectedMonth.label,transactions,stats,formatBRL),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`historico_financeiro_${selectedMonth.value}.pdf`;document.body.appendChild(link);link.click();document.body.removeChild(link);window.setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const latest=transactions.slice(0,8);

  return <div className="w-full max-w-7xl p-4 pb-12 md:p-8">
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-2xl font-black tracking-tight text-foreground">Financeiro</h1></div>
      <div className="flex items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="min-w-[176px] justify-between gap-2 rounded-xl bg-card font-semibold"><Calendar size={16} className="text-primary"/><span>{selectedMonth.label}</span><ChevronDown size={15} className="text-muted-foreground"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-[200px] rounded-xl">{pastMonths.map((month)=><DropdownMenuItem key={month.value} onClick={()=>setSelectedMonth(month)} className="cursor-pointer font-medium">{month.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><Button variant="outline" size="icon" className="rounded-xl bg-card" onClick={exportToPDF} disabled={!transactions.length} title="Exportar PDF"><Download size={17}/></Button></div>
    </div>

    <section>
      <div className="relative overflow-hidden rounded-[28px] border border-primary/20 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl shadow-primary/10 md:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/15 blur-2xl"/><div className="relative"><div className="mb-8 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">Resultado do período</span><span className="rounded-xl bg-white/10 p-2.5"><WalletCards size={19}/></span></div><div className="text-4xl font-black tracking-[-.04em] md:text-5xl">{formatBRL(stats.lucro)}</div><div className="mt-5 flex flex-wrap gap-5 text-sm"><span className="flex items-center gap-2 text-emerald-300"><ArrowUpRight size={16}/><b>{formatBRL(stats.entradas)}</b> entradas</span><span className="flex items-center gap-2 text-rose-300"><ArrowDownRight size={16}/><b>{formatBRL(stats.saidas)}</b> custos</span></div></div>
      </div>
    </section>

    <section className="mt-4 overflow-hidden rounded-[24px] border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-black tracking-tight">Movimentações</h2><p className="text-xs text-muted-foreground">{transactions.length} no período</p></div><ReceiptText size={18} className="text-muted-foreground"/></div>
      <div className="divide-y">{latest.length?latest.map((t:any)=>{const entrada=Number(t.entrada||0),custo=Number(t.custo||0);const positive=entrada>0;const value=positive?entrada:custo;return <div key={t.id} className="flex items-center gap-3 px-5 py-3.5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive?'bg-emerald-500/10 text-emerald-600':'bg-rose-500/10 text-rose-500'}`}>{positive?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.cliente_nome||t.nome||t.descricao||'Movimentação'}</p><p className="text-[11px] text-muted-foreground">{t.created_at?format(parseISO(t.created_at),'dd/MM/yyyy'):'-'}</p></div><p className={`shrink-0 text-sm font-black ${positive?'text-emerald-600':'text-rose-500'}`}>{positive?'+':'-'} {formatBRL(value)}</p></div>;}):<div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação neste período.</div>}</div>
    </section>
  </div>;
}
