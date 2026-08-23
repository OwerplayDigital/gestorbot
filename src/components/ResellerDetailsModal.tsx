import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, ArrowLeft, History, Package, Phone } from "lucide-react";
import { ResellerReloadModal } from "./ResellerReloadModal";

interface ResellerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reseller: any;
  onUpdate: () => void;
}

export function ResellerDetailsModal({ 
  isOpen, 
  onClose, 
  reseller,
  onUpdate
}: ResellerDetailsModalProps) {
  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);

  const { data: credits = [], refetch } = useQuery({
    queryKey: ["reseller-credits", reseller?.id],
    enabled: !!reseller?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reseller_credits" as any)
        .select("*")
        .eq("reseller_id", reseller.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const groupedCredits = useMemo(() => {
    const groups: Record<string, { items: any[], totalCredits: number, totalCusto: number }> = {};
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    credits.forEach((credit: any) => {
      const date = new Date(credit.data + "T00:00:00");
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      const key = `${month} De ${year}`;
      
      if (!groups[key]) {
        groups[key] = { items: [], totalCredits: 0, totalCusto: 0 };
      }
      groups[key].items.push(credit);
      groups[key].totalCredits += ((credit as any).quantidade_creditos || 0);
      groups[key].totalCusto += (Number((credit as any).custo) || 0);

    });

    return groups;
  }, [credits]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthCredits = credits.filter((c: any) => {
      const d = new Date(c.data + "T00:00:00");
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    return {
      totalCredits: monthCredits.reduce((sum, c) => sum + ((c as any).quantidade_creditos || 0), 0),
      totalCusto: monthCredits.reduce((sum, c) => sum + (Number((c as any).custo) || 0), 0)
    };

  }, [credits]);

  const handleWhatsApp = () => {
    if (!reseller.whatsapp) return;
    const phone = reseller.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  };

  const handleDeleteCredit = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta recarga?")) return;

    try {
      const { error } = await supabase
        .from("reseller_credits" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Recarga excluída!");
      refetch();
      onUpdate();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  };

  if (!reseller) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border bg-white text-slate-900">
          <DialogHeader className="p-6 pb-2">
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">{reseller.nome}</DialogTitle>
                <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                  {reseller.whatsapp || "Sem contato"} · {reseller.servidor || "Uniplay"}
                </p>
              </div>
              <Button 
                onClick={() => setIsReloadModalOpen(true)}
                className="rounded-xl font-black uppercase tracking-tighter gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                <Plus size={16} />
                Nova Recarga
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Créditos (mês atual)</span>
                <span className="text-xl font-black text-slate-900">{stats.totalCredits}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Custo Total (mês atual)</span>
                <span className="text-xl font-black text-rose-600">R$ {stats.totalCusto.toFixed(2)}</span>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
            <div className="flex items-center gap-2 mb-4">
              <History size={16} className="text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Histórico de Recargas</h3>
            </div>

            {Object.keys(groupedCredits).length === 0 ? (
              <div className="text-center py-10 opacity-50">
                <Package className="mx-auto mb-2 opacity-20" size={40} />
                <p className="text-xs font-bold uppercase">Nenhuma recarga registrada</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedCredits).map(([monthYear, group]) => (
                  <div key={monthYear} className="space-y-3">
                    <div className="flex justify-between items-end border-b border-slate-100 pb-1">
                      <div className="flex flex-col">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{monthYear}</h4>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          {group.totalCredits} créditos · R$ {group.totalCusto.toFixed(2)}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleWhatsApp}
                        className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      >
                        <Phone size={14} />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="grid grid-cols-4 gap-4 flex-1">
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Data</span>
                              <span className="text-xs font-bold text-slate-700">{new Date(item.data + "T00:00:00").toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Créditos</span>
                              <span className="text-xs font-black text-slate-900">{item.quantidade_creditos} CR</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Custo</span>
                              <span className="text-xs font-bold text-rose-600">R$ {Number(item.custo).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Servidor</span>
                              <span className="text-xs font-bold text-slate-500 uppercase truncate">{item.servidor || "-"}</span>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteCredit(item.id)}
                            className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-2"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50">
            <Button 
              variant="ghost" 
              onClick={onClose} 
              className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] gap-2 text-slate-400 hover:text-slate-600"
            >
              <ArrowLeft size={14} />
              Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResellerReloadModal 
        isOpen={isReloadModalOpen}
        onClose={() => setIsReloadModalOpen(false)}
        resellerId={reseller.id}
        resellerName={reseller.nome}
        currentServer={reseller.servidor}
        onSuccess={() => {
          refetch();
          onUpdate();
        }}
      />
    </>
  );
}
