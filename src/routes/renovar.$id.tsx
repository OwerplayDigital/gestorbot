import { createFileRoute } from '@tanstack/react-router';
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check } from 'lucide-react';
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
  const brDate = client.vencimento ? new Date(client.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '--/--/----';
  const primeiroNome = client.nome ? client.nome.trim().split(' ')[0] : 'Cliente';

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-8 flex flex-col items-center selection:bg-blue-500/30">
      <div className="w-full max-w-md space-y-8">
        {/* LOGO CENTRALIZADA */}
        <div className="flex flex-col items-center mt-4">
           <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-slate-400 rounded-full flex items-center justify-center mb-4 shadow-2xl shadow-blue-500/20 border-2 border-slate-700/50">
              <span className="text-3xl font-black text-white italic tracking-tighter">OP</span>
           </div>
           <h1 className="text-3xl font-black text-white tracking-[0.2em] italic">OWERPLAY TV</h1>
           <div className="h-1 w-12 bg-blue-500 rounded-full mt-2 opacity-50"></div>
        </div>

        {/* CARD CENTRAL PREMIUM */}
        <Card className="bg-slate-900/40 border-slate-800/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          
          <CardHeader className="text-center pb-0 pt-8">
            <h2 className="text-blue-400 text-lg font-semibold mb-1">Olá, {primeiroNome}</h2>
            <p className="text-slate-500 text-xs uppercase tracking-widest">Seu vencimento é em {brDate}</p>
          </CardHeader>

          <CardContent className="flex flex-col items-center space-y-8 p-8">
            <div className="flex flex-col items-center">
              <span className="text-slate-500 text-xs font-bold uppercase tracking-tighter mb-1 opacity-50">Valor da Renovação</span>
              <div className="text-6xl font-black text-white tracking-tighter flex items-start">
                <span className="text-xl font-medium text-blue-500 mt-2 mr-1">R$</span>
                {valorFinal}
              </div>
            </div>
            
            <div className="w-full space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Banco</span>
                    <span className="text-sm font-semibold text-slate-300">Nubank</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Favorecido</span>
                    <span className="text-sm font-semibold text-slate-300">Diego Felix Owerney</span>
                  </div>
                </div>

                <div 
                  onClick={copyPix}
                  className="w-full bg-slate-950/50 border border-slate-800/80 p-5 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 hover:bg-slate-900 transition-all active:scale-[0.98] group relative"
                >
                  <span className="text-[10px] text-slate-600 font-bold uppercase mb-2 group-hover:text-blue-400/70 transition-colors">Chave Pix (E-mail)</span>
                  <code className="text-blue-400 font-mono text-lg font-bold">82iptv@gmail.com</code>
                  <div className="absolute bottom-2 right-4 opacity-30 group-hover:opacity-100 transition-opacity">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>
              </div>

              <Button 
                onClick={copyPix}
                className={`w-full h-16 rounded-2xl font-black text-lg shadow-xl transition-all ${
                  copied 
                  ? 'bg-green-600 hover:bg-green-600 text-white scale-[1.02]' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/20'
                }`}
              >
                {copied ? (
                  <><Check className="mr-2 w-6 h-6" /> ✅ Chave Copiada com Sucesso!</>
                ) : (
                  <><Copy className="mr-2 w-5 h-5" /> 📋 Copiar Chave PIX</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AVISO E PROPAGANDA */}
        <div className="space-y-6">
          <p className="text-center text-[11px] text-slate-500 font-medium px-8 leading-relaxed italic">
            Após o pagamento, envie o comprovante no WhatsApp do suporte para ativação imediata.
          </p>

          <Card className="bg-blue-600/5 border-blue-500/10 border-dashed relative overflow-hidden">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center gap-2 mb-3 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">🎁 GANHE 1 MÊS GRÁTIS!</span>
              </div>
              <h3 className="text-white font-bold text-sm mb-2">Indique e Ganhe</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed max-w-[280px] mx-auto font-medium">
                Indique um amigo ou parente. Se ele fechar qualquer plano com a gente, sua próxima renovação é 100% por nossa conta!
              </p>
            </CardContent>
          </Card>
        </div>

        <footer className="pt-8 pb-8 text-center">
          <p className="text-slate-700 text-[9px] font-black uppercase tracking-[0.4em] opacity-50">Owerplay Gestor • High Performance</p>
        </footer>
      </div>
    </div>
  );
}
