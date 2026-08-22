# Implementação do Módulo de Dispositivos e Reversão Visual

O objetivo é remover as instruções inseridas erroneamente na página inicial e implementar a funcionalidade de gestão de dispositivos/aplicativos via Bot do Telegram e Supabase.

## Ações Realizadas

### Frontend
- **Restaurar Landing Page:** Reverter o texto de manutenção em `src/routes/index.tsx` para o estado original ("Estamos realizando atualizações importantes. Voltaremos em breve.").

### Backend & Banco de Dados
- **Esquema do Banco de Dados:** Criar a tabela `dispositivos` no Supabase vinculada aos clientes.
  - Colunas: `id` (UUID), `cliente_id` (UUID), `app_nome` (text), `mac_address` (text), `app_key` (text), `created_at` (timestamptz).
  - Configurar RLS e Grants para a tabela.
- **Servidor Telegram (lib):** Adicionar funções em `src/lib/telegram.server.ts`:
  - `createDevice`: Para salvar o novo dispositivo.
  - `listDevicesByClient`: Para consultar dispositivos ao exibir a ficha do cliente.
- **Webhook Telegram:** Implementar o fluxo do comando `/cadastrar_app`:
  - **Estado do Usuário:** Adicionar `cadastrar_app` ao `UserState`.
  - **Passos do Fluxo:**
    1. Solicitar nome do cliente.
    2. Escolha do App (IBO Player, IBO Pro, Outro) via Teclado Inline.
    3. Solicitar MAC Address.
    4. Solicitar KEY (com botão opcional "Pular").
- **Exibição de Dados:** Atualizar `sendClientFicha` para incluir os dispositivos formatados em `monospace` (Markdown `code`).

## Detalhes Técnicos
- Utilização de `supabaseAdmin` nas funções de servidor para bypass de RLS controlado.
- Manutenção do padrão de segurança de `chat_id` verificado.
- Formatação de mensagens via `HTML` ou `MarkdownV2` conforme suportado pela `sendMessage`.
