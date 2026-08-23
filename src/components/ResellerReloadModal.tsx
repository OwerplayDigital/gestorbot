import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

interface ReloadFormValues {
  data: string;
  quantidade_creditos: number;
  custo: number;
  servidor: string;
}


interface ResellerReloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  resellerId: string;
  resellerName: string;
  currentServer: string;
  onSuccess: () => void;
}

export function ResellerReloadModal({ 
  isOpen, 
  onClose, 
  resellerId, 
  resellerName,
  currentServer,
  onSuccess 
}: ResellerReloadModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, reset, setValue } = useForm<ReloadFormValues>({
    values: {
      data: new Date().toISOString().split('T')[0] as string,
      servidor: (currentServer || "") as string,
      quantidade_creditos: 0,
      custo: 0
    }
  });




  const onSubmit = async (values: ReloadFormValues) => {

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Insert reload record
      const { error: creditError } = await supabase
        .from("reseller_credits" as any)
        .insert({
          reseller_id: resellerId,
          user_id: user.id,
          data: values.data,
          quantidade_creditos: Number(values.quantidade_creditos),
          custo: Number(values.custo),
          servidor: values.servidor,
        } as any);

      if (creditError) throw creditError;

      // 2. Update reseller's current credit balance (optional but helpful if we track current total)
      // Since the request asks for "total credits of current month", we calculate it from reseller_credits.
      // If we had a saldo_creditos on revendedores, we could update it here.
      
      // 3. Add to general transactions table as well? 
      // The instructions say "tabela de créditos/transações do revendedor".
      // Let's also add it to the main 'transacoes' table as an expense (Saída)
      const { error: transError } = await supabase
        .from("transacoes" as any)

        .insert({
          user_id: user.id,
          tipo: "Saída",
          valor: Number(values.custo),
          descricao: `Recarga Revendedor: ${resellerName} (${values.quantidade_creditos} CR)`,
          data: values.data,
          custo: Number(values.custo),
        });

      if (transError) {
        console.warn("Could not record reload in general transactions:", transError);
      }

      toast.success("Recarga registrada com sucesso!");
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Erro ao registrar recarga:", error);
      toast.error("Erro ao registrar: " + (error.message || "Tente novamente"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const setCredits = (amount: number) => {
    setValue("quantidade_creditos", amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl bg-white text-slate-900 border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">+ Nova Recarga</DialogTitle>
          <p className="text-sm text-slate-500 uppercase font-bold">{resellerName}</p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Data</Label>
              <div className="relative">
                <Input type="date" {...register("data", { required: true })} className="rounded-xl pl-10 border-slate-200 bg-slate-50" />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Créditos Comprados</Label>
              <Input 
                type="number" 
                {...register("quantidade_creditos", { required: true, min: 1 })} 
                placeholder="0" 
                className="rounded-xl border-slate-200 bg-slate-50" 
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[10, 20, 30, 50, 100, 200].map((num) => (
                  <Button 
                    key={num} 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCredits(num)}
                    className="rounded-lg text-[10px] font-bold border-primary/20 text-primary hover:bg-primary/5"
                  >
                    +{num}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Custo (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                {...register("custo", { required: true })} 
                placeholder="0.00" 
                className="rounded-xl font-bold text-rose-600 border-slate-200 bg-slate-50" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Servidor</Label>
              <Input {...register("servidor")} className="rounded-xl uppercase font-bold border-slate-200 bg-slate-50" />
            </div>
          </div>

          <DialogFooter className="pt-6 gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl uppercase font-bold text-[10px] text-slate-400">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-black uppercase tracking-tighter px-8 bg-primary hover:bg-primary/90 text-white">
              {isSubmitting ? "Salvando..." : "Salvar Recarga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

    </Dialog>
  );
}
