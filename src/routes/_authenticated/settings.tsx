import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Bell, Shield, Smartphone, Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [isTesting, setIsTesting] = useState(false);

  const testDailyNotification = async () => {
    setIsTesting(true);
    try {
      // Chamada direta para a nova rota de cron que criamos
      const response = await fetch('/api/public/cron-notifications');
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Teste concluído! Processados: ${data.processed}, Enviados: ${data.sent}`);
      } else {
        toast.error("Ocorreu um erro no processamento do teste.");
      }
    } catch (error) {
      console.error("Erro ao testar notificação:", error);
      toast.error("Falha ao conectar com o serviço de notificação.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 pb-12 max-w-lg mx-auto md:max-w-4xl">
      <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
        <Settings className="h-6 w-6 text-owerplay-cyan" />
        CONFIGURAÇÕES
      </h1>

      <div className="grid gap-4">
        <Card className="bg-card border-none shadow-md overflow-hidden">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-owerplay-cyan" />
              <CardTitle className="text-lg">Notificações Automáticas</CardTitle>
            </div>
            <CardDescription>
              Gerencie os disparos diários e avisos de vencimento via Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="space-y-1">
                <p className="text-sm font-bold">Resumo Matinal (09:00 BRT)</p>
                <p className="text-xs text-muted-foreground">Envia a lista de clientes que vencem no dia atual.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-owerplay-cyan/50 text-owerplay-cyan hover:bg-owerplay-cyan/10"
                onClick={testDailyNotification}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-2 fill-current" />
                    Testar Agora
                  </>
                )}
              </Button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-1">Nota Técnica</p>
              <p className="text-xs text-muted-foreground">
                O agendamento segue o fuso <b>America/Sao_Paulo (UTC-3)</b>. Se o resumo não chegar, verifique se o seu Chat ID está vinculado corretamente.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-none shadow-md overflow-hidden opacity-50 grayscale pointer-events-none">
          <CardHeader className="bg-muted/50 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Segurança</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outras configurações em breve.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
