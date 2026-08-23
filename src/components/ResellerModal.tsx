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

interface ResellerFormValues {
  nome: string;
  whatsapp: string;
  servidor: string;
}

interface ResellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResellerModal({ isOpen, onClose, onSuccess }: ResellerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResellerFormValues>();


  const onSubmit = async (values: ResellerFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("revendedores" as any)
        .insert({
          ...values,
          user_id: user.id,
        } as any);

      if (error) throw error;

      toast.success("Revendedor cadastrado com sucesso!");
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Erro ao cadastrar revendedor:", error);
      toast.error("Erro ao cadastrar: " + (error.message || "Tente novamente"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Novo Revendedor</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" {...register("nome", { required: true })} placeholder="Nome do revendedor" className="rounded-xl" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" {...register("whatsapp")} placeholder="Ex: 11999999999" className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servidor">Servidor</Label>
              <Input id="servidor" {...register("servidor")} placeholder="Nome do painel" className="rounded-xl" />
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold px-8">
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
