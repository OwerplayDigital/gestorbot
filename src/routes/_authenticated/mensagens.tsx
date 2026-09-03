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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Info, Plus, Copy, Trash2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mensagens")({
  component: Mensagens,
});

type Template = {
  id: string;
  nome: string;
  mensagem: string;
};

function Mensagens() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates_whatsapp"],
    queryFn: async () => {
      // @ts-ignore - Ignore type error if table not yet in generated types
      const { data, error } = await supabase
        .from("templates_whatsapp" as any)
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (tpl: Partial<Template>) => {
      // @ts-ignore
      const query = supabase.from("templates_whatsapp" as any);
      if (isNew) {
        const { error } = await query.insert({ nome: tpl.nome, mensagem: tpl.mensagem });
        if (error) throw error;
      } else {
        const { error } = await query
          .update({ nome: tpl.nome, mensagem: tpl.mensagem })
          .eq("id", tpl.id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates_whatsapp"] });
      toast.success(isNew ? "Template criado com sucesso!" : "Template atualizado com sucesso!");
      closeModal();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar template: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // @ts-ignore
      const { error } = await supabase.from("templates_whatsapp" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates_whatsapp"] });
      toast.success("Template excluído com sucesso!");
      setToDelete(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir template: " + error.message);
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    setIsNew(false);
  };

  const handleEdit = (template: Template) => {
    setIsNew(false);
    setEditingTemplate({ ...template });
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setIsNew(true);
    setEditingTemplate({ nome: "", mensagem: "" });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingTemplate?.nome?.trim() || !editingTemplate?.mensagem?.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    saveMutation.mutate(editingTemplate);
  };

  const handleCopy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.mensagem);
      setCopiedId(template.id);
      toast.success("Texto copiado para a área de transferência!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar o texto");
    }
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Mensagens</h1>
        </div>
        <Button onClick={handleNew} className="rounded-xl font-bold shrink-0">
          <Plus size={16} className="mr-2" />
          Novo Template
        </Button>
      </div>

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
              <p className="text-xs text-muted-foreground mt-1">Use estas tags no corpo da mensagem para substituição manual pelos dados do cliente.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {templates?.length === 0 ? (
        <Card className="bg-card border-dashed border-border rounded-2xl">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-muted-foreground">Nenhum template cadastrado ainda.</p>
            <Button onClick={handleNew} variant="outline" className="rounded-xl">
              <Plus size={16} className="mr-2" />
              Criar primeiro template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template) => (
            <Card key={template.id} className="bg-card border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold truncate">{template.nome}</CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10" onClick={() => handleEdit(template)} title="Editar">
                    <Edit2 size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => setToDelete(template)} title="Excluir">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 bg-muted/50 p-3 rounded-xl italic flex-1">"{template.mensagem}"</p>
                <Button variant="outline" onClick={() => handleCopy(template)} className="rounded-xl w-full">
                  {copiedId === template.id ? <Check size={16} className="mr-2 text-green-600" /> : <Copy size={16} className="mr-2" />}
                  {copiedId === template.id ? "Copiado!" : "Copiar Texto"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{isNew ? "Novo Template" : "Editar Template"}</DialogTitle>
            <DialogDescription>{isNew ? "Crie uma nova mensagem modelo independente do bot." : "Modifique o nome ou o conteúdo da mensagem."}</DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Template</Label>
                <Input id="nome" value={editingTemplate.nome || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, nome: e.target.value })} className="rounded-xl bg-muted/50 border-border" placeholder="Ex: Cobrança Vencimento" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea id="mensagem" rows={6} value={editingTemplate.mensagem || ""} onChange={(e) => setEditingTemplate({ ...editingTemplate, mensagem: e.target.value })} className="rounded-xl bg-muted/50 border-border resize-none" placeholder="Escreva a mensagem aqui... Use {nome}, {vencimento}, {valor}..." />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeModal} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} className="rounded-xl font-bold" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>O template "{toDelete?.nome}" será removido permanentemente. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}>{deleteMutation.isPending ? "Excluindo..." : "Excluir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
