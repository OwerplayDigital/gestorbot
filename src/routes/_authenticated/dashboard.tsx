import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Activity, Eye, EyeOff, ReceiptText, RotateCw, Minus, Plus, MessageCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime, format as formatTz } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { BOT_TEMPLATES } from "@/lib/templates";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ServerBadge } from "@/components/ServerBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type DashboardStats = {
  totalClients:number; activeClients:number; totalVencidos:number; expiringTodayCount:number; entradas:number; saidas:number; lucro:number;
  expiringToday:any[]; vencidos:any[]; chartData:any[]; recentTransactions:any[]; previousPeriodLucro:number; previousPeriodEntradas:number; transactionsCount:number; serverStats:any[];
};

const parseDate=(d:any):Date|null=>{if(!d||typeof d!=="string")return null;const p=d.split(/[/-]/);if(p.length!==3)return null;const nums=p.map(Number) as number[];const a=nums[0]!,b=nums[1]!,c=nums[2]!;let r=d.includes("/")||(d.includes("-")&&(p[0]??"").length===2)?new Date(c,b-1,a):d.includes("-")&&(p[0]??"").length===4?new Date(a,b-1,c):null;if(r&&!isNaN(r.getTime())){r.setHours(0,0,0,0);return r}return null};

function addDaysISO(iso:string,days:number){const [y,m,d]=iso.split("-").map(Number) as [number,number,number];const dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()+days);return dt.toISOString().slice(0,10)}

function Dashboard(){
 const [showLucro,setShowLucro]=useState(true);
 const [activeTab,setActiveTab]=useState("mes");
 const [selectedClient,setSelectedClient]=useState<any>(null);
 const [isRenewOpen,setIsRenewOpen]=useState(false);
 const [isRenewSuccessOpen,setIsRenewSuccessOpen]=useState(false);
 const [renewDate,setRenewDate]=useState("");
 const [isRenewing,setIsRenewing]=useState(false);
 const nowBr=toZonedTime(new Date(),"America/Sao_Paulo");
 const currentMonthLabel=formatTz(nowBr,"MMMM/yy",{locale:ptBR}).replace(/^\w/,c=>c.toUpperCase());
 const {data:stats,isLoading,refetch}=useQuery<DashboardStats>({queryKey:["dashboard-stats-modern",activeTab],staleTime:300000,queryFn:async()=>{
  const now=toZonedTime(new Date(),"America/Sao_Paulo"),todayStr=formatTz(now,"yyyy-MM-dd"),currentMonth=formatTz(now,"MM"),currentYear=formatTz(now,"yyyy");
  const [clientsRes,transactionsRes,serversRes]=await Promise.all([
   supabase.from("clientes").select("id, nome, whatsapp, vencimento, valor, status, servidores_ids, plano_id, desconto"),
   supabase.from("transacoes").select("*, clientes(nome, servidores_ids), servidores_iptv(name)").order("created_at",{ascending:false}),
   supabase.from("servidores_iptv").select("id, name, valor")
  ]);
  const clients=clientsRes.data??[],transactions=transactionsRes.data??[],servers=serversRes.data??[];
  const vencidos=clients.filter((c:any)=>{const d=parseDate(c.vencimento);return d&&d<now}).sort((a:any,b:any)=>(parseDate(a.vencimento)?.getTime()||0)-(parseDate(b.vencimento)?.getTime()||0));
  const expiringToday=clients.filter((c:any)=>{const d=parseDate(c.vencimento);return d&&formatTz(d,"yyyy-MM-dd")===todayStr});
  const filteredTransactions=transactions.filter(t=>{if(!t.data)return false;const d=parseISO(t.data);if(activeTab==="hoje")return format(d,"yyyy-MM-dd")===todayStr;if(activeTab==="mes")return format(d,"MM")===currentMonth&&format(d,"yyyy")==currentYear;if(activeTab==="ano")return format(d,"yyyy")==currentYear;return true});
  const previousTransactions=transactions.filter(t=>{if(!t.data)return false;const d=parseISO(t.data);if(activeTab==="hoje"){const y=new Date(now);y.setDate(y.getDate()-1);return format(d,"yyyy-MM-dd")===formatTz(y,"yyyy-MM-dd")}if(activeTab==="mes"){const lm=new Date(now);lm.setMonth(lm.getMonth()-1);return format(d,"MM")==format(lm,"MM")&&format(d,"yyyy")==format(lm,"yyyy")}if(activeTab==="ano")return format(d,"yyyy")==String(Number(currentYear)-1);return false});
  const entradas=filteredTransactions.reduce((a,t)=>a+Number(t.entrada??0),0),saidas=filteredTransactions.reduce((a,t)=>a+Number(t.custo??0),0),lucro=filteredTransactions.reduce((a,t)=>a+Number(t.lucro_liquido??0),0);
  const previousPeriodLucro=previousTransactions.reduce((a,t)=>a+Number(t.lucro_liquido??0),0),previousPeriodEntradas=previousTransactions.reduce((a,t)=>a+Number(t.entrada??0),0);
  const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"],lastFour=[];for(let i=3;i>=0;i--){let m=now.getMonth()-i,y=now.getFullYear();if(m<0){m+=12;y--}lastFour.push({mIdx:m,y,label:months[m]})}
  const chartData=lastFour.map(({mIdx,y,label})=>{const mt=transactions.filter(t=>{if(!t.data)return false;const d=parseISO(t.data);return d.getFullYear()===y&&d.getMonth()===mIdx});const ent=mt.reduce((a,b)=>a+Number(b.entrada??0),0),sai=mt.reduce((a,b)=>a+Number(b.custo??0),0);return{name:label,entradas:ent,saidas:sai,lucro:ent-sai}});
  const recentTransactions=filteredTransactions.map((t:any)=>({...t,resolvedServerName:(t.clientes?.servidores_ids||[]).map((id:string)=>servers.find(s=>s.id===id)?.name).filter(Boolean).join(", ")||t.servidores_iptv?.name||"Painel"}));
  const expiringWithServers=expiringToday.map((c:any)=>({...c,valorFinal:Number(c.valor??0),serverName:(c.servidores_ids||[]).map((id:string)=>servers.find(s=>s.id===id)?.name).filter(Boolean).join(", ")||"Painel"}));
  const active=clients.filter((c:any)=>c.status==="ativo"),serverMap=new Map();active.forEach((c:any)=>{const id=c.servidores_ids?.[0],s=servers.find(x=>x.id===id);if(!s||s.name==="Painel")return;const cur=serverMap.get(s.name)||{name:s.name,count:0,faturamento:0,custo:0,lucro:0,clientIds:new Set()};cur.clientIds.add(c.id);cur.count=cur.clientIds.size;cur.faturamento+=Number(c.valor??0);cur.custo+=Number(s.valor??0);cur.lucro=cur.faturamento-cur.custo;serverMap.set(s.name,cur)});
  return {totalClients:clients.length,activeClients:clients.filter((c:any)=>c.status==="ativo").length,totalVencidos:vencidos.length,expiringTodayCount:expiringToday.length,entradas,saidas,lucro,expiringToday:expiringWithServers,vencidos:vencidos.map(c=>({id:c.id,nome:c.nome,status:c.status,valor:c.valor,vencimento:c.vencimento})),chartData,recentTransactions,previousPeriodLucro,previousPeriodEntradas,transactionsCount:filteredTransactions.length,serverStats:Array.from(serverMap.values()).sort((a,b)=>b.faturamento-a.faturamento)};
 }});

 const formatBRL=(v:any)=>Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const pct=(cur:number,prev:number)=>prev?((cur-prev)/Math.abs(prev)*100):null;

 function chargeClient(client:any){
  if(!client.whatsapp){toast.error("Cliente sem WhatsApp cadastrado.");return}
  const firstName=(client.nome||"Cliente").trim().split(" ")[0]||"Cliente";
  const brDate=client.vencimento?format(parseISO(client.vencimento),"dd/MM/yyyy"):"";
  const paymentUrl=`https://gestorbot.lovable.app/pagar/${client.id}`;
  const message=BOT_TEMPLATES.COBRANCA(firstName,brDate,paymentUrl);
  const raw=String(client.whatsapp).replace(/\D/g,"");
  const phone=raw.startsWith("55")?raw:`55${raw}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank");
 }

 function openRenew(client:any){
  const current=String(client.vencimento||"").slice(0,10);
  if(!current){toast.error("Cliente sem vencimento válido.");return}
  setSelectedClient(client);
  setRenewDate(addDaysISO(current,30));
  setIsRenewOpen(true);
 }

 async function confirmRenew(){
  if(!selectedClient||!renewDate||isRenewing)return;
  setIsRenewing(true);
  try{
   const {data:authData}=await supabase.auth.getUser();
   const userId=authData.user?.id;
   if(!userId)throw new Error("Usuário não autenticado.");
   const [{data:plan,error:planError},{data:serverRows,error:serverError}]=await Promise.all([
    supabase.from("plans").select("price").eq("id",selectedClient.plano_id).single(),
    selectedClient.servidores_ids?.length?supabase.from("servidores_iptv").select("valor").in("id",selectedClient.servidores_ids):Promise.resolve({data:[],error:null} as any),
   ]);
   if(planError||!plan)throw planError||new Error("Plano não encontrado.");
   if(serverError)throw serverError;
   const valorEntrada=Math.max(0,Number(plan.price||0)-Number(selectedClient.desconto||0));
   const totalCusto=(serverRows||[]).reduce((sum:number,s:any)=>sum+Number(s.valor||0),0);
   const todayBr=formatTz(toZonedTime(new Date(),"America/Sao_Paulo"),"yyyy-MM-dd");
   const {error:renewalError}=await supabase.from("renovacoes").insert({user_id:userId,cliente_id:selectedClient.id,plano_id:selectedClient.plano_id,valor:valorEntrada,desconto:Number(selectedClient.desconto||0),vencimento_anterior:selectedClient.vencimento,novo_vencimento:renewDate,data_renovacao:new Date().toISOString()});
   if(renewalError)throw renewalError;
   const {error:transactionError}=await supabase.from("transacoes").insert({user_id:userId,cliente_id:selectedClient.id,tipo:"entrada",entrada:valorEntrada,custo:totalCusto,valor:valorEntrada,data:todayBr,descricao:`Renovação cliente ${selectedClient.id}`,serv_id:selectedClient.servidores_ids?.[0]||null});
   if(transactionError)throw transactionError;
   const {error:updateError}=await supabase.from("clientes").update({vencimento:renewDate,status:"ativo"}).eq("id",selectedClient.id);
   if(updateError)throw updateError;
   setSelectedClient({...selectedClient,vencimento:renewDate});
   setIsRenewOpen(false);
   setIsRenewSuccessOpen(true);
   toast.success(`${selectedClient.nome} renovado.`);
   await refetch();
  }catch(error){console.error(error);toast.error("Não foi possível renovar o cliente.")}finally{setIsRenewing(false)}
 }

 function sendRenewalMessage(){
  if(!selectedClient?.whatsapp||!selectedClient?.vencimento){toast.error("Cliente sem WhatsApp cadastrado.");return}
  const firstName=(selectedClient.nome||"Cliente").trim().split(" ")[0]||"Cliente";
  const brDate=format(parseISO(selectedClient.vencimento),"dd/MM/yyyy");
  const message=BOT_TEMPLATES.CONFIRMACAO(firstName,brDate);
  const raw=String(selectedClient.whatsapp).replace(/\D/g,"");
  const phone=raw.startsWith("55")?raw:`55${raw}`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,"_blank");
  setIsRenewSuccessOpen(false);
 }

 if(isLoading)return <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]"><div className="flex flex-col items-center gap-2"><Activity className="h-10 w-10 text-primary animate-pulse"/><span className="text-sm font-medium animate-pulse text-muted-foreground">Carregando painel...</span></div></div>;

 return <div className="dashboard-page flex flex-col gap-6 p-4 md:p-6 pb-10 max-w-7xl mx-auto w-full">
  <header className="dashboard-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3">
   <div className="period-switch bg-card border border-border rounded-xl p-1 flex items-center gap-0.5 shadow-sm">{[{id:"hoje",label:"Hoje"},{id:"mes",label:currentMonthLabel},{id:"ano",label:"Ano"}].map(tab=><button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab===tab.id?"bg-primary text-primary-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div>
  </header>
  <section className="dashboard-hero grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-4">
   <div className="hero-profit bg-primary text-primary-foreground rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden"><div className="relative z-10"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] font-semibold opacity-75">Lucro líquido</p><h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">{showLucro?formatBRL(stats?.lucro):"R$ ••••••"}</h1></div><div className="flex items-center gap-2"><button onClick={()=>setShowLucro(v=>!v)} className="h-10 w-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors" aria-label={showLucro?"Ocultar lucro":"Mostrar lucro"}>{showLucro?<Eye size={20}/>:<EyeOff size={20}/>}</button></div></div></div></div>
   <div className="grid grid-cols-2 gap-3"><div className="dashboard-mini-card bg-card border border-border rounded-2xl p-4"><span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Faturamento</span><div className="text-xl md:text-2xl font-bold tracking-tight mt-2">{showLucro?formatBRL(stats?.entradas):"R$ ••••"}</div><span className="text-[10px] text-muted-foreground">{activeTab==="hoje"?`${stats?.transactionsCount??0} renovações hoje`:`${stats?.activeClients??0} clientes ativos`}</span></div><div className="dashboard-mini-card bg-card border border-border rounded-2xl p-4"><span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Custos</span><div className="text-xl md:text-2xl font-bold tracking-tight mt-2 text-rose-500">{showLucro?formatBRL(stats?.saidas):"R$ ••••"}</div><span className="text-[10px] text-muted-foreground">Painéis e servidores</span></div><div className="dashboard-mini-card bg-card border border-border rounded-2xl p-4"><span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Clientes ativos</span><div className="text-xl md:text-2xl font-bold tracking-tight mt-2">{stats?.activeClients??0}</div><span className="text-[10px] text-muted-foreground">de {stats?.totalClients??0} cadastrados</span></div><div className="dashboard-mini-card bg-card border border-border rounded-2xl p-4"><span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Vencimentos</span><div className="text-xl md:text-2xl font-bold tracking-tight mt-2">{stats?.expiringTodayCount??0}</div><span className="text-[10px] text-muted-foreground">para hoje</span></div></div>
  </section>
  <section className="grid grid-cols-1 lg:grid-cols-[1.35fr_.65fr] gap-4">
   <div className="bg-card border border-border rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Movimento</p><h2 className="text-lg font-bold tracking-tight">Performance mensal</h2></div>{pct(stats?.entradas??0,stats?.previousPeriodEntradas??0)!==null&&<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pct(stats?.entradas??0,stats?.previousPeriodEntradas??0)!>=0?"bg-emerald-500/10 text-emerald-600":"bg-rose-500/10 text-rose-500"}`}>{pct(stats?.entradas??0,stats?.previousPeriodEntradas??0)!>=0?"+":""}{pct(stats?.entradas??0,stats?.previousPeriodEntradas??0)!.toFixed(1)}%</span>}</div><div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats?.chartData??[]} margin={{top:0,right:0,left:-20,bottom:0}} barGap={3} barCategoryGap="16%"><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" opacity={.3}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fontWeight:600,fill:"#64748b"}} dy={8}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:9,fontWeight:600,fill:"#64748b"}} tickFormatter={v=>`R$ ${v}`}/><Tooltip cursor={{fill:"rgba(255,255,255,.03)"}} content={({active,payload})=>{if(!active||!payload?.length)return null;const d=(payload[0] as any)?.payload;return <div className="bg-card border border-border rounded-xl p-3 shadow-xl text-xs"><p className="font-bold mb-2">{d.name}</p><p className="text-sky-600 flex justify-between gap-4"><span>Entradas</span><span>{formatBRL(d.entradas)}</span></p><p className="text-rose-500 flex justify-between gap-4"><span>Saídas</span><span>{formatBRL(d.saidas)}</span></p><p className="text-emerald-600 flex justify-between gap-4 border-t border-border pt-1 mt-1"><span>Lucro</span><span>{formatBRL(d.lucro)}</span></p></div>}}/><Legend verticalAlign="top" align="right" height={32} iconType="circle" formatter={v=><span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mr-3">{v}</span>}/><Bar name="Entradas" dataKey="entradas" fill="#0284c7" radius={[5,5,0,0]} maxBarSize={18}/><Bar name="Saídas" dataKey="saidas" fill="#ef4444" radius={[5,5,0,0]} maxBarSize={18}/><Bar name="Lucro" dataKey="lucro" fill="#22c55e" radius={[5,5,0,0]} maxBarSize={18}/></BarChart></ResponsiveContainer></div></div>
   <div className="bg-card border border-border rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between mb-4"><div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Hoje</p><h2 className="text-lg font-bold tracking-tight">Vencimentos</h2></div><span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-600">{stats?.expiringTodayCount??0}</span></div><div className="space-y-2">{stats?.expiringToday?.slice(0,6).map((c:any)=><div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40"><div className="min-w-0"><p className="text-sm font-semibold truncate">{c.nome}</p><p className="text-[10px] truncate"><ServerBadge name={c.serverName} /></p></div><div className="flex items-center gap-1.5 shrink-0"><span className="text-xs font-bold mr-1">{formatBRL(c.valorFinal)}</span><button type="button" onClick={()=>chargeClient(c)} className="h-9 w-9 rounded-xl border border-border bg-background/80 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all" aria-label={`Cobrar ${c.nome}`} title="Cobrar"><ReceiptText size={17} strokeWidth={1.9}/></button><button type="button" onClick={()=>openRenew(c)} className="h-9 w-9 rounded-xl border border-border bg-background/80 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/30 transition-all" aria-label={`Renovar ${c.nome}`} title="Renovar"><RotateCw size={17} strokeWidth={1.9}/></button></div></div>)}{(!stats?.expiringToday||stats.expiringToday.length===0)&&<p className="text-sm text-muted-foreground py-8 text-center">Nenhum vencimento para hoje.</p>}</div></div>
  </section>
  <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm"><div className="px-5 py-4 flex items-center justify-between border-b border-border"><div><p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Últimas movimentações</p><h2 className="text-lg font-bold tracking-tight">Extrato recente</h2></div><Link to="/financeiro"><Button variant="ghost" size="sm" className="text-xs font-semibold text-primary">Ver histórico</Button></Link></div><div className="hidden md:block overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-muted/30"><th className="px-5 py-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Cliente / Servidor</th><th className="px-5 py-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Plano</th><th className="px-5 py-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Custo</th><th className="px-5 py-3 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Lucro</th><th className="w-10"/></tr></thead><tbody className="divide-y divide-border/60">{stats?.recentTransactions?.slice(0,5).map((t:any)=><tr key={t.id} className="hover:bg-muted/20"><td className="px-5 py-3"><p className="text-sm font-semibold truncate">{t.clientes?.nome||"Cliente"}</p><p className="text-[10px]"><ServerBadge name={t.resolvedServerName} /></p></td><td className="px-5 py-3 text-right text-sm font-semibold">{formatBRL(t.entrada)}</td><td className="px-5 py-3 text-right text-sm font-semibold text-rose-500">{formatBRL(t.custo)}</td><td className="px-5 py-3 text-right text-sm font-semibold text-emerald-600">{formatBRL(t.lucro_liquido)}</td><td className="px-2 py-3 text-center"><DeleteTransaction id={t.id}/></td></tr>)}</tbody></table></div><div className="md:hidden divide-y divide-border/60">{stats?.recentTransactions?.slice(0,5).map((t:any)=><div key={t.id} className="p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold truncate">{t.clientes?.nome||"Cliente"}</p><p className="text-[10px] truncate"><ServerBadge name={t.resolvedServerName} /></p></div><span className="text-[9px] text-muted-foreground">{t.data?format(parseISO(t.data),"dd/MM/yyyy"):"-"}</span></div><div className="flex items-center justify-between gap-2 mt-2 bg-muted/30 rounded-xl p-2.5"><div className="grid grid-cols-3 gap-2 flex-1 min-w-0"><div><p className="text-[8px] uppercase font-semibold text-muted-foreground">Plano</p><p className="text-xs font-bold">{formatBRL(t.entrada)}</p></div><div><p className="text-[8px] uppercase font-semibold text-muted-foreground">Custo</p><p className="text-xs font-bold text-rose-500">{formatBRL(t.custo)}</p></div><div><p className="text-[8px] uppercase font-semibold text-muted-foreground">Lucro</p><p className="text-xs font-bold text-emerald-600">{formatBRL(t.lucro_liquido)}</p></div></div><div className="shrink-0"><DeleteTransaction id={t.id}/></div></div></div>)}</div>{(!stats?.recentTransactions||stats.recentTransactions.length===0)&&<div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma renovação registrada recentemente.</div>}</section>

  <Dialog open={isRenewOpen} onOpenChange={setIsRenewOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">{selectedClient?.nome}</DialogTitle><DialogDescription>Ajuste a nova data e confirme.</DialogDescription></DialogHeader><div className="grid grid-cols-[52px_1fr_52px] gap-2 py-4"><Button variant="outline" onClick={()=>setRenewDate(d=>addDaysISO(d,-1))} className="h-12 rounded-xl"><Minus size={18}/></Button><div className="flex h-12 items-center justify-center rounded-xl border bg-muted/30 font-mono font-bold">{renewDate?format(parseISO(renewDate),"dd/MM/yyyy"):""}</div><Button variant="outline" onClick={()=>setRenewDate(d=>addDaysISO(d,1))} className="h-12 rounded-xl"><Plus size={18}/></Button></div><div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={isRenewing} onClick={()=>setIsRenewOpen(false)}>Cancelar</Button><Button disabled={isRenewing} onClick={confirmRenew}>{isRenewing?"Renovando...":"Renovar"}</Button></div></DialogContent></Dialog>

  <Dialog open={isRenewSuccessOpen} onOpenChange={setIsRenewSuccessOpen}><DialogContent className="max-w-sm rounded-2xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase tracking-tighter">Renovado — {selectedClient?.nome}</DialogTitle><DialogDescription>{selectedClient?.vencimento?format(parseISO(selectedClient.vencimento),"dd/MM/yyyy"):""}</DialogDescription></DialogHeader><div className="grid gap-2 pt-2">{selectedClient?.whatsapp&&<Button onClick={sendRenewalMessage} className="h-11 rounded-xl gap-2"><MessageCircle size={16}/>Enviar mensagem</Button>}<Button variant="outline" onClick={()=>setIsRenewSuccessOpen(false)} className="h-11 rounded-xl">Fechar</Button></div></DialogContent></Dialog>
 </div>
}

function DeleteTransaction({id}:{id:any}){return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500"><Trash2 size={14}/></Button></DialogTrigger><DialogContent className="max-w-[350px] rounded-2xl"><DialogHeader><DialogTitle className="text-center font-bold">Confirmar exclusão</DialogTitle></DialogHeader><p className="text-center text-sm text-muted-foreground py-4">Deseja realmente excluir este registro de transação?</p><div className="flex gap-2"><DialogTrigger asChild><Button variant="outline" className="flex-1 rounded-xl font-semibold">Cancelar</Button></DialogTrigger><Button variant="destructive" className="flex-1 rounded-xl font-bold" onClick={async()=>{const{error}=await supabase.from("transacoes").delete().eq("id",id);if(error)toast.error("Erro ao excluir registro");else{toast.success("Registro removido");setTimeout(()=>window.location.reload(),300)}}}>Excluir</Button></div></DialogContent></Dialog>}
