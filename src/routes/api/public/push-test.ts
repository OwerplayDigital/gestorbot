import { createFileRoute } from "@tanstack/react-router";

// Envio de teste. Protegido pelo PUSH_TEST_KEY no header x-admin-key.
export const Route = createFileRoute("/api/public/push-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-admin-key");
        const expected = process.env['PUSH_TEST_KEY'];
        if (!key || !expected || key !== expected) return new Response("Unauthorized", { status: 401 });
        const { sendFcm } = await import("@/lib/fcm.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as any)
          .from("push_tokens")
          .select("token")
          .order("updated_at", { ascending: false })
          .limit(1);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        const token = data?.[0]?.token;
        if (!token) return Response.json({ tokenFound: false }, { status: 404 });
        try {
          const r = await sendFcm(token, "Owerplay Gestor", "Notificações ativadas com sucesso!");
          return Response.json({ tokenFound: true, ...r }, { status: r.ok ? 200 : 502 });
        } catch (e) {
          return Response.json({ tokenFound: true, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
