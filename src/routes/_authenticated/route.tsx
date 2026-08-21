import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw redirect({
          to: "/",
          search: {
            admin: 'false',
            redirect: location.href,
          },
        });

      }
    } catch (error) {
      console.error("Erro na verificação de autenticação:", error);
      throw redirect({
        to: "/",
        search: {
          admin: 'false',
          redirect: location.href,
        },
      });

    }
  },
  component: () => <Outlet />,
});
