# Plan: Mobile-First Dashboard Overhaul for Owerplay TV

Restructure the web dashboard into a mobile-first web app with the official Owerplay TV identity, focusing on simplicity, electric cyan accents, and clear financial oversight.

## 1. Design & Layout Foundations

- **Visual Identity:**
  - Base: Clean, modern Light Mode (default).
  - Accents: Electric Cyan (`#00FFFF` or similar) and Chrome/Silver.
  - Dark Mode: Soft dark blue shadows/cards.
- **Root Layout (`src/routes/__root.tsx`):**
  - Add theme toggle (Sun/Moon) to the header.
  - Add Logo "Owerplay Gestor".
  - Add Hamburger Menu (`≡`) for navigation.
  - **Remove Bottom Nav.**
- **Global Styles (`src/styles.css`):**
  - Update theme tokens for Owerplay palette.

## 2. Dashboard Components (`src/routes/_authenticated/dashboard.tsx`)

- **Financial Hero Card:**
  - High-visibility Electric Cyan card at the top.
  - Display "Lucro do Mês" with a privacy toggle (eye icon).
- **Quick Stats (4 Cards):**
  - Ativos, Vencendo Hoje, Total, Vencidos.
  - **Interaction:** "Vencidos" card opens a Drawer/Modal list (not displayed on the home feed).
- **Main Feed (Vencendo Hoje):**
  - Search input for client names.
  - Filtered list showing ONLY clients expiring today.
  - Mobile-optimized cards: Iniciais, Nome, Tag do Servidor (Cyan/Silver), Data, and Value.
  - **Remove action buttons** (WhatsApp, Edit, Delete, Reset).

## 3. Financial & History (Scrollable)

- **Summary Cards:** Entradas, Saídas, Lucro Líquido (+ growth %).
- **Interactive History:** Month/Year selector for historical reports.
- **Visuals:** Comparison Bar Chart (Entradas vs Saídas vs Lucro).
- **Statement:** "Extrato" list showing recent Pix transactions.

## 4. Technical Tasks

- Implement `Drawer` component (Vaul or similar if not present, or use Shadcn Sheet for simplicity).
- Refactor dashboard queries to support filtered "Vencendo Hoje" and aggregated historical data.
- Ensure strict mobile-first responsiveness (padding, font sizes, touch targets).
