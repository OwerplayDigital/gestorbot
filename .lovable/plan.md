---
name: Migração de Dados
description: Plano de migração do arquivo backup_gestor_completo.json para o banco de dados.
type: feature
---
### Resumo da Migração

Vou migrar os dados do arquivo `backup_gestor_completo.json` para o banco de dados conforme as regras especificadas:

1. **USER_ID**: Todos os registros usarão o UUID `ecd9d3b8-eb43-46bc-a6a6-3c1598350302`.
2. **PLANOS**: 3 planos (preservar UUIDs).
3. **SERVIDORES**: 11 servidores (preservar UUIDs).
4. **CLIENTES**: 112 clientes (preservar UUIDs). 
   - Correção: Wanderson `plano_id` -> `5c24edfe-d09c-484e-99fc-9448985f8748`.
   - Fernando Goat: sem servidor (servidores_ids vazio).
5. **RENOVAÇÕES**: 144 renovações (extraídas dos dados dos clientes).
6. **TRANSAÇÕES**: 224 transações.
   - Conversão de 105 `serv_id` legados conforme o mapa fornecido.
   - "Bônus Guilherme" (R$ 8,50) com `cliente_id = NULL`.

### Ordem de Execução
1. `plans`
2. `servidores_iptv`
3. `clientes`
4. `renovacoes`
5. `transacoes`

### Auditoria Pós-Migração
- Contagem total de registros.
- Validação de integridade referencial.
- Validação financeira:
  - Entradas: R$ 4.415,00
  - Saídas: R$ 1.011,00
  - Lucro: R$ 3.404,00

A migração será executada via script administrativo temporário usando `supabaseAdmin`.
