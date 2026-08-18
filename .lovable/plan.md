# Plan: Telegram Bot Core Integration

Create the operational core for a Telegram bot to manage plans and servers, using Supabase as the source of truth and environment variables for secrets.

## User Review Required

> [!IMPORTANT]
> The bot requires a `TELEGRAM_BOT_TOKEN` and a way to map Telegram IDs to Supabase `user_id`s. I will implement a linking mechanism.

- **Telegram Token**: I'll prepare the code to use `process.env.TELEGRAM_BOT_TOKEN`. You will need to add this via the Lovable secret manager.
- **Authorization**: I will create a `telegram_authorized_users` table to link Telegram `chat_id` to Supabase `user_id`.

## Technical Details

### 1. Database & Security
- **New Table**: `public.telegram_authorized_users` (id UUID, user_id UUID, telegram_chat_id BIGINT, created_at).
- **RLS**: Enable RLS and add `GRANT`s.
- **Secrets**: Use `TELEGRAM_BOT_TOKEN` from environment variables.

### 2. Backend (Server Functions)
- **Webhook Route**: Create `src/routes/api/public/telegram-webhook.ts`.
- **Bot Logic**: Implement a command handler for `PLANOS` and `SERVIDORES`.
- **Supabase Operations**:
    - `plans`: Insert (user_id, name, price, active=true), Select (by user_id).
    - `servidores_iptv`: Insert (user_id, name, valor, active=true), Select (by user_id).
- **Validation**: All inserts/updates will use `await` and include error handling/logging.

### 3. Telegram UI (Menu & Navigation)
- **Main Menu**: Persistent keyboard with `PLANOS` and `SERVIDORES`.
- **Sub-menus**: Inline or reply keyboards for `[Cadastrar]`, `[Listar]`, `[Voltar]`.
- **Flow**:
    - Select category -> Show options.
    - Cadastrar -> Prompt for data -> Save -> Confirm.
    - Listar -> Fetch from DB -> Display list.
- **Persistence**: Navigation state handled to avoid `/start` repetition.

### 4. Implementation Steps
1. Create `telegram_authorized_users` table via migration.
2. Implement Telegram webhook handler.
3. Implement business logic for Plan/Server management.
4. Verify UUID usage and error handling.
