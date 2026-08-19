# Plano: Funcionalidade de Exclusão de Transações no Gestor Web

Adicionar a capacidade de excluir lançamentos financeiros diretamente da dashboard, com confirmação de segurança e atualização imediata das métricas.

## Ações
- [ ] **Interface**: Adicionar botão de lixeira (Lucide `Trash2`) em cada linha do "Extrato Recente" no Dashboard.
- [ ] **Segurança**: Integrar o componente `AlertDialog` para solicitar confirmação do usuário antes de proceder com a exclusão.
- [ ] **Lógica de Dados**: Criar uma função para remover a transação da tabela `transacoes` via Supabase client.
- [ ] **Feedback**: Utilizar `sonner` para exibir notificações de sucesso ou erro.
- [ ] **Reatividades**: Disparar o recarregamento automático dos dados (`refetch`) do React Query para atualizar KPIs e gráficos após a exclusão.

## Detalhes Técnicos
- **Arquivo**: `src/routes/_authenticated/dashboard.tsx`
- **Componentes**: `AlertDialog`, `Button`, `Trash2`.
- **Bibliotecas**: `supabase-js`, `@tanstack/react-query`, `sonner`.
- **RLS**: A exclusão respeitará a política `user_id = auth.uid()` já existente na tabela `transacoes`.
