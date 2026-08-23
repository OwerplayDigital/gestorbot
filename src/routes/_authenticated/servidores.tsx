import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, LayoutGrid, List, Phone, Server, CreditCard, ExternalLink, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { ResellerModal } from "@/components/ResellerModal";
import { ResellerDetailsModal } from "@/components/ResellerDetailsModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";


export const Route = createFileRoute("/_authenticated/servidores")({
  component: ServidoresPage,
});

function ServidoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  
  const { data: revendedoresData = [], refetch, isLoading } = useQuery({
    queryKey: ["revendedores-list-with-credits"],
    queryFn: async () => {
      const { data: resellers, error: resError } = await supabase
        .from("revendedores" as any)
        .select("*")
        .order("created_at", { ascending: false });
      
      if (resError) throw resError;
      
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      
      const { data: credits, error: creditError } = await supabase
        .from("reseller_credits" as any)
        .select("reseller_id, quantidade_creditos, custo")
        .gte("data", firstDayOfMonth);
      
      if (creditError) throw creditError;

      return (resellers || []).map((res: any) => {
        const resCredits = (credits || []).filter((c: any) => (c as any).reseller_id === res.id);
        const totalCredits = resCredits.reduce((sum, c) => sum + ((c as any).quantidade_creditos || 0), 0);
        const totalCusto = resCredits.reduce((sum, c) => sum + (Number((c as any).custo) || 0), 0);

        
        return {
          ...res,
          mes_atual_creditos: totalCredits,
          mes_atual_custo: totalCusto
        };
      });
    }
  });

  const revendedores = revendedoresData;


  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 pb-12 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">Revendedores</h1>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="rounded-xl font-bold gap-2">
          <Plus size={18} />
          Cadastrar Revendedor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : revendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl shadow-sm text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-black tracking-tight text-foreground uppercase mb-2">Nenhum revendedor encontrado</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {revendedores.map((rev: any) => (
            <div 
              key={rev.id} 
              className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-lg font-black tracking-tight text-foreground uppercase leading-none group-hover:text-primary transition-colors">
                    {rev.nome}
                  </span>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Phone size={10} className="text-muted-foreground" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{rev.whatsapp || "Sem contato"}</span>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-tighter">
                  {rev.mes_atual_creditos || 0} CR / MÊS
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/50 my-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <Server size={10} /> Servidor
                  </span>
                  <span className="text-xs font-black text-foreground uppercase truncate">{rev.servidor || "N/A"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                    <CreditCard size={10} /> Custo Mês
                  </span>
                  <span className="text-xs font-black text-rose-500">R$ {Number(rev.mes_atual_custo || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedReseller(rev);
                    setIsDetailsOpen(true);
                  }}
                  className="w-full rounded-xl font-black uppercase text-[10px] tracking-widest gap-2 border-slate-700 hover:bg-slate-800"
                >
                  <Pencil size={12} />
                  Perfil / Editar
                </Button>
                <Button 
                  size="icon"
                  variant="outline"
                  className="rounded-xl border-slate-700 hover:bg-slate-800 shrink-0"
                  onClick={() => {
                    setSelectedReseller(rev);
                    setIsDetailsOpen(true);
                  }}
                >
                  <ExternalLink size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>

      )}

      <ResellerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => refetch()} 
      />

      {selectedReseller && (
        <ResellerDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          reseller={selectedReseller}
          onUpdate={() => refetch()}
        />
      )}

    </div>
  );
}

