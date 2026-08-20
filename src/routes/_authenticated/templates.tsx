import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, Save, X, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

type Template = {
  id: string;
  name: string;
  content: string;
  type: 'cobrança' | 'renovação' | 'personalizado';
  is_default: boolean;
};

function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    type: "personalizado" as Template['type'],
  });

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .order('created_at', { ascending: true });

    if (error) {
      toast.error("Erro ao carregar templates");
    } else {
      setTemplates((data || []).map(t => ({
        ...t,
        type: (t.type as any) || 'personalizado',
        is_default: !!t.is_default
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      toast.error("Preencha todos os campos");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      ...formData,
      user_id: user.id,
    };

    let error;
    if (editingId) {
      const { error: err } = await supabase
        .from("message_templates")
        .update(payload)
        .eq("id", editingId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("message_templates")
        .insert([payload]);
      error = err;
    }

    if (error) {
      toast.error("Erro ao salvar template");
    } else {
      toast.success(editingId ? "Template atualizado" : "Template criado");
      setIsDialogOpen(false);
      resetForm();
      fetchTemplates();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir template");
    } else {
      toast.success("Template excluído");
      fetchTemplates();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", content: "", type: "personalizado" });
    setEditingId(null);
  };

  const startEdit = (template: Template) => {
    setFormData({
      name: template.name,
      content: template.content,
      type: template.type,
    });
    setEditingId(template.id);
    setIsDialogOpen(true);
  };

  return (
    <div className="container p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#06b6d4]">Templates de Mensagens</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus modelos para o Telegram</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-[#06b6d4] hover:bg-[#06b6d4]/80 text-black">
              <Plus className="h-4 w-4 mr-2" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Template" : "Novo Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Cobrança Padrão" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select 
                  id="type"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                >
                  <option value="personalizado">Personalizado</option>
                  <option value="cobrança">Cobrança</option>
                  <option value="renovação">Renovação</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Conteúdo da Mensagem</Label>
                </div>
                <Textarea 
                  id="content" 
                  placeholder="Escreva sua mensagem..." 
                  className="min-h-[150px]"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                />
              </div>
              <Card className="bg-accent/50 border-none">
                <CardContent className="p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-[#06b6d4] mb-1">
                    <Info className="h-3 w-3" /> Variáveis Disponíveis
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span><code className="bg-background px-1 rounded">{'{nome}'}</code> - Nome</span>
                    <span><code className="bg-background px-1 rounded">{'{vencimento}'}</code> - Data</span>
                    <span><code className="bg-background px-1 rounded">{'{valor}'}</code> - Valor</span>
                    <span><code className="bg-background px-1 rounded">{'{chave_pix}'}</code> - Pix</span>
                    <span><code className="bg-background px-1 rounded">{'{servidor}'}</code> - Servidor</span>
                    <span><code className="bg-background px-1 rounded">{'{plano}'}</code> - Plano</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-[#06b6d4] text-black hover:bg-[#06b6d4]/80">
                <Save className="h-4 w-4 mr-2" /> Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Carregando templates...</div>
        ) : templates.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              Nenhum template cadastrado ainda.
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.type !== 'personalizado' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30 uppercase font-bold">
                      {template.type}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => startEdit(template)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="bg-accent/30 p-3 rounded-md text-sm whitespace-pre-wrap font-mono text-muted-foreground line-clamp-3">
                  {template.content}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
