# BIDREADY — M4.14.4.15: Quota Integrity Security Remediation Report

**Data:** 11 de Novembro de 2026  
**Status do Milestone:** `LOCAL REMEDIATION VERIFIED — READY FOR REVIEW`  
**Ambiente de Homologação:** PostgreSQL 17.4 isolado (`127.0.0.1:5433`)  
**Ambiente Remoto Alvo:** Supabase `ghqbqzljfpkjdrnuyddo` (PostgreSQL 17.11) — **MANTIDO ESTRITAMENTE READ-ONLY**  
**Organizações Preservadas:** Global Defense Systems Corp (`b22937b6-51e5-48a0-a75d-7b3405427298`), Starter (`e2e00000-0000-4000-a000-000000000010`)  
**Paddle Live:** Não acessada / Não autorizada / Intocada  

---

## 1. Sumário Executivo

O milestone **M4.14.4.15** abordou e sanou de forma definitiva os dois problemas críticos identificados na governança de quotas de análise:
1. **Vulnerabilidade de Liberação Arbitrária e Repetida de Quota:** A função legada `release_analysis_quota(p_organization_id)` permitia que qualquer membro autenticado da organização chamasse a RPC repetidamente em loop via client SDK, decrementando `analyses_used_in_period` de forma arbitrária até 0, obtendo análises ilimitadas sem controle transacional.
2. **Falha de Validação de Carência em Assinaturas `past_due`:** A função `reserve_analysis_quota` continha uma brecha lógica: se `v_sub.status = 'past_due'` com `grace_period_ends_at IS NULL`, a condição de bloqueio falhava silenciosamente e autorizava o consumo indevido de quota sem carência ativa.

Durante todo o desenvolvimento e homologação:
- O banco remoto Supabase `ghqbqzljfpkjdrnuyddo` (PostgreSQL 17.11) permaneceu **estritamente em modo READ-ONLY**.
- Nenhuma instrução DML, DDL, migration ou alteração de permissão foi aplicada remotamente.
- Não foram executadas transações ou webhooks na Paddle Sandbox ou Live.
- Todos os testes, simulações de concorrência e auditorias foram conduzidos localmente e no PostgreSQL 17.4 isolado.

---

## 2. Causa-Raiz dos Dois Problemas

### 2.1. Liberação Arbitrária de Quota
- **Código Anterior:**
  ```sql
  CREATE OR REPLACE FUNCTION public.release_analysis_quota(p_organization_id uuid)
  ...
  UPDATE public.saas_subscriptions
  SET analyses_used_in_period = GREATEST(0, analyses_used_in_period - 1)
  WHERE organization_id = p_organization_id AND analyses_used_in_period > 0;
  ```
- **Mecanismo da Falha:** A permissão `EXECUTE` estava concedida para a role `authenticated`. Não havia correlação com uma reserva prévia (`reservation_id`). Qualquer usuário com sessão ativa do tenant podia emitir `supabase.rpc('release_analysis_quota', { p_organization_id })` N vezes, zerando o contador de consumo sem nenhuma análise falha correspondente.

### 2.2. Bypass de Carência em `past_due` com Timestamp Nulo
- **Código Anterior:**
  ```sql
  IF v_sub.status NOT IN ('active', 'past_due', 'trialing') THEN ...
  IF v_sub.status = 'past_due' AND v_sub.grace_period_ends_at IS NOT NULL AND v_sub.grace_period_ends_at < NOW() THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Grace period has expired.');
  END IF;
  ```
- **Mecanismo da Falha:** Quando `status = 'past_due'` e `grace_period_ends_at IS NULL`, a cláusula `v_sub.grace_period_ends_at IS NOT NULL` avaliava para `false`. O fluxo prosseguia para o débito de quota normalmente, violando a regra de negócio que exige carência válida e explícita.

---

## 3. Arquitetura Corrigida e Alterações Implementadas

### 3.1. Nova Tabela de Auditoria e Controle: `analysis_quota_reservations`
Criada tabela estruturada com isolamento RLS para rastreabilidade de ponta a ponta:
```sql
CREATE TABLE IF NOT EXISTS public.analysis_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  opportunity_id text,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'released')),
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  consumed_at timestamp with time zone,
  released_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_quota_res_org_status ON public.analysis_quota_reservations (organization_id, status);
ALTER TABLE public.analysis_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analysis_quota_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.analysis_quota_reservations TO postgres, service_role;
```

### 3.2. Ciclo de Vida da Reserva e Procedimentos RPC

```
[Cliente HTTP] ──> [API /matches/run]
                         │
                         ├── (1) getRequestContext: autentica usuário e tenant
                         ├── (2) supabaseAdmin.rpc('reserve_analysis_quota')
                         │         ├── Lock FOR UPDATE em saas_subscriptions
                         │         ├── Validação rigorosa de status e carência
                         │         ├── Débito atômico (+1)
                         │         └── Criação da reserva (status='reserved') ──> Retorna reservation_id
                         │
                         ├── (3) Execução do Matching Engine (oppService.runMatchingAsync)
                         │         │
                         │         ├── [Sucesso] ──> supabaseAdmin.rpc('consume_analysis_quota', { reservation_id })
                         │         │                   └── Transição para status='consumed'
                         │         │
                         │         └── [Falha]   ──> supabaseAdmin.rpc('release_analysis_quota', { reservation_id })
                         │                             ├── Validação: status='reserved'? pertence à org?
                         │                             ├── Reembolso atômico (-1)
                         │                             └── Transição para status='released'
                         ▼
```

### 3.3. Regra Rigorosa de `past_due` (Etapa 4)
Implementada em `reserve_analysis_quota`:
```sql
  IF v_sub.status = 'active' OR v_sub.status = 'trialing' THEN
    NULL; -- Permitido
  ELSIF v_sub.status = 'past_due' THEN
    IF v_sub.grace_period_ends_at IS NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Subscription is past due without active grace period.'
      );
    ELSIF v_sub.grace_period_ends_at < NOW() THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Grace period has expired.'
      );
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Subscription is in %s state.', v_sub.status)
    );
  END IF;
```

### 3.4. Eliminação de Sobrecargas Inseguras e Fechamento de Permissões
- A sobrecarga insegura `release_analysis_quota(uuid)` foi excluída (`DROP FUNCTION IF EXISTS public.release_analysis_quota(uuid);`).
- As novas funções exigem `p_reservation_id`:
  - `reserve_analysis_quota(p_organization_id uuid, p_user_id uuid, p_opportunity_id text)`
  - `release_analysis_quota(p_reservation_id uuid, p_organization_id uuid)`
  - `consume_analysis_quota(p_reservation_id uuid, p_organization_id uuid)`
- Permissões de execução revogadas de `PUBLIC, anon, authenticated` e concedidas exclusivamente a `service_role, postgres`.
- Checagem de role utiliza `auth.role() IS DISTINCT FROM 'service_role'`.

---

## 4. Matriz de Permissões (Antes vs Depois)

| Função RPC | Role | Antes (M4.14.4.14) | Depois (M4.14.4.15) | Impacto / Mitigação |
| :--- | :---: | :---: | :---: | :--- |
| `reserve_analysis_quota` | `authenticated` | **true** (Exposta) | ❌ **false** (Revogado) | Impede esgotamento artificial em loop por clientes |
| `reserve_analysis_quota` | `service_role` | true | ✅ **true** (Mantido) | Acesso controlado via backend Next.js |
| `release_analysis_quota` | `authenticated` | **true** (Exposta) | ❌ **false** (Revogado) | Impede liberação arbitrária e repetida de quota |
| `release_analysis_quota` | `service_role` | true | ✅ **true** (Mantido) | Compensação automática apenas para reservas legítimas |
| `consume_analysis_quota` | `authenticated` | Não existia | ❌ **false** (Revogado) | Transição restrita ao backend |
| `consume_analysis_quota` | `service_role` | Não existia | ✅ **true** (Concedido) | Confirmação de consumo pelo matching engine |

---

## 5. Validação em PostgreSQL 17 Real (Cenário 10)

Executado no PostgreSQL 17.4 isolado (`127.0.0.1:5433`) via `scripts/verify-m41446-postgres17.ts`:

```text
--------------------------------------------------------------------------------
CENÁRIO 10: Integridade de Quota, Reservas, Liberações e Carência past_due (M4.14.4.15)
--------------------------------------------------------------------------------
  past_due com grace NULL: allowed=false, reason="Subscription is past due without active grace period."
  past_due com grace expirada: allowed=false, reason="Grace period has expired."
  past_due com grace válida: allowed=true, used=1
  Reserva 1 em Org A: allowed=true, reservation_id=cbc1bf38-7b26-472d-b60d-aacb66115be3, used=1
  Reserva 2 em Org A: allowed=true, used=2, remaining=0
  Reserva 3 em Org A (limite estourado): allowed=false, reason="Monthly analysis quota limit reached."
  Tentativa cross-tenant de devolução: success=false, error="Cross-tenant violation: reservation belongs to a different organization."
  Devolução legítima da Reserva 1: success=true, used=1
  Tentativa de devolução duplicada: success=false, error="Quota reservation has already been released."
  Consumo da Reserva 2: success=true, status=consumed
  Tentativa de liberar reserva consumida: success=false, error="Quota reservation has already been consumed and cannot be released."
  ✓ Comprovação: Gestão de quota blindada contra manipulação, repetição, cross-tenant e past_due sem carência.
```

---

## 6. Resultados dos Testes Automatizados

- **Vitest:** **102 testes aprovados** em 6 suítes (inclusão de 11 novos testes específicos de ciclo de vida de quota e carência na suíte `tests/m414411-critical-billing-security.test.ts`).
- **Compilador TypeScript (`npx tsc --noEmit`):** **0 erros**.
- **Next.js Production Build:** Compilação Turbopack concluída com sucesso (**código 0**).

---

## 7. Tabela de Hashes SHA-256 dos Arquivos de Entrega

| Arquivo | Algoritmo | Hash SHA-256 |
| :--- | :---: | :--- |
| `supabase/migrations/20261111000007_billing_final_consolidation.sql` | SHA-256 | `3B9893AD8B44AA2D95F8C96064B07BB3CB65BA57307C368BFFE1647355CFC51F` |
| `src/app/api/billing/webhook/route.ts` | SHA-256 | `FF77EDB90C8742B14B0CD5E93213CB6A843D52FB68CA4B37DEA96E6195E43477` |
| `src/app/api/billing/subscription/route.ts` | SHA-256 | `943FB39AE3D38637AA7B22A5FB016EE2F8CFD15B3C546CFA41382573DD512153` |
| `src/app/api/opportunities/[id]/matches/run/route.ts` | SHA-256 | `49339A1AA7E7FF572CF50861E62F46455433E9AC8E2585ED53E8A2C28E3F0122` |
| `src/lib/billing/paddle-sandbox.ts` | SHA-256 | `C2F54C7F892AB3E1401AE2048F0921EFE4ADF6A3285DA1835038A2CB4B55A47D` |
| `scripts/remediate_starter_subscription_m4144.sql` | SHA-256 | `9270243B018B2D915A8A7FE5A13FE32F97200B14C78CC8CEAD4FA5170D3C82C7` |
| `scripts/operational_runbook_m4144.md` | SHA-256 | `C3DF30AA075FFF3592323576FB91F295B3AFCD31D332C77B7ADF10CE239A4024` |
| `scripts/verify-m41446-postgres17.ts` | SHA-256 | `ECC734645ADF7CA457892EA0A651EC043B0705343DE08D4B88FA440F14612917` |
| `tests/m414411-critical-billing-security.test.ts` | SHA-256 | `8BCF6C2E26CE4C4A036023FD78A40ACC62489D335C6523D2366E6FED5F4701F4` |
| `src/lib/supabase/admin.ts` | SHA-256 | `64BE45EBED8100BCD31816924E3DA79AE5C4F20DB729B0D5D4C7702DDF8C80E9` |

---

## 8. Parecer de Encerramento

> [!IMPORTANT]
> **PARECER TÉCNICO:**  
> `LOCAL REMEDIATION VERIFIED — READY FOR REVIEW`
> 
> As causas-raiz de liberação arbitrária e bypass de carência em `past_due` foram completamente eliminadas e revalidadas em PostgreSQL 17 e nos testes automatizados.
> 
> **ESTE PARECER NÃO CONSTITUI AUTORIZAÇÃO DE EXECUÇÃO REMOTA.**  
> Qualquer aplicação remota permanece sob estrita dependência de aprovação humana formal posterior.
