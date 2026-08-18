# Plano de Implementação: Fluxo Interativo de Cadastro de Cliente via Telegram

Implementação do fluxo passo a passo para cadastro de novos clientes diretamente pelo bot do Telegram, com suporte a múltiplos servidores, seleção dinâmica de planos e ajuste inteligente de data de vencimento.

## Etapas Técnicas

### 1. Backend Central (`src/lib/telegram.server.ts`)
- Implementar `createClientWithDetails`: Função administrativa (Service Role) para salvar o novo cliente com `plano_id`, `servidores_ids` (array), `desconto` e `vencimento` (convertido para ISO).
- Atualizar `listPlans` e `listServers` para garantir retorno de IDs e valores formatados.

### 2. Webhook e Gerenciamento de Estado (`src/routes/api/public/telegram-webhook.ts`)
- **Máquina de Estados**: Ampliar `userState` para suportar as 6 etapas do fluxo `cadastrar_cliente`.
- **Interface Conversacional**:
  - **Passo 1 (Nome)**: Captura texto.
  - **Passo 2 (WhatsApp)**: Captura texto (validação básica).
  - **Passo 3 (Plano)**: Botões Inline com Nomes e Preços da tabela `plans`.
  - **Passo 4 (Servidores)**: Seleção múltipla. Botões Inline para cada servidor + botões auxiliares "Adicionar Outro" e "Avançar".
  - **Passo 5 (Desconto)**: Captura valor numérico.
  - **Passo 6 (Vencimento)**: Interface interativa com botões [+/- 1 dia], [+/- 5 dias] e confirmação da data em formato DD/MM/AAAA.
- **Resumo e Confirmação**: Montagem de mensagem final com todos os dados e botões de [Confirmar] / [Cancelar].
- **Persistência**: Gravação no Supabase após confirmação positiva.

### 3. Utilitários de Data
- Funções para formatação (DD/MM/AAAA) e cálculo de vencimento (+30 dias por padrão).
- Conversão de entrada de usuário para formato aceito pelo PostgreSQL (`YYYY-MM-DD`).

## Detalhes de Segurança
- Uso exclusivo de `supabaseAdmin` para operações de escrita disparadas pelo bot.
- Validação contínua do `chat_id` autorizado antes de qualquer interação no fluxo.
