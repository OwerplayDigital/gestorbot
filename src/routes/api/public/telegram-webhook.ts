import { createFileRoute } from '@tanstack/react-router'

// Integração removida. Mantemos temporariamente a rota inerte para preservar a árvore gerada até o próximo build.
export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async () => new Response(null, { status: 410 }),
      GET: async () => new Response(null, { status: 410 }),
    },
  },
})
