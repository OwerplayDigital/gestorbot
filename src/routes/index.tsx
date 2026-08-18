import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Gestão IPTV</CardTitle>
          <CardDescription>Mecanismo de Provisionamento Administrativo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Acesse com sua conta Google para criar sua identidade administrativa.
              </p>
              <Button onClick={handleGoogleLogin} className="w-full" variant="outline">
                Entrar com Google
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-md break-all">
                <p className="text-xs font-mono text-secondary-foreground mb-1 font-bold">Status: AUTENTICADO</p>
                <p className="text-xs font-mono text-secondary-foreground">UUID: {user.id}</p>
                <p className="text-xs font-mono text-secondary-foreground">Email: {user.email}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Copie o UUID acima para vincular ao Telegram.
              </p>
              <Button onClick={handleLogout} className="w-full" variant="ghost">
                Sair
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8 text-xs text-muted-foreground max-w-sm text-center">
        Página de acesso mínima para provisionamento do primeiro administrador via Supabase Auth.
      </div>
    </div>
  );
}

