# Gerenciamento de Estado de Conversa para Busca de Clientes

Implementação de um mecanismo de persistência de estado para o Bot do Telegram, permitindo que o bot "escute" e processe a próxima mensagem de texto do usuário como uma consulta de busca.

## Ações Propostas

### 1. Banco de Dados (Supabase)
- Criar uma migração para adicionar a coluna `current_step` (TEXT) à tabela `telegram_authorized_users`.
- Esta coluna armazenará o estado atual da conversa (ex: `awaiting_search_query`).

### 2. Backend (Telegram Library)
- Atualizar `src/lib/telegram.server.ts` para incluir funções de persistência de estado:
    - `setUserStep(chatId: number, step: string | null)`: Atualiza o passo atual do usuário.
    - `getUserStep(chatId: number)`: Recupera o passo atual do usuário.

### 3. Webhook do Telegram
- **Handler de Botões (Callback Query):**
    - Quando "🔍 Buscar Cliente" for clicado, chamar `setUserStep(chatId, 'awaiting_search_query')`.
    - Enviar a mensagem solicitando o nome.
- **Handler de Mensagens de Texto:**
    - Antes de processar comandos, verificar `getUserStep(chatId)`.
    - Se o passo for `awaiting_search_query`:
        1. Executar a busca na tabela `clientes` usando o texto enviado.
        2. Limpar o estado (`setUserStep(chatId, null)`).
        3. Exibir os resultados encontrados como botões inline.
        4. Caso não encontre, exibir mensagem de erro com opções de "Buscar Novamente" ou "Voltar".

## Detalhes Técnicos

### Fluxo de busca não encontrada
Se a busca não retornar resultados, o bot apresentará:
- Botão "🔍 Buscar Novamente": Reinicia o estado para `awaiting_search_query`.
- Botão "🔙 Voltar": Retorna ao menu de clientes.

### Segurança
Todas as operações de leitura e escrita de estado utilizarão a `Service Role` do Supabase para garantir que o bot (agindo como sistema) possa gerenciar as sessões sem depender do contexto de autenticação do navegador.
