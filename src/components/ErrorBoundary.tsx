import React, { ErrorInfo, ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    reportLovableError(error, { 
      componentStack: errorInfo.componentStack,
      boundary: "global_error_boundary" 
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full border-destructive/20 shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Algo deu errado</CardTitle>
              <CardDescription>
                A aplicação encontrou um erro crítico e não pôde continuar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
              <div className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-[150px]">
                {this.state.error?.message || "Erro desconhecido"}
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => window.location.reload()} variant="default" className="w-full gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Recarregar Página
                </Button>
                <Button onClick={this.handleReset} variant="outline" className="w-full gap-2">
                  <Home className="h-4 w-4" />
                  Voltar ao Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
