# Plano de Implementação: Gestão de Templates de Mensagens

Implementar sistema de templates no Gestor Web e integração completa no Bot do Telegram.

## 1. Banco de Dados
- Criar tabela `message_templates`:
  - `id` (UUID, PK)
  - `user_id` (UUID, FK para auth.users)
  - `name` (TEXT, ex: "Cobrança")
  - `content` (TEXT, com variáveis)
  - `is_default` (BOOLEAN)
  - `type` (TEXT: 'cobrança', 'renovação', 'personalizado')
- Habilitar RLS e criar políticas:
  - `auth.uid() = user_id` para SELECT, INSERT, UPDATE, DELETE.
- Inserir templates padrão via migration (Cobrança e Renovação).

## 2. Gestor Web (Frontend)
- **Menu Lateral**: Adicionar "Templates" em `src/routes/__root.tsx`.
- **Tela de Templates**: Criar `src/routes/_authenticated/templates.tsx`:
  - Lista de templates.
  - Formulário de criação/edição.
  - Legenda de variáveis: `{nome}`, `{vencimento}`, `{valor}`, `{chave_pix}`, `{servidor}`, `{plano}`.

## 3. Bot do Telegram (Backend)
- **lib/telegram.server.ts**:
  - Função para buscar templates do usuário.
  - Função para processar variáveis no conteúdo do template.
- **api/public/telegram-webhook.ts**:
  - Adicionar botão `[Mensagens]` na ficha do cliente.
  - Implementar fluxo de listagem de templates após clicar em `[Mensagens]`.
  - Vincular botões `[Cobrar]` e `[Renovar]` para usar os templates `is_default` ou do tipo correspondente.

## Detalhes Técnicos
- Utilizar `supabaseAdmin` no backend do Telegram para acessar templates sem sessão de navegador.
- Garantir que apenas templates do `user_id` vinculado ao bot sejam exibidos.
- Templates padrão serão protegidos contra exclusão (opcional, mas recomendado).

