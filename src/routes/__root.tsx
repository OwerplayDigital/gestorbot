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
import { Menu, ChartBar } from "lucide-react";
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
      { title: "Owerplay Gestor - IPTV" },
      { name: "description", content: "Sistema inteligente para revendedores de IPTV." },
      { property: "og:site_name", content: "OWERPLAY TV" },
      { property: "og:title", content: "OWERPLAY Gestor" },
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

function RootShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isCheckoutPage = router.state.location.pathname.startsWith('/pagar/');
  const isMaintenancePage = router.state.location.pathname === '/';

  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <div className="flex flex-col min-h-screen">
          {/* Header Mobile-First - Hidden on Checkout and Maintenance Pages */}
          {!isCheckoutPage && !isMaintenancePage && (
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container flex h-14 items-center px-4 gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px]">
                    <SheetHeader>
                      <SheetTitle className="text-left flex items-center gap-2">
                        <img src={gestorLogo.url} alt="Logo" className="h-6 w-6 rounded-md object-cover" />
                        Owerplay Gestor
                      </SheetTitle>
                    </SheetHeader>
                    <nav className="flex flex-col gap-4 mt-8">
                      <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors px-2 py-1">Dashboard</Link>
                      <Link to="/clientes" className="text-sm font-medium hover:text-primary transition-colors px-2 py-1">Clientes</Link>
                      <Link to="/settings" className="text-sm font-medium hover:text-primary transition-colors px-2 py-1">Configurações</Link>
                      <Link to="/" className="text-sm font-medium hover:text-primary transition-colors px-2 py-1">Sair</Link>
                    </nav>
                  </SheetContent>
                </Sheet>
                <Link to="/dashboard" className="flex items-center gap-2 font-bold tracking-tighter text-lg">
                  <img src={gestorLogo.url} alt="Logo" className="h-7 w-7 rounded-md object-cover" />
                  <span className="inline-block">Owerplay Gestor</span>
                </Link>
              </div>
            </header>
          )}

          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
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
