# Plano de Ação: Correção de Navegação e Performance

Este plano visa corrigir o comportamento do menu lateral (sidebar) e otimizar a performance da tela de revendedores, garantindo uma experiência fluida e sem travamentos.

## Problema 1: Barra Lateral (Sidebar)
O menu lateral permanece aberto após a navegação em dispositivos móveis, obstruindo a visão da nova página.

### Ações
- Modificar o componente `RootShell` em `src/routes/__root.tsx` para controlar o estado de abertura do `Sheet` (menu lateral).
- Implementar o fechamento automático do menu no componente `NavLink` ao detectar um clique.
- Garantir que a navegação ocorra "por cima", fechando o menu antes da mudança de rota ser percebida como travada.

## Problema 2: Performance na Tela de Revendedores
A tela `/revendedores` apresenta lentidão, possivelmente devido a consultas pesadas ao Supabase dentro do loop de renderização ou excesso de re-renderizações.

### Ações
- Otimizar a consulta principal de revendedores em `src/routes/_authenticated/servidores.tsx`.
- Mover a lógica de agregação de créditos para uma consulta única ou otimizar o processamento no frontend.
- Revisar os modais (`ResellerDetailsModal`, `ResellerModal`, `ResellerReloadModal`) para evitar renderizações desnecessárias quando não estão visíveis.
- Adicionar estados de carregamento mais leves e garantir que os dados sejam buscados de forma eficiente usando o cache do React Query.

## Detalhes Técnicos
- **Sidebar:** Utilizar `useState` para `isMenuOpen` no `RootShell` e passá-lo para `SidebarContent`.
- **Performance:** Avaliar se o `useQuery` em `servidores.tsx` pode ser simplificado. Atualmente ele faz processamento pesado de `map/filter/reduce` em cada renderização dos dados da query.
- **RLS e Queries:** Garantir que as queries ao Supabase não estejam causando gargalos por falta de índices ou joins desnecessários.