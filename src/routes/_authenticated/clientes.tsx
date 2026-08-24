import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Users, Search, ChevronLeft, ChevronRight, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/clientes')({
  component: ClientesPage,
});

function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const itemsPerPage = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['clients-active', searchTerm, currentPage],
    queryFn: async () => {
      const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
      nowBr.setHours(0, 0, 0, 0);
      const todayStr = format(nowBr, 'yyyy-MM-dd');

      // Primeiro, buscamos os servidores para mapeamento
      const { data: servers } = await supabase.from('servidores_iptv').select('id, name');
      
      // Buscamos os templates
      const { data: templates } = await supabase.from('templates_whatsapp' as any).select('*').order('nome', { ascending: true });

      let query = supabase
        .from('clientes')
        .select('*, plans(name, price)', { count: 'exact' })
        .gte('vencimento', todayStr)
        .order('vencimento', { ascending: true });

      if (searchTerm) {
        query = query.ilike('nome', `%${searchTerm}%`);
      }

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      const { data: clients, count, error } = await query.range(from, to);

      if (error) throw error;

      const processedClients = (clients || []).map(c => {
        const serverNames = (c.servidores_ids || [])
          .map((id: string) => servers?.find(s => s.id === id)?.name)
          .filter(Boolean)
          .join(', ');

        return {
          ...c,
          serverName: serverNames || 'N/A',
          templates: templates || []
        };
      });

      return {
        clients: processedClients,
        totalCount: count || 0
      };
    },
  });

  const totalPages = Math.ceil((data?.totalCount || 0) / itemsPerPage);

  const openMessageModal = (client: any) => {
    if (!client.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado.");
      return;
    }
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleSendMessage = (template: any) => {
    if (!selectedClient) return;

    let message = template.mensagem;
    const firstName = selectedClient.nome.split(' ')[0];
    const valor = selectedClient.plans ? (Number(selectedClient.plans.price) - Number(selectedClient.desconto || 0)).toFixed(2) : "0.00";
    
    message = message
      .replace(/{nome}/g, selectedClient.nome)
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{vencimento}/g, selectedClient.vencimento)
      .replace(/{valor}/g, `R$ ${valor}`);

    const phone = selectedClient.whatsapp.replace(/\D/g, '');
    const encodedMsg = encodeURIComponent(message);
    const url = `https://wa.me/55${phone}?text=${encodedMsg}`;
    
    setIsModalOpen(false);
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
            <Users className="text-primary" />
            Clientes
          </h1>
          <p className="text-muted-foreground">Listagem de clientes ativos e em dia.</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Buscar por nome..." 
            className="pl-10 bg-card border-border rounded-xl h-11"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-8 text-center text-muted-foreground">
          Carregando clientes...
        </div>
      ) : !data?.clients || data.clients.length === 0 ? (
        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-8 text-center text-muted-foreground">
          Nenhum cliente ativo encontrado.
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-muted/10">
                  <TableHead className="font-bold">Cliente</TableHead>
                  <TableHead className="font-bold">Servidor/App</TableHead>
                  <TableHead className="font-bold">Vencimento</TableHead>
                  <TableHead className="text-right font-bold">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.clients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/50 border-muted/10 transition-colors">
                    <TableCell className="font-bold">{client.nome}</TableCell>
                    <TableCell className="text-xs">{client.serverName}</TableCell>
                    <TableCell>
                      <span className="text-primary font-bold font-mono">
                        {client.vencimento && client.vencimento.includes('-') 
                          ? format(parseISO(client.vencimento), 'dd/MM/yyyy') 
                          : client.vencimento}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => openMessageModal(client)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-8 px-3 gap-2"
                      >
                        <MessageCircle size={14} />
                        Mensagem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-4">
            {data.clients.map((client) => (
              <div 
                key={client.id} 
                className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-lg uppercase leading-tight">{client.nome}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{client.serverName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="text-primary font-bold font-mono">
                    {client.vencimento && client.vencimento.includes('-') 
                      ? format(parseISO(client.vencimento), 'dd/MM/yyyy') 
                      : client.vencimento}
                  </span>
                </div>

                <Button 
                  onClick={() => openMessageModal(client)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-11 gap-2"
                >
                  <MessageCircle size={18} />
                  Mensagem
                </Button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground font-medium">
                Página <span className="text-foreground font-bold">{currentPage}</span> de <span className="text-foreground font-bold">{totalPages}</span>
              </span>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="rounded-xl border-border bg-card hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="rounded-xl border-border bg-card hover:bg-muted"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#131B2E] border-border dark:border-slate-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">
              Selecionar Mensagem
            </DialogTitle>
            <DialogDescription>
              Escolha um template para enviar para {selectedClient?.nome}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            {selectedClient?.templates?.length > 0 ? (
              selectedClient.templates.map((template: any) => (
                <Button
                  key={template.id}
                  variant="outline"
                  onClick={() => handleSendMessage(template)}
                  className="justify-between h-14 px-4 border-muted/20 hover:border-emerald-500 hover:bg-emerald-500/5 group transition-all rounded-xl"
                >
                  <span className="font-bold uppercase text-sm tracking-wide">{template.nome}</span>
                  <Send size={16} className="text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                </Button>
              ))
            ) : (
              <p className="text-center py-4 text-muted-foreground text-sm">
                Nenhum template cadastrado em 'Mensagens'.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
