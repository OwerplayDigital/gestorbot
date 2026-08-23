import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, History, Package, Calendar, Server, Phone, User } from "lucide-react";

export const Route = createFileRoute("/public/fatura/$id")({
  component: PublicFaturaPage,
});

function PublicFaturaPage() {
  const { id } = Route.useParams();

  const { data: reseller, isLoading: isLoadingReseller } = useQuery({
    queryKey: ["public-reseller", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revendedores")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: credits = [], isLoading: isLoadingCredits } = useQuery({
    queryKey: ["public-reseller-credits", id],
    enabled: !!id,
    queryFn: async () => {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("reseller_credits" as any)
        .select("*")
        .eq("reseller_id", id)
        .gte("data", firstDayOfMonth)
        .order("data", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const stats = {
    totalCredits: credits.reduce((sum: number, c: any) => sum + (c.quantidade_creditos || 0), 0),
    totalCusto: credits.reduce((sum: number, c: any) => sum + (Number(c.custo) || 0), 0),
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentMonthName = monthNames[new Date().getMonth()];

  if (isLoadingReseller || isLoadingCredits) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-xl font-black text-slate-900 uppercase">Fatura não encontrada</h1>
        <p className="text-slate-500 text-sm mt-2">O link pode estar expirado ou incorreto.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Relatório Mensal</span>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{reseller.nome}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <div className="flex items-center gap-1.5">
                <Server size={12} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">{reseller.servidor || "Uniplay"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-500 uppercase">{currentMonthName} de {new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
            <div className="h-8 w-8 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Package size={16} className="text-primary" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Créditos</span>
            <span className="text-2xl font-black text-slate-900 leading-none">{stats.totalCredits}</span>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
            <div className="h-8 w-8 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
              <CreditCard size={16} className="text-emerald-600" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Total</span>
            <span className="text-2xl font-black text-emerald-600 leading-none">
              R$ {stats.totalCusto.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Histórico de Recargas</h3>
          </div>
          
          <div className="divide-y divide-slate-50">
            {credits.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-xs font-bold text-slate-400 uppercase">Nenhuma recarga este mês</p>
              </div>
            ) : (
              credits.map((item: any) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-6 flex-1">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase block leading-tight">Data</span>
                      <span className="text-sm font-bold text-slate-700">
                        {new Date(item.data + "T00:00:00").toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase block leading-tight">Créditos</span>
                      <span className="text-sm font-black text-slate-900">{item.quantidade_creditos}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase block leading-tight">Valor</span>
                    <span className="text-sm font-black text-slate-900">
                      R$ {Number(item.custo).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-4">
          Relatório gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
