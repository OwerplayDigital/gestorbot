import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Edit2, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: Mensagens,
});

function Mensagens() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates_whatsapp"],
    queryFn: async () => {
      // @ts-ignore - Ignore type error if table not yet in generated types
      const { data, error } = await supabase
        .from("templates_whatsapp" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updated: any) => {
      // @ts-ignore
      const { error } = await supabase
        .from("templates_whatsapp" as any)
        .update({
          nome: updated.nome,
          mensagem: updated.mensagem,
        })
        .eq("id", updated.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates_whatsapp"] });
      toast.success("Template atualizado com sucesso!");
      setIsModalOpen(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar template: " + error.message);
    },
  });

  const handleEdit = (template: any) => {
    setEditingTemplate({ ...template });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingTemplate.nome || !editingTemplate.mensagem) {
      toast.error("Preencha todos os campos");
      return;
    }
    updateMutation.mutate(editingTemplate);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Mensagens</h1>
        <p className="text-muted-foreground">Gerencie os templates de WhatsApp utilizados pelo sistema.</p>
      </div>

      {/* Card de Variáveis */}
      <Card className="bg-primary/5 border-primary/20 rounded-2xl">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
              <Info size={20} />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Variáveis Disponíveis</h3>
              <div className="flex flex-wrap gap-2">
                {["{nome}", "{primeiro_nome}", "{vencimento}", "{valor}"].map((tag) => (
                  <code key={tag} className="px-2 py-1 bg-background border border-border rounded-lg text-xs font-mono font-bold">
                    {tag}
                  </code>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Use estas tags no corpo da mensagem para que o sistema substitua automaticamente pelos dados do cliente.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template: any) => (
          <Card key={template.id} className="bg-card border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold truncate">{template.nome}</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
                onClick={() => handleEdit(template)}
              >
                <Edit2 size={16} />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3 bg-muted/50 p-3 rounded-xl italic">
                "{template.mensagem}"
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal de Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Template</DialogTitle>
            <DialogDescription>
              Modifique o nome ou o conteúdo da mensagem.
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Template</Label>
                <Input
                  id="nome"
                  value={editingTemplate.nome}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, nome: e.target.value })}
                  className="rounded-xl bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  rows={6}
                  value={editingTemplate.mensagem}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, mensagem: e.target.value })}
                  className="rounded-xl bg-muted/50 border-border resize-none"
                  placeholder="Escreva a mensagem aqui..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="rounded-xl font-bold"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
