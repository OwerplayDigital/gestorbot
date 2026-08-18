# Plano de Fundação: Sistema de Gestão IPTV

Criação da estrutura base do banco de dados no Lovable Cloud, seguindo rigorosamente as especificações de UUID, RLS e isolamento por `user_id`.

## Banco de Dados (Supabase/PostgreSQL)

### Tabelas a serem criadas:
1.  **plans**: Planos de serviço.
2.  **servidores_iptv**: Servidores/fontes de sinal.
3.  **clientes**: Cadastro de clientes com vínculo a planos e múltiplos servidores.
4.  **transacoes**: Registro financeiro (entradas/saídas) vinculado a clientes ou servidores.
5.  **renovacoes**: Histórico de renovações de planos dos clientes.

### Segurança e Performance:
-   **UUID**: Todos os IDs primários e chaves estrangeiras.
-   **RLS (Row Level Security)**: Ativado em todas as tabelas.
-   **Políticas**: Cada usuário autenticado acessa apenas seus próprios dados (`auth.uid() = user_id`).
-   **Índices**: Criados para otimizar buscas por `user_id`, vencimento, datas e chaves estrangeiras.
-   **Grants**: Permissões explícitas para `authenticated` e `service_role`.

## Detalhes Técnicos

### Esquema de Tabelas (SQL):
```sql
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plans
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Servidores IPTV
CREATE TABLE public.servidores_iptv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Clientes
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    nome TEXT NOT NULL,
    whatsapp TEXT,
    plano_id UUID REFERENCES public.plans(id),
    valor NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    vencimento DATE,
    status TEXT DEFAULT 'ativo',
    servidores_ids UUID[] DEFAULT '{}',
    cadastrado_em TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transacoes
CREATE TABLE public.transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    data DATE DEFAULT CURRENT_DATE,
    descricao TEXT,
    cliente_id UUID REFERENCES public.clientes(id),
    serv_id UUID REFERENCES public.servidores_iptv(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Renovacoes
CREATE TABLE public.renovacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    cliente_id UUID REFERENCES public.clientes(id),
    plano_id UUID REFERENCES public.plans(id),
    valor NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    vencimento_anterior DATE,
    novo_vencimento DATE,
    data_renovacao TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Próximos Passos (pós-DB):
-   Configurar Autenticação (Email/Google).
-   Substituir a página inicial pelo dashboard ou tela de login.
