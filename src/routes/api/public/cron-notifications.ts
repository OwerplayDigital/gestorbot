import { createFileRoute } from "@tanstack/react-router";

// Notificações agendadas dependem de um servidor e ficam desativadas na edição pessoal local.
export const Route = createFileRoute("/api/public/cron-notifications")({
  server: { handlers: { GET: async () => Response.json({ available: false, mode: "local", message: "Notificações automáticas exigem um serviço externo." }, { status: 501 }) } },
});
