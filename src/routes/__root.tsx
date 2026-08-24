import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { 
  Menu, 
  LayoutDashboard, 
  DollarSign, 
  AlertTriangle, 
  Users, 
  LogOut,
  Settings,
  Circle,
  MessageSquare,
  Clock
} from "lucide-react";
import gestorLogo from "@/assets/gestor-logo.png.asset.json";

import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao Início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Erro ao carregar página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente atualizar ou voltar para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "GESTOR PRO - IPTV" },
      { name: "description", content: "Sistema inteligente para revendedores de IPTV." },
      { property: "og:site_name", content: "GESTOR PRO" },
      { property: "og:title", content: "GESTOR PRO" },
      { property: "og:description", content: "Controle sua operação IPTV mobile-first." },
      { property: "og:image", content: "https://gestorbot.lovable.app/og-preview.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function NavLink({ to, icon: Icon, children, badge, onClick }: { to: string; icon: any; children: ReactNode; badge?: string; onClick?: (() => void) | undefined }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeProps={{ className: "bg-primary/10 text-primary border-primary/20" }}
      inactiveProps={{ className: "text-muted-foreground hover:bg-muted transition-colors" }}
      className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold border border-transparent"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} />
        {children}
      </div>
      {badge && (
        <Badge variant="secondary" className="bg-card border-border text-[10px] font-black h-5 px-1.5 min-w-[20px] justify-center">
          {badge}
        </Badge>
      )}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-8 flex items-center gap-2">
        <img src={gestorLogo.url} alt="Logo" className="h-8 w-8 rounded-xl object-cover" />
        <span className="text-xl font-black tracking-tighter text-foreground">GESTOR PRO</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <NavLink to="/dashboard" icon={LayoutDashboard} onClick={onNavigate}>Dashboard</NavLink>
        <NavLink to="/financeiro" icon={DollarSign} badge="12" onClick={onNavigate}>Financeiro</NavLink>
        <NavLink to="/clientes" icon={Users} onClick={onNavigate}>Clientes</NavLink>
        <NavLink to="/vencidos" icon={Clock} onClick={onNavigate}>Vencidos</NavLink>
        <NavLink to="/mensagens" icon={MessageSquare} onClick={onNavigate}>Mensagens</NavLink>
        {/* Removido Configurações conforme solicitado */}
      </nav>

      <div className="px-3 pt-6 border-t border-border mt-auto space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-500 bg-emerald-500/10 rounded-xl">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          Bot Conectado
        </div>

        <Link 
          to="/" 
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
        >
          <LogOut size={18} />
          Sair
        </Link>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isCheckoutPage = router.state.location.pathname.startsWith('/pagar/');
  const isMaintenancePage = router.state.location.pathname === '/';
  

  if (isCheckoutPage || isMaintenancePage) {
    return (
      <html lang="pt-BR" className="light">
        <head>
          <HeadContent />
        </head>
        <body className="antialiased bg-background">
          <main className="flex-1">
            {children}
          </main>
          <Scripts />
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR" className="light">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased bg-background">
        <div className="flex min-h-screen bg-background">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar shrink-0">
            <SidebarContent />
          </aside>

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Header Mobile/Tablet & Theme Toggle */}
            <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-16 items-center justify-between px-4 lg:px-8">
                <div className="flex items-center gap-4">
                  <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="lg:hidden">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r border-border">
                      <SidebarContent onNavigate={() => setIsSheetOpen(false)} />
                    </SheetContent>
                  </Sheet>
                  
                  {/* Title or Breadcrumb could go here, but user asked for Theme Toggle in header */}
                  <h2 className="hidden lg:block text-sm font-bold text-muted-foreground uppercase tracking-widest">Painel Administrativo</h2>
                  <div className="lg:hidden flex items-center gap-2">
                    <img src={gestorLogo.url} alt="Logo" className="h-6 w-6 rounded-lg" />
                    <span className="font-black tracking-tighter">GESTOR PRO</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  {/* Removido Configurações conforme solicitado */}
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
