import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User as UserIcon, Calendar, Server, RefreshCw, Edit2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format, isToday, isBefore, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOT_TEMPLATES } from "@/lib/templates";

export const Route = createFileRoute("/miniapp")({
  head: () => ({
    title: "Mini App Gestor",
    scripts: [
      { src: "https://telegram.org/js/telegram-web-app.js" }
    ],
    meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" }
    ]
  }),
  component: MiniAppComponent,
});

type Client = {
  id: string;
  nome: string;
  whatsapp: string | null;
  vencimento: string | null;
  servidores_ids: string[] | null;
  status: string | null;
  valor: number | null;
};

type ServerData = {
  id: string;
  name: string;
};

function MiniAppComponent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "expired">("all");
  
  // Edit Modal State
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Client>>({});

  useEffect(() => {
    fetchData();
    // Signal to Telegram that the Mini App is ready
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clientes")
        .select("*")
        .order("nome");

      const { data: serversData, error: serversError } = await supabase
        .from("servidores_iptv")
        .select("id, name");

      if (clientsError) throw clientsError;
      if (serversError) throw serversError;

      setClients(clientsData || []);
      setServers(serversData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = clients.length;
    const venceHoje = clients.filter(c => c.vencimento && isToday(parseISO(c.vencimento))).length;
    const vencidos = clients.filter(c => c.vencimento && isBefore(parseISO(c.vencimento), new Date()) && !isToday(parseISO(c.vencimento))).length;
    return { total, venceHoje, vencidos };
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.whatsapp?.includes(searchTerm));
      
      const date = c.vencimento ? parseISO(c.vencimento) : null;
      if (!date) return filter === "all" && matchesSearch;

      const isExpToday = isToday(date);
      const isOverdue = isBefore(date, new Date()) && !isExpToday;

      if (filter === "today") return matchesSearch && isExpToday;
      if (filter === "expired") return matchesSearch && isOverdue;
      return matchesSearch;
    });
  }, [clients, searchTerm, filter]);

  const handleRenew = async (client: Client) => {
    if (!client.vencimento) return;

    try {
      const currentVenc = parseISO(client.vencimento);
      const nextVenc = addDays(currentVenc, 30);
      const nextVencStr = nextVenc.toISOString().split("T")[0];

      const { error } = await supabase
        .from("clientes")
        .from("clientes")
        .update({ vencimento: nextVencStr })
        .eq("id", client.id);

      if (error) throw error;

      toast.success(`${client.nome} renovado com sucesso!`);
      
      // Copy renewal message
      const serverName = servers.find(s => client.servidores_ids?.includes(s.id))?.name || "IPTV";
      const message = BOT_TEMPLATES.CONFIRMACAO(client.nome, nextVencStr, serverName);
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        toast.info("Mensagem de confirmação copiada!");
      }

      fetchData();
    } catch (error: any) {
      toast.error("Erro ao renovar: " + error.message);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setEditFormData({
      nome: client.nome,
      whatsapp: client.whatsapp,
      vencimento: client.vencimento,
      servidores_ids: client.servidores_ids,
      valor: client.valor
    });
  };

  const saveEdit = async () => {
    if (!editingClient) return;

    try {
      const { error } = await supabase
        .from("clientes")
        .update(editFormData)
        .eq("id", editingClient.id);

      if (error) throw error;

      toast.success("Cliente atualizado!");
      setEditingClient(null);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    }
  };

  const getStatus = (vencimento: string | null) => {
    if (!vencimento) return { label: "Sem data", color: "bg-gray-500", icon: <AlertCircle className="w-4 h-4" /> };
    const date = parseISO(vencimento);
    if (isToday(date)) return { label: "Vence hoje", color: "bg-yellow-500", icon: <Clock className="w-4 h-4" /> };
    if (isBefore(date, new Date())) return { label: "Vencido", color: "bg-red-500", icon: <AlertCircle className="w-4 h-4" /> };
    return { label: "Em dia", color: "bg-green-500", icon: <CheckCircle2 className="w-4 h-4" /> };
  };

  if (loading && clients.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-20">
      {/* Header Summary */}
      <div className="bg-[#1e293b] p-4 sticky top-0 z-10 border-b border-slate-800 shadow-lg">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold">Total</div>
            <div className="text-xl font-bold text-blue-400">{stats.total}</div>
          </div>
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold">Hoje</div>
            <div className="text-xl font-bold text-yellow-400">{stats.venceHoje}</div>
          </div>
          <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-bold">Vencidos</div>
            <div className="text-xl font-bold text-red-400">{stats.vencidos}</div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input 
            placeholder="Buscar por nome ou WhatsApp..."
            className="pl-10 bg-slate-800 border-slate-700 text-white focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            size="sm"
            className={`rounded-full px-4 h-8 text-xs ${filter === "all" ? "bg-blue-600 hover:bg-blue-700" : "border-slate-700 text-slate-300"}`}
            onClick={() => setFilter("all")}
          >
            Todos
          </Button>
          <Button 
            variant={filter === "today" ? "default" : "outline"} 
            size="sm"
            className={`rounded-full px-4 h-8 text-xs ${filter === "today" ? "bg-yellow-600 hover:bg-yellow-700" : "border-slate-700 text-slate-300"}`}
            onClick={() => setFilter("today")}
          >
            Vence Hoje
          </Button>
          <Button 
            variant={filter === "expired" ? "default" : "outline"} 
            size="sm"
            className={`rounded-full px-4 h-8 text-xs ${filter === "expired" ? "bg-red-600 hover:bg-red-700" : "border-slate-700 text-slate-300"}`}
            onClick={() => setFilter("expired")}
          >
            Vencidos
          </Button>
        </div>
      </div>

      {/* Customer List */}
      <div className="p-4 space-y-3">
        {filteredClients.map(client => {
          const status = getStatus(client.vencimento);
          const serverName = servers.find(s => client.servidores_ids?.includes(s.id))?.name || "N/A";

          return (
            <Card key={client.id} className="bg-slate-800 border-slate-700 overflow-hidden shadow-md">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-900/30 p-2 rounded-full">
                      <UserIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100">{client.nome}</h3>
                      <p className="text-xs text-slate-400">{client.whatsapp || "Sem WhatsApp"}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${status.color} text-white`}>
                    {status.icon}
                    {status.label}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>
                      {client.vencimento ? format(parseISO(client.vencimento), "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Server className="w-4 h-4 text-slate-500" />
                    <span className="truncate">{serverName}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-9 gap-2 text-xs border-slate-700 hover:bg-slate-700 text-slate-300"
                    onClick={() => handleEdit(client)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  <Button 
                    className="flex-1 h-9 gap-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => handleRenew(client)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Renovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredClients.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 w-[95%] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input 
                value={editFormData.nome || ""} 
                onChange={e => setEditFormData({...editFormData, nome: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input 
                value={editFormData.whatsapp || ""} 
                onChange={e => setEditFormData({...editFormData, whatsapp: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input 
                type="date"
                value={editFormData.vencimento || ""} 
                onChange={e => setEditFormData({...editFormData, vencimento: e.target.value})}
                className="bg-slate-800 border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label>Servidor</Label>
              <Select 
                value={editFormData.servidores_ids?.[0] || ""} 
                onValueChange={(val) => setEditFormData({...editFormData, servidores_ids: [val]})}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue placeholder="Selecione um servidor" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {servers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-slate-700" onClick={() => setEditingClient(null)}>Cancelar</Button>
            <Button onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
