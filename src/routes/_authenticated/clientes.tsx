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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, Phone, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const Route = createFileRoute('/_authenticated/clientes')({
  component: ClientesPage,
});

function ClientesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const filteredClients = clients?.filter(c => 
    c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.whatsapp?.includes(searchTerm)
  );

  const parseDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return toZonedTime(parseISO(dateStr), 'America/Sao_Paulo');
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">CLIENTES</h1>
          <p className="text-muted-foreground">Gerencie sua base completa de usuários.</p>
        </div>
        <Button className="bg-owerplay-cyan text-background font-bold rounded-xl">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou WhatsApp..." 
          className="pl-10 rounded-2xl bg-card border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-muted/10">
              <TableHead className="font-bold">Cliente</TableHead>
              <TableHead className="font-bold">WhatsApp</TableHead>
              <TableHead className="font-bold">Vencimento</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="text-right font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando clientes...
                </TableCell>
              </TableRow>
            ) : filteredClients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients?.map((client) => {
                const vencDate = parseDate(client.vencimento);
                const isExpired = vencDate && vencDate < toZonedTime(new Date(), 'America/Sao_Paulo');
                
                return (
                  <TableRow key={client.id} className="hover:bg-muted/50 border-muted/10 transition-colors">
                    <TableCell className="font-bold">{client.nome}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {client.whatsapp || "-"}
                    </TableCell>
                    <TableCell>
                      <span className={isExpired ? "text-rose-500 font-bold" : "text-muted-foreground"}>
                        {client.vencimento ? format(parseDate(client.vencimento)!, "dd/MM/yyyy") : "--/--/----"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={client.status === 'ativo' 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : "bg-rose-500/10 text-rose-500 border-rose-500/20"}
                      >
                        {client.status?.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white">
                          <Phone size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground dark:hover:text-white">
                          <Edit size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
