import { createFileRoute } from "@tanstack/react-router";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-4">Gestão IPTV</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        Fundação do sistema concluída com sucesso. Banco de dados e segurança configurados.
      </p>
      <div className="bg-card border rounded-lg p-6 shadow-sm max-w-lg w-full text-left">
        <h2 className="text-xl font-semibold mb-4">Status da Fundação</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">✅ Tabelas criadas (plans, servidores, clientes, transacoes, renovacoes)</li>
          <li className="flex items-center gap-2">✅ Relacionamentos e Chaves Estrangeiras configurados</li>
          <li className="flex items-center gap-2">✅ RLS e Políticas de Segurança ativos (Isolamento por UUID)</li>
          <li className="flex items-center gap-2">✅ Índices de performance criados</li>
          <li className="flex items-center gap-2">✅ Autenticação Social (Google) habilitada</li>
          <li className="flex items-center gap-2 text-primary font-medium">🚀 Núcleo do Bot Telegram integrado (Webook pronto)</li>
          <li className="flex items-center gap-2">⚠️ Configure TELEGRAM_BOT_TOKEN nos segredos do projeto</li>
        </ul>
      </div>
    </div>
  );
}
