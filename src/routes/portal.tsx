import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Package, History, LayoutDashboard, Database, TrendingUp } from "lucide-react";
import gestorLogo from "@/assets/gestor-logo.png.asset.json";

export const Route = createFileRoute("/portal")({
  component: PortalPage,
});

function PortalPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const resellerId = searchParams.get("id");

  const { data: reseller, isLoading: isLoadingReseller } = useQuery({
    queryKey: ["portal-reseller", resellerId],
    enabled: !!resellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revendedores")
        .select("*")
        .eq("id", resellerId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: credits = [], isLoading: isLoadingCredits } = useQuery({
    queryKey: ["portal-credits", resellerId],
    enabled: !!resellerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_credits" as any)
        .select("*")
        .eq("reseller_id", resellerId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const totalCredits = credits.reduce((sum, c) => sum + (Number((c as any).quantidade_creditos) || 0), 0);
  const totalInvestido = credits.reduce((sum, c) => sum + (Number((c as any).custo) || 0), 0);

  if (!resellerId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-slate-500 bg-[#F8FAFC]">
        ID do revendedor não fornecido.
      </div>
    );
  }

  if (isLoadingReseller || isLoadingCredits) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-slate-500 bg-[#F8FAFC]">
        Revendedor não encontrado.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* TOPO */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <img 
            src={gestorLogo.url} 
            alt="Logo" 
            className="h-16 w-16 rounded-2xl shadow-xl border border-white"
          />
          <div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Gestor Pro</h1>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">Portal do Revendedor</h2>
          </div>
        </div>

        {/* CARD 1: Dados do Revendedor */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Revendedor</h3>
            <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{reseller.nome}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase">{reseller.servidor || "Uniplay"}</p>
          </div>
        </div>

        {/* CARDS 2 e 3: Totais */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <Database size={20} />
            </div>
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Créditos</h3>
            <p className="text-2xl font-black text-slate-900">{totalCredits}</p>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Investido</h3>
            <p className="text-2xl font-black text-slate-900">R$ {totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* EXTRATO */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-2">
            <History size={16} className="text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Histórico de Recargas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {credits.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {new Date(item.data + "T00:00:00").toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-black text-slate-900 uppercase">
                        {item.servidor || reseller.servidor || "Serviço"}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {item.quantidade_creditos} créditos
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs font-black text-slate-900 text-right whitespace-nowrap">
                      R$ {Number(item.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {credits.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center">
                      <Package className="mx-auto mb-2 opacity-10" size={32} />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhum registro</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}