import { createFileRoute } from "@tanstack/react-router";

// Push remoto exige credenciais e infraestrutura externa; não é usado no modo pessoal local.
export const Route = createFileRoute("/api/public/push-test")({
  server: { handlers: { POST: async () => Response.json({ available: false, mode: "local", message: "Push remoto indisponível na edição local." }, { status: 501 }) } },
});
