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
import { Phone, Clock, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/vencidos')({
  component: VencidosPage,
});

function VencidosPage() {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients-expired'],
    queryFn: async () => {
      // Buscamos clientes, servidores e templates em paralelo
      const [clientsRes, serversRes, templatesRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('*, plans(name, price)')
          .order('vencimento', { ascending: true }),
        supabase
          .from('servidores_iptv')
          .select('id, name'),
        supabase
          .from('templates_whatsapp' as any)
          .select('*')
          .order('nome', { ascending: true })
      ]);

      if (clientsRes.error) throw clientsRes.error;
      
      const nowBr = toZonedTime(new Date(), 'America/Sao_Paulo');
      nowBr.setHours(0, 0, 0, 0);
      const todayStr = format(nowBr, 'yyyy-MM-dd');

      const expired = (clientsRes.data || []).filter(c => {
        const vencStr = c.vencimento;
        if (!vencStr) return false;
        
        const isoVenc = vencStr.includes('/') 
          ? vencStr.split('/').reverse().join('-') 
          : vencStr;
        return isoVenc < todayStr;
      }).map(c => {
        const vencStr = c.vencimento!;
        const isoVenc = vencStr.includes('/') 
          ? vencStr.split('/').reverse().join('-') 
          : vencStr;
        const vencDate = parseISO(isoVenc);
        const diff = differenceInDays(nowBr, vencDate);
        
        // Mapear nomes dos servidores
        const serverNames = (c.servidores_ids || [])
          .map((id: string) => serversRes.data?.find(s => s.id === id)?.name)
          .filter(Boolean)
          .join(', ');

        return {
          ...c,
          daysOverdue: diff,
          serverName: serverNames || 'N/A',
          templates: templatesRes.data || []
        };
      });

      return expired;
    },
  });

  const openChargeModal = (client: any) => {
    if (!client.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado.");
      return;
    }
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleCharge = (template: any) => {
    if (!selectedClient) return;

    let message = template.mensagem;
    const firstName = selectedClient.nome.split(' ')[0];
    const valor = selectedClient.plans ? (Number(selectedClient.plans.price) - Number(selectedClient.desconto || 0)).toFixed(2) : "0.00";
    
    // Substituir variáveis
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
      <div>
        <h1 className="text-3xl font-black tracking-tighter uppercase flex items-center gap-2">
          <Clock className="text-rose-500" />
          Vencidos
        </h1>
        <p className="text-muted-foreground">Clientes com assinatura expirada aguardando renovação.</p>
      </div>

      {isLoading ? (
        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-8 text-center text-muted-foreground">
          Carregando lista de vencidos...
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-8 text-center text-muted-foreground">
          Nenhum cliente vencido hoje. 🎉
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
                  <TableHead className="font-bold">Atraso</TableHead>
                  <TableHead className="text-right font-bold">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-muted/50 border-muted/10 transition-colors">
                    <TableCell className="font-bold">{client.nome}</TableCell>
                    <TableCell className="text-xs">{client.serverName}</TableCell>
                    <TableCell>
                      <span className="text-rose-500 font-bold font-mono">
                        {client.vencimento && client.vencimento.includes('-') 
                          ? format(parseISO(client.vencimento), 'dd/MM/yyyy') 
                          : client.vencimento}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                        {client.daysOverdue} dias
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        onClick={() => openChargeModal(client)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-8 px-3 gap-2"
                      >
                        <MessageCircle size={14} />
                        Cobrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View (Cards) */}
          <div className="md:hidden space-y-4">
            {clients.map((client) => (
              <div 
                key={client.id} 
                className="bg-card dark:bg-[#131B2E] border border-border dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-lg uppercase leading-tight">{client.nome}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{client.serverName}</p>
                  </div>
                  <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap">
                    {client.daysOverdue} dias
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="text-rose-500 font-bold font-mono">
                    {client.vencimento && client.vencimento.includes('-') 
                      ? format(parseISO(client.vencimento), 'dd/MM/yyyy') 
                      : client.vencimento}
                  </span>
                </div>

                <Button 
                  onClick={() => openChargeModal(client)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-11 gap-2"
                >
                  <MessageCircle size={18} />
                  Cobrar
                </Button>
              </div>
            ))}
          </div>
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
                  onClick={() => handleCharge(template)}
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
