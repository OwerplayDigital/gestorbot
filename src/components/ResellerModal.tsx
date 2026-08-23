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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface ResellerFormValues {
  nome: string;
  whatsapp: string;
  servidor_principal_id: string;
  painel_login: string;
  painel_senha: string;
  saldo_creditos: number;
  custo_por_credito: number;
  preco_venda_por_credito: number;
  vencimento_painel: string;
}

interface ResellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ResellerModal({ isOpen, onClose, onSuccess }: ResellerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ResellerFormValues>({
    defaultValues: {
      saldo_creditos: 0,
      custo_por_credito: 0,
      preco_venda_por_credito: 0,
    }
  });

  const { data: servers = [] } = useQuery({
    queryKey: ["servidores_iptv_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servidores_iptv")
        .select("id, name")
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  const onSubmit = async (values: ResellerFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("revendedores")
        .insert({
          ...values,
          user_id: user.id,
          saldo_creditos: Number(values.saldo_creditos),
          custo_por_credito: Number(values.custo_por_credito),
          preco_venda_por_credito: Number(values.preco_venda_por_credito),
        });

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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Cadastrar Revendedor</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo / Identificação</Label>
              <Input id="nome" {...register("nome", { required: true })} placeholder="Ex: João da Silva" className="rounded-xl" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp / Contato</Label>
              <Input id="whatsapp" {...register("whatsapp")} placeholder="Ex: 11999999999" className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Servidor Principal</Label>
              <Select onValueChange={(val) => setValue("servidor_principal_id", val)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um servidor" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento_painel">Vencimento do Painel</Label>
              <Input id="vencimento_painel" type="date" {...register("vencimento_painel")} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="painel_login">Login / Usuário do Painel</Label>
              <Input id="painel_login" {...register("painel_login")} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="painel_senha">Senha do Painel</Label>
              <Input id="painel_senha" type="password" {...register("painel_senha")} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saldo_creditos">Saldo Inicial de Créditos</Label>
              <Input id="saldo_creditos" type="number" step="1" {...register("saldo_creditos")} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custo_por_credito">Custo por Crédito (R$)</Label>
              <Input id="custo_por_credito" type="number" step="0.01" {...register("custo_por_credito")} className="rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preco_venda_por_credito">Preço de Venda (R$)</Label>
              <Input id="preco_venda_por_credito" type="number" step="0.01" {...register("preco_venda_por_credito")} className="rounded-xl" />
            </div>
          </div>

          <DialogFooter className="pt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl font-bold px-8">
              {isSubmitting ? "Salvando..." : "Salvar Revendedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
