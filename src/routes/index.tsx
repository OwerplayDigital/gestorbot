import { createFileRoute, useNavigate, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import gestorLogo from "@/assets/gestor-logo.png.asset.json";
import { z } from "zod";

const searchSchema = z.object({
  admin: z.string().optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
});


export const Route = createFileRoute("/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Acesso liberado apenas via porta secreta (?admin=true) no parâmetro raw
  const [isSecretDoorOpen, setIsSecretDoorOpen] = useState(false);

  useEffect(() => {
    // Checagem manual via URL para evitar conflitos de tipagem do TanStack Router
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true') {
        setIsSecretDoorOpen(true);
      }
    }

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Erro ao recuperar sessão:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Erro ao entrar: " + error.message);
    } else {
      navigate({ to: "/dashboard" });
    }
    setSigningIn(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    navigate({ to: "/dashboard" });
    return null;
  }

  // Tela de Manutenção / Mockup (Padrão)
  if (!isSecretDoorOpen) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4 text-center">
        <img src={gestorLogo.url} alt="Logo" className="h-20 w-20 rounded-xl mb-6 shadow-2xl" />
        <h1 className="text-2xl font-bold tracking-tighter mb-2">Sistema em Manutenção</h1>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          Estamos realizando atualizações importantes. Voltaremos em breve.
        </p>
      </div>
    );
  }

  // Tela de Login (Porta Secreta)
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-primary/20 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={gestorLogo.url} alt="Logo" className="h-12 w-12 rounded-lg" />
          </div>
          <CardTitle className="text-2xl font-bold">Acesso Restrito</CardTitle>
          <CardDescription>Identifique-se para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu-email@exemplo.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/50"
              />
            </div>
            <Button type="submit" className="w-full font-bold" disabled={signingIn}>
              {signingIn ? "Validando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
