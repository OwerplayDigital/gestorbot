# Plan: Implement Telegram Mini App Route (/miniapp)

Implement a dedicated route for the Telegram Mini App with a mobile-first design, customer cards, and quick actions.

## User Review Required

> [!IMPORTANT]
> The Mini App will use the existing Supabase tables (`clientes`, `servidores_iptv`) and logic. No schema changes will be made.

- Should we implement authentication specifically for the Mini App (e.g., via Telegram WebApp initData), or should it use the existing session?
- Do you have specific colors or branding for the status indicators (In Day, Expires Today, Overdue) beyond standard Green/Yellow/Red?

## Technical Details

### 1. New Route and Scripts
- Create `src/routes/miniapp.tsx`.
- Use the `head` option in the route definition to inject `https://telegram.org/js/telegram-web-app.js`.

### 2. UI Components
- **Header**: Compact summary showing Total Clients, Due Today, and Overdue.
- **Search & Filters**: Search input and toggle buttons for status filtering.
- **Customer Cards**:
    - Display Name, WhatsApp, Due Date, and Server.
    - Status badge based on due date.
    - **Renovar** Action: Updates `vencimento` in Supabase (adds 30 days) and generates a message.
    - **Editar** Action: Modal to update basic client details.

### 3. Data Integration
- Fetch clients using the existing Supabase client.
- Filter clients client-side for better responsiveness in the Mini App.

### 4. Layout
- Mobile-first CSS using Tailwind.
- Ensure the layout fits well within the Telegram WebApp container.
