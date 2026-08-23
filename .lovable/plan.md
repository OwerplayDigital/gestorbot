# Dashboard Enhancements Plan

Implementation of UI improvements and functional features for the Dashboard as requested in `instrucoes-21.md`.

## Proposed Changes

### 1. Header Removal
- Remove "Visão Geral do Negócio" title and subtitle from `src/routes/_authenticated/dashboard.tsx`.
- Shift the layout so it starts directly with the period filters.

### 2. Functional Period Filters
- Connect the "Hoje / Mês / Ano" filter buttons to the application state.
- Implement dynamic label for the current month/year (e.g., "Agosto/26").
- Update Supabase queries to filter data based on the selected period:
  - **Hoje**: `created_at` starting from today 00:00 BRT.
  - **Mês**: `created_at` within the current calendar month.
  - **Ano**: `created_at` within the current calendar year.
- Recalculate summary cards (Faturamento, Custo, Lucro) and the "Extrato Recente" table automatically upon filter change.

### 3. Financial Chart Redesign (Recharts)
- Rebuild the bar chart to show 3 grouped bars per month:
  - **Entradas (Blue)**: Sum of `entrada`.
  - **Saídas (Red)**: Sum of `custo`.
  - **Lucro (Green)**: `entrada - custo`.
- Add a top legend with color indicators.
- Format Y-axis with BRL values (e.g., R$ 1.000).
- Style bars with thick, rounded tops and full-width utilization.

## Technical Details
- **State Management**: `useState` for `activeTab`.
- **Date Logic**: Use `date-fns-tz` to handle Brasilia Time (BRT) consistently.
- **Data Fetching**: Refactor `useQuery` key to include `activeTab` to trigger refetches.
- **Chart**: Update `BarChart` props and add `Legend` and `YAxis` formatting.
- **Zod**: No schema changes required, only data mapping logic.

---
*Note: I will strictly follow the "Edit only what the request names" rule.*
