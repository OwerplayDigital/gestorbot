import { createFileRoute } from "@tanstack/react-router";
import { Users, Plus, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ResellerModal } from "@/components/ResellerModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/servidores")({
  component: ServidoresPage,
});

function ServidoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data: revendedores = [], refetch, isLoading } = useQuery({
    queryKey: ["revendedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revendedores" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

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
            <div key={rev.id} className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-lg font-black tracking-tight text-foreground uppercase leading-none">{rev.nome}</span>
                  <span className="text-[10px] font-bold text-muted-foreground mt-1">{rev.whatsapp || "Sem contato"}</span>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase">
                  {rev.saldo_creditos} CRÉDITOS
                </Badge>
              </div>
              
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground uppercase">Servidor:</span>
                  <span className="font-black text-foreground">{rev.servidor || "N/A"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground uppercase">Custo:</span>
                  <span className="font-black text-rose-500">R$ {Number(rev.custo_por_credito).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground uppercase">Venda:</span>
                  <span className="font-black text-emerald-500">R$ {Number(rev.preco_venda_por_credito).toFixed(2)}</span>
                </div>
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
    </div>
  );
}

