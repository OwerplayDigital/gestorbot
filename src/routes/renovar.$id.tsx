import { createFileRoute } from '@tanstack/react-router';
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, MessageSquare, Gift } from 'lucide-react';
import { toast } from "sonner";

export const Route = createFileRoute('/renovar/$id')({
  head: () => ({
    meta: [
      { property: "og:title", content: "OWERPLAY TV" },
      { property: "og:description", content: "Renove seu acesso de forma rápida e segura." },
      { property: "og:image", content: "https://i.imgur.com/3YpX9ZT.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RenewPage,
});

function RenewPage() {
  const { id } = Route.useParams();
  const [client, setClient] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: c, error: ce } = await supabase
          .from('clientes')
          .select('*, plans(*)')
          .eq('id', id)
          .single();
        
        if (ce) throw ce;
        setClient(c);
        setPlan(c.plans);
      } catch (err) {
        console.error("Erro ao buscar cliente:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const copyPix = () => {
    navigator.clipboard.writeText("82iptv@gmail.com");
    setCopied(true);
    toast.success("Chave Pix copiada!");
    setTimeout(() => setCopied(false), 2000);
  };


  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Carregando...</div>;
  if (!client) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Cliente não encontrado.</div>;

  const planPrice = Number(plan?.price || plan?.preco || plan?.valor || 0);
  const discount = Number(client.desconto || 0);
  const valorFinal = Math.max(0, planPrice - discount).toFixed(2).replace('.', ',');

  const shareText = encodeURIComponent(
    `Olá! Gostaria de indicar um amigo para a promoção Indique e Ganhe Mês Grátis!`
  );
  const supportNumber = "5582981148560";
  const whatsappSupportLink = `https://wa.me/${supportNumber}?text=${shareText}`;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center mb-8">
           <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <span className="text-2xl font-bold text-white">OP</span>
           </div>
           <h1 className="text-2xl font-bold text-white tracking-tight">OWERPLAY TV</h1>
           <p className="text-slate-400 text-sm">Sua diversão em alta definição</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-slate-400 text-sm font-medium uppercase tracking-wider">Valor da Renovação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="text-5xl font-extrabold text-white">
              <span className="text-2xl font-normal text-slate-400 mr-1">R$</span>
              {valorFinal}
            </div>
            
            <div className="w-full pt-4 space-y-3">
              <p className="text-center text-sm text-slate-400">Pague via Pix usando a chave abaixo:</p>
              <div 
                onClick={copyPix}
                className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-colors group"
              >
                <code className="text-blue-400 font-medium">82iptv@gmail.com</code>
                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2">
          <p className="text-sm text-slate-400 px-4">
            Após o pagamento, envie o comprovante no WhatsApp do suporte para ativação imediata.
          </p>
          <Button 
            onClick={() => window.open(`https://wa.me/5582981148560?text=${encodeURIComponent(`Comprovante de pagamento: ${client.nome}`)}`, '_blank')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 rounded-xl"
          >
            <MessageSquare className="mr-2 w-5 h-5" /> Enviar Comprovante
          </Button>
        </div>

        {/* Indique e Ganhe Card */}
        <Card className="bg-blue-600/10 border-blue-500/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Gift size={80} />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase tracking-tighter">🎁 GANHE 1 MÊS GRÁTIS!</span>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Indique e Ganhe</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Indique um amigo ou parente. Se ele fechar qualquer plano com a gente, sua próxima renovação é 100% por nossa conta!
            </p>
            <Button 
              onClick={() => window.open(whatsappSupportLink, '_blank')}
              variant="outline"
              className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all font-semibold"
            >
              <MessageSquare className="mr-2 w-4 h-4" /> 📲 Indicar Amigo no WhatsApp
            </Button>
          </CardContent>
        </Card>

        <footer className="pt-8 pb-4 text-center">
          <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">Owerplay Gestor • Sistema Seguro</p>
        </footer>
      </div>
    </div>
  );
}
