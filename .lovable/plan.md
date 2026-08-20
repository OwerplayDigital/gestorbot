# Plano de Ação: Correção de Registro de Admin e Notificações

Este plano visa automatizar o vínculo do administrador ao bot do Telegram e garantir que as notificações de vencimento sejam enviadas mesmo que a tabela de autorização esteja vazia.

## Alterações Técnicas

### 1. Vínculo Automático no `/start`
- **Arquivo**: `src/lib/telegram.server.ts`
- **Ação**: Criar a função `bindAdminIfMatching(chatId: number)` que verifica se o `chatId` corresponde à variável de ambiente `TELEGRAM_ALLOWED_USER_ID` (ou `TELEGRAM_ADMIN_ID`). Se corresponder, insere o vínculo na tabela `telegram_authorized_users` usando o primeiro `user_id` administrativo encontrado em `auth.users`.
- **Arquivo**: `src/routes/api/public/telegram-webhook.ts`
- **Ação**: Chamar `bindAdminIfMatching(chatId)` logo no início do processamento de mensagens e comandos.

### 2. Fallback de Notificações Cron
- **Arquivo**: `src/routes/api/public/cron-notifications.ts`
- **Ação**: 
  - Se a consulta à tabela `telegram_authorized_users` retornar vazia, a função buscará o `chatId` da variável de ambiente.
  - O sistema buscará o primeiro `user_id` de `auth.users` para filtrar os clientes vinculados a esse administrador.
  - Garantirá que o relatório seja enviado para o ID de ambiente caso não haja registros no banco.

### 3. Disparo de Teste
- **Ação**: Após a implementação, realizar uma chamada `curl` para o endpoint `/api/public/cron-notifications?test=true` para validar o envio imediato.

## Diagnóstico Esperado
- **STATUS**: OK
- **CAUSA**: O registro manual de `chat_id` causava falhas se o admin não estivesse cadastrado no banco.
- **CORREÇÃO**: Implementada lógica de auto-vínculo no `/start` e fallback para variável de ambiente nas notificações.
- **PRÓXIMO PASSO**: Validar o recebimento da mensagem no Telegram.
