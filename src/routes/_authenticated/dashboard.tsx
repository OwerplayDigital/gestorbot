import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [plans, servers, clients, transactions] = await Promise.all([
        supabase.from("plans").select("*", { count: "exact", head: true }),
        supabase.from("servidores_iptv").select("*", { count: "exact", head: true }),
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("transacoes").select("valor, tipo"),
      ]);

      const entradas = transactions.data
        ?.filter((t) => t.tipo === "entrada")
        .reduce((acc, t) => acc + Number(t.valor), 0) || 0;
      
      const saidas = transactions.data
        ?.filter((t) => t.tipo === "saida")
        .reduce((acc, t) => acc + Number(t.valor), 0) || 0;

      return {
        plans: plans.count || 0,
        servers: servers.count || 0,
        clients: clients.count || 0,
        lucro: entradas - saidas,
      };
    },
  });

  if (isLoading) return <div className="p-8">Carregando dashboard...</div>;

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Dashboard Principal</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.clients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servidores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.servers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.plans}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats?.lucro.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
