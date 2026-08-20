# Plano de Implementação: Navegação e Edição no Bot do Telegram

Este plano descreve os ajustes para melhorar a navegação no bot do Telegram, adicionando o botão "Voltar" em todas as sub-telas do cliente e corrigindo o menu de edição de cliente.

## Alterações Propostas

### 1. Sistema de Navegação (Botão Voltar)
- Adicionar um botão de Inline Keyboard `🔙 Voltar` em todas as telas que não sejam o menu principal ou a ficha do cliente.
- O botão enviará o `callback_data` no formato `client_menu:{cliente_id}`.
- Implementar o manipulador para `client_menu:{cliente_id}` que recupera os dados do cliente e reexibe a ficha de ações principal (mesma lógica do `sendClientFicha`).

### 2. Correção do Botão "Editar Cliente"
- Localizar o manipulador de `edit_client_full:{cliente_id}` (ou similar).
- Implementar a exibição de um menu de opções de edição:
    - `📝 Nome`
    - `📱 WhatsApp`
    - `📅 Vencimento`
    - `📡 Servidor`
    - `🔙 Voltar`
- Implementar os respectivos callbacks para cada opção, permitindo a alteração específica de cada campo.

## Detalhes Técnicos

### Arquivos afetados:
- `src/routes/api/public/telegram-webhook.ts`: Principal arquivo de lógica do bot, onde os handlers de callback e a montagem dos teclados residem.
- `src/lib/telegram.server.ts`: Se houver necessidade de novas funções auxiliares para busca/atualização.

### Lógica do Botão Voltar:
```typescript
// Exemplo de inclusão no Inline Keyboard
[{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]

// Handler de callback
if (data.startsWith('client_menu:')) {
  const id = data.split(':')[1];
  const client = await getClientById(id); // Função a garantir/implementar
  if (client) {
    await sendClientFicha(chatId, client);
  }
}
```

### Lógica do Menu de Edição:
```typescript
if (data.startsWith('edit_client_full:')) {
  const id = data.split(':')[1];
  await editMessage(chatId, messageId, "🛡️ <b>MENU DE EDIÇÃO</b>\nO que você deseja alterar?", {
    inline_keyboard: [
      [{ text: "📝 Nome", callback_data: `edit_name:${id}` }],
      [{ text: "📱 WhatsApp", callback_data: `edit_wpp:${id}` }],
      [{ text: "📅 Vencimento", callback_data: `edit_venc:${id}` }, { text: "📡 Servidor", callback_data: `edit_serv:${id}` }],
      [{ text: "🔙 Voltar", callback_data: `client_menu:${id}` }]
    ]
  });
}
```
