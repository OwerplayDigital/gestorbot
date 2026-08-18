import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  Activity
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats-detailed"],
    queryFn: async () => {
      try {
        const [clients, transactions, expiredClientsList] = await Promise.all([
          supabase.from("clientes").select("status"),
          supabase.from("transacoes").select("valor, tipo"),
          supabase.from("clientes")
            .select("nome, vencimento, servers:servidores_ids")
            .eq("status", "vencido")
            .order("vencimento", { ascending: false })
            .limit(10),
        ]);

        const totalClients = clients.data?.length ?? 0;
        const activeClients = clients.data?.filter(c => c?.status === "ativo").length ?? 0;
        const expiredClients = clients.data?.filter(c => c?.status === "vencido").length ?? 0;

        const entradas = transactions.data
          ?.filter((t) => t?.tipo === "entrada")
          .reduce((acc, t) => acc + Number(t?.valor ?? 0), 0) ?? 0;
        
        const saidas = transactions.data
          ?.filter((t) => t?.tipo === "saida")
          .reduce((acc, t) => acc + Number(t?.valor ?? 0), 0) ?? 0;

        const lucro = entradas - saidas;
        const costPercentage = entradas > 0 ? (saidas / entradas) * 100 : 0;
        const profitPercentage = entradas > 0 ? (lucro / entradas) * 100 : 0;

        return {
          totalClients,
          activeClients,
          expiredClients,
          faturamento: entradas,
          custos: saidas,
          lucro,
          costPercentage,
          profitPercentage,
          expiredClientsList: expiredClientsList.data ?? [],
        };
      } catch (error) {
        console.error("Erro no dashboard:", error);
        return {
          totalClients: 0,
          activeClients: 0,
          expiredClients: 0,
          faturamento: 0,
          custos: 0,
          lucro: 0,
          costPercentage: 0,
          profitPercentage: 0,
          expiredClientsList: [],
        };
      }
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px] bg-[#0f172a]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-1 border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            Executive Command Center
          </h1>
          <p className="text-slate-400 text-sm">Monitoramento em tempo real da operação IPTV.</p>
        </div>
        
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-[#1e293b] border-slate-700 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-400 tracking-wider">Base de Assinantes</CardTitle>
              <Users className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalClients} Clientes</div>
              <p className="text-xs text-slate-500 mt-1">
                <span className="text-emerald-400 font-medium">{stats?.activeClients} Ativos</span>
                {" | "}
                <span className="text-rose-400 font-medium">{stats?.expiredClients} Vencidos</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e293b] border-slate-700 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-400 tracking-wider">Faturamento (Entradas)</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                R$ {stats?.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Volume total de recebimentos</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e293b] border-slate-700 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-400 tracking-wider">Custo Operacional</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                R$ {stats?.custos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Infraestrutura e Servidores</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1e293b] border-slate-700 shadow-xl border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase text-slate-400 tracking-wider">Lucro Líquido</CardTitle>
              <Wallet className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                R$ {stats?.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Resultado final da operação</p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Highlights */}
        <Card className="bg-[#1e293b] border-slate-700 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Balanço da Operação
            </CardTitle>
            <CardDescription className="text-slate-400">Distribuição financeira proporcional</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Total Faturado</span>
                <span className="text-emerald-400 font-semibold">100%</span>
              </div>
              <Progress value={100} className="h-2 bg-slate-800" />
              <div className="bg-emerald-500 h-full w-full" style={{ display: 'none' }} /> {/* Forced color for indicator via theme if needed, but progress uses bg-primary */}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Custo de Servidores</span>
                <span className="text-rose-400 font-semibold">{stats?.costPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={stats?.costPercentage} className="h-2 bg-slate-800" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300">Lucro Real</span>
                <span className="text-blue-400 font-semibold">{stats?.profitPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={stats?.profitPercentage} className="h-2 bg-slate-800" />
            </div>
          </CardContent>
        </Card>

        {/* Expired Table */}
        <Card className="bg-[#1e293b] border-slate-700 shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-800/50 border-b border-slate-700">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-rose-500" />
              Monitoramento de Inadimplência
            </CardTitle>
            <CardDescription className="text-slate-400">Clientes com status 'vencido'</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-900/50">
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-medium pl-6">Cliente</TableHead>
                  <TableHead className="text-slate-400 font-medium">Vencimento</TableHead>
                  <TableHead className="text-slate-400 font-medium">Servidor</TableHead>
                  <TableHead className="text-slate-400 font-medium text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.expiredClientsList.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                      Nenhum cliente vencido encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  stats?.expiredClientsList.map((client, idx) => (
                    <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <TableCell className="pl-6 font-medium text-slate-200">{client.nome}</TableCell>
                      <TableCell className="text-slate-400">
                        {client.vencimento ? format(new Date(client.vencimento), "dd/MM/yyyy", { locale: ptBR }) : "N/A"}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 font-normal">
                          {client.servers && client.servers.length > 0 ? "IPTV Ativo" : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 px-3 py-1 font-semibold uppercase tracking-tighter text-[10px]">
                          VENCIDO
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}