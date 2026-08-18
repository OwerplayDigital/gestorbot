import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  Server, 
  CreditCard, 
  TrendingUp, 
  Clock, 
  AlertCircle,
  Package
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
        const [plans, servers, clients, transactions, expiringClients] = await Promise.all([
          supabase.from("plans").select("*", { count: "exact", head: true }),
          supabase.from("servidores_iptv").select("*", { count: "exact", head: true }),
          supabase.from("clientes").select("status"),
          supabase.from("transacoes").select("valor, tipo, data"),
          supabase.from("clientes")
            .select("nome, vencimento, plano_id, servers:servidores_ids")
            .or("status.eq.vencido,vencimento.lte." + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order("vencimento", { ascending: true })
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

        // Group transactions by month for a chart (last 6 months)
        const monthlyData: Record<string, { name: string, faturamento: number }> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = d.toISOString().substring(0, 7);
          monthlyData[key] = { name: format(d, "MMM", { locale: ptBR }), faturamento: 0 };
        }

        transactions.data?.forEach(t => {
          if (t?.tipo === "entrada" && t?.data) {
            const key = t.data.substring(0, 7);
            if (monthlyData[key]) {
              monthlyData[key].faturamento += Number(t.valor || 0);
            }
          }
        });

        const activeClientsCount = activeClients;
        const expiredClientsCount = expiredClients;

        return {
          plans: plans?.count ?? 0,
          servers: servers?.count ?? 0,
          activeClients: activeClientsCount,
          expiredClients: expiredClientsCount,
          totalClients,
          lucro: entradas - saidas,
          faturamentoTotal: entradas,
          chartData: Object.values(monthlyData),
          expiringClients: expiringClients.data ?? [],
          pieData: [
            { name: "Ativos", value: activeClientsCount, color: "hsl(var(--chart-1))" },
            { name: "Vencidos", value: expiredClientsCount, color: "hsl(var(--chart-2))" },
          ]
        };
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        return {
          plans: 0,
          servers: 0,
          activeClients: 0,
          expiredClients: 0,
          totalClients: 0,
          lucro: 0,
          faturamentoTotal: 0,
          chartData: [],
          expiringClients: [],
          pieData: [
            { name: "Ativos", value: 0, color: "hsl(var(--chart-1))" },
            { name: "Vencidos", value: 0, color: "hsl(var(--chart-2))" },
          ]
        };
      }
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Painel de Controle</h1>
        <p className="text-muted-foreground">Bem-vindo ao seu centro de gestão IPTV.</p>
      </div>
      
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeClients}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Vencidos</CardTitle>
            <Clock className="h-4 w-4 text-destructive opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.expiredClients}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Servidores</CardTitle>
            <Server className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.servers}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Planos</CardTitle>
            <Package className="h-4 w-4 text-primary opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.plans}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-muted/60 transition-all hover:shadow-md bg-primary/[0.02]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase text-muted-foreground">Lucro Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats?.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        {/* Gráfico de Faturamento */}
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Financeira
            </CardTitle>
            <CardDescription>Faturamento bruto dos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] w-full pt-4">
            <ChartContainer 
              config={{
                faturamento: {
                  label: "Faturamento",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-full w-full"
            >
              <BarChart data={stats?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `R$${value}`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="faturamento" 
                  fill="var(--color-faturamento)" 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Clientes */}
        <Card className="md:col-span-3 shadow-sm relative">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Status dos Clientes
            </CardTitle>
            <CardDescription>Proporção de ativos vs vencidos</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ChartContainer
              config={{
                ativos: {
                  label: "Ativos",
                  color: "hsl(var(--chart-1))",
                },
                vencidos: {
                  label: "Vencidos",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-full w-full"
            >
              <PieChart>
                <Pie
                  data={stats?.pieData || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                    {stats?.pieData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                </PieChart>
            </ChartContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none pt-16">
              <span className="text-2xl font-bold">{stats?.totalClients}</span>
              <span className="text-[10px] uppercase text-muted-foreground">Total</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Vencimentos */}
      <Card className="shadow-sm border-muted/60 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Alertas de Vencimento
          </CardTitle>
          <CardDescription>Clientes vencidos ou vencendo nos próximos 7 dias</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 py-4">Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Ação Recomendada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.expiringClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum alerta para o período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                stats?.expiringClients.map((client, idx) => {
                  const isExpired = client.vencimento ? new Date(client.vencimento) < new Date() : false;
                  return (
                    <TableRow key={idx} className="group hover:bg-muted/20">
                      <TableCell className="pl-6 font-medium">{client.nome}</TableCell>
                      <TableCell>{client.vencimento ? format(new Date(client.vencimento), "dd 'de' MMMM", { locale: ptBR }) : "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : "secondary"} className="font-normal">
                          {isExpired ? "Vencido" : "Vencendo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                         <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors cursor-default">
                           {isExpired ? "Cobrar Renovação" : "Lembrar Cliente"}
                         </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}