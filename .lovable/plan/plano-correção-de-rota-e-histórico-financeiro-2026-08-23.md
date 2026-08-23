# Plano: Correção de Rota e Histórico Financeiro

Este plano aborda a correção do erro 404 no item 'Financeiro' da barra lateral e a construção da página de Histórico Financeiro detalhado.

## Mudanças

### 1. Correção de Rota
- **Arquivo**: `src/routes/__root.tsx`
- **Ação**: Garantir que o `NavLink` para `/financeiro` esteja configurado corretamente (já está no código, mas a rota física não existia).
- **Ação**: Criar o arquivo `src/routes/_authenticated/financeiro.tsx` para registrar a rota no TanStack Router.

### 2. Implementação da Página Financeiro (`src/routes/_authenticated/financeiro.tsx`)
- **Seletor de Período**: Interface no topo para escolher meses/anos passados (ex: Julho/2026, Junho/2026, Maio/2026).
- **Cards de Resumo**: Exibição de Faturamento (Entradas), Custos (Saídas) e Lucro Líquido filtrados pelo período selecionado.
- **Tabela de Extrato Detalhado**:
    - Listagem de todas as transações do mês selecionado.
    - Colunas: Data, Nome do Cliente, Servidor, Tipo e Valor.
    - Destaque visual: Verde para entradas, Vermelho para saídas.
- **Funcionalidades**:
    - Filtro de busca por nome de cliente em tempo real.
    - Botão de exportação para CSV do extrato filtrado.
    - Exclusão de dados do mês atual (conforme solicitado, pois já estão na Dashboard).

## Detalhes Técnicos
- Utilização de `useQuery` para buscar dados da tabela `transacoes` no Supabase.
- Joins com `clientes` e `servidores_iptv` para exibir nomes reais.
- Lógica de exportação CSV utilizando `Blob` e `URL.createObjectURL`.
- Estilização seguindo o padrão Dark/Light mode do projeto (Rounded-2xl, Azul corporativo).
- Filtragem de meses passados baseada no campo `data` ou `created_at` das transações.
