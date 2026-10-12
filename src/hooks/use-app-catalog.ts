import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { APP_CATALOG, normalizeAppName, type AppDefinition } from '@/lib/client-apps';

export function useAppCatalog() {
  return useQuery({
    queryKey: ['application-catalog'], staleTime: 0,
    queryFn: async (): Promise<AppDefinition[]> => {
      const { data, error } = await (supabase as any).from('aplicativos_catalogo').select('nome,icon_url,painel_url').order('nome');
      // O catálogo inicial continua disponível durante a aplicação da migração.
      if (error && !['PGRST205', '42P01'].includes(error.code)) throw error;
      const apps = new Map(APP_CATALOG.map(app => [normalizeAppName(app.name), app]));
      for (const app of data || []) apps.set(normalizeAppName(app.nome), { name: app.nome, icon: app.icon_url || undefined, url: app.painel_url || undefined });
      return Array.from(apps.values());
    },
  });
}
