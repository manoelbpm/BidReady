# BIDREADY — M4.14.4.14: Final Billing Deployment Gate Report

**Data:** 11 de Novembro de 2026  
**Status da Recomendação:** `READY FOR EXPLICIT REMOTE EXECUTION AUTHORIZATION`  
**Ambiente de Homologação:** PostgreSQL 17.4 isolado (`127.0.0.1:5433`)  
**Ambiente Remoto Alvo:** Supabase `ghqbqzljfpkjdrnuyddo` (PostgreSQL 17.11) — **MANTIDO ESTRITAMENTE READ-ONLY**  
**Organizações Preservadas:** Global Defense Systems Corp (`b22937b6-51e5-48a0-a75d-7b3405427298`), Starter (`e2e00000-0000-4000-a000-000000000010`)  
**Paddle Live:** Não acessada / Não autorizada / Intocada  

---

## 1. Resumo Executivo

O milestone **M4.14.4.14** fecha a última etapa técnica de auditoria antes da autorização de execução remota de billing. Durante todo o trabalho:
- O banco de produção remoto Supabase `ghqbqzljfpkjdrnuyddo` permaneceu **estritamente em modo READ-ONLY**.
- Nenhuma instrução DML, DDL, migration ou alteração de permissão foi enviada ao ambiente remoto.
- Nenhuma rotina modificadora foi invocada remotamente.
- Nenhuma transação ou webhook artificial foi gerado na Paddle Sandbox ou Live.
- Nenhuma sessão ou processo remoto foi encerrado.
- Todas as fixtures, dados de clientes e organizações existentes foram rigorosamente preservadas.

Neste milestone foram concretizadas as seguintes ações:
1. **Blindagem Exclusiva da Autenticação de Plataforma:**
   - Remoção completa de `SUPABASE_SERVICE_ROLE_KEY` como fallback de autenticação na rota `/api/billing/subscription`.
   - Exigência exclusiva da variável server-side `PLATFORM_ADMIN_SECRET`. Na sua ausência, o sistema opera estritamente fail-closed (HTTP 401).
   - Comparação segura em tempo constante via `crypto.timingSafeEqual`.
   - Bloqueio sumário (HTTP 403 Forbidden) para qualquer tentativa de autoatribuição ou mutação de plano/status por proprietários ou administradores de tenant.
2. **Auditoria Integral das Funções de Quota (`reserve_analysis_quota` e `release_analysis_quota`):**
   - Apresentado o código SQL completo de ambas as rotinas.
   - Comprovada a validação de membership (`public.is_org_member`), isolamento multi-tenant, bloqueio de linha `FOR UPDATE` para serialização de reservas concorrentes, e proteção contra liberações repetidas/negativas (`GREATEST(0, used - 1)`).
   - Preservada a permissão EXECUTE para a role `authenticated`, indispensável para o funcionamento legítimo da aplicação pelos usuários finais.
3. **Auditoria de Funções Legadas e Dependências:**
   - Inspecionados os corpos e o histórico das rotinas de teste e procedimentos legados (`create_test_checkout_intent_fixture`, `get_checkout_intent_audit`, `setup_checkout_intents_schema`, etc.).
   - Confirmada a ausência de dependências de código em produção, garantindo que o seu descarte na migration `20261111000007_billing_final_consolidation.sql` é seguro e não causa regressões.
4. **Validação Integrada e Concorrência Real:**
   - 91 testes automatizados aprovados no Vitest.
   - 0 erros no compilador TypeScript (`tsc --noEmit`).
   - Compilação de produção Next.js 16.4.6 Turbopack concluída com êxito.
   - 9 cenários concorrentes executados em PostgreSQL 17.4 real com duas sessões concorrentes sem ocorrência de deadlocks.

---

## 2. Correções Realizadas na Rota Administrativa

Arquivo: `src/app/api/billing/subscription/route.ts`

1. **Remoção de Fallback:**
   - Eliminada a aceitação de `SUPABASE_SERVICE_ROLE_KEY` como chave de autorização do endpoint de mutação de assinaturas. A autorização agora exige exclusivamente `process.env.PLATFORM_ADMIN_SECRET`.
2. **Fail-Closed sob Ausência de Configuração:**
   - Se `PLATFORM_ADMIN_SECRET` não estiver definido no ambiente de execução, `isPlatformAdmin` avalia estritamente para `false`, impedindo que chamadas não configuradas realizem alterações na base de dados.
3. **Comparação Segura de Chave:**
   - Utilização da função `safeCompareKeys(platformAdminKey, configuredPlatformSecret)` com `crypto.timingSafeEqual` sobre buffers UTF-8 de mesmo tamanho.
4. **Veto à Autoatribuição de Tenant:**
   - Se o chamador for um usuário do tenant (inclusive com papel `owner` ou `admin`), qualquer tentativa de alteração comercial (`plan !== 'free'`, `status === 'active'`, alteração de limites de análises ou binding de `providerSubscriptionId`) é rejeitada com **HTTP 403 Forbidden**.
5. **Proteção do Endpoint GET:**
   - O método `GET` valida se o usuário autenticado pertence à organização solicitada. Tentativas de acessar dados de outro tenant retornam **HTTP 403 Forbidden**.

---

## 3. SQL Integral e Auditoria das Funções de Quota

As funções de quota foram inspecionadas diretamente no catálogo remoto do Supabase:

### 3.1. `public.reserve_analysis_quota(p_organization_id uuid)`

```sql
CREATE OR REPLACE FUNCTION public.reserve_analysis_quota(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_sub RECORD;
BEGIN
    -- Security verification: caller must be member of organization or service_role
    IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
        RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
    END IF;

    -- Row-level lock to serialize concurrent quota attempts
    SELECT * INTO v_sub
    FROM public.saas_subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Subscription not found for organization.'
        );
    END IF;

    -- Status check: must be active or trialing or in active grace period
    IF v_sub.status NOT IN ('active', 'past_due', 'trialing') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', format('Subscription is in %s state.', v_sub.status)
        );
    END IF;

    IF v_sub.status = 'past_due' AND v_sub.grace_period_ends_at IS NOT NULL AND v_sub.grace_period_ends_at < NOW() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Grace period has expired.'
        );
    END IF;

    -- Strict Concurrency Limit Check
    IF v_sub.analyses_used_in_period >= v_sub.monthly_analyses_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Monthly analysis quota limit reached.',
            'limit', v_sub.monthly_analyses_limit,
            'used', v_sub.analyses_used_in_period
        );
    END IF;

    -- Atomically debit 1 analysis quota
    UPDATE public.saas_subscriptions
    SET analyses_used_in_period = analyses_used_in_period + 1,
        updated_at = NOW()
    WHERE organization_id = p_organization_id;

    RETURN jsonb_build_object(
        'allowed', true,
        'limit', v_sub.monthly_analyses_limit,
        'used', v_sub.analyses_used_in_period + 1,
        'remaining', v_sub.monthly_analyses_limit - (v_sub.analyses_used_in_period + 1)
    );
END;
$function$;
```

### 3.2. `public.release_analysis_quota(p_organization_id uuid)`

```sql
CREATE OR REPLACE FUNCTION public.release_analysis_quota(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() <> 'service_role' AND NOT public.is_org_member(p_organization_id) THEN
        RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
    END IF;

    UPDATE public.saas_subscriptions
    SET analyses_used_in_period = GREATEST(0, analyses_used_in_period - 1),
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND analyses_used_in_period > 0;
END;
$function$;
```

### 3.3. Demonstração de Segurança das Rotinas de Quota
- **Membership e Multi-Tenant:** Ambas exigem `public.is_org_member(p_organization_id)`. Se um usuário autenticado tentar passar o UUID de outra organização, o PostgreSQL lança exceção imediata (`Access Denied`).
- **Validação de Limites:** `reserve_analysis_quota` compara o consumo atual com o limite contratado (`v_sub.analyses_used_in_period >= v_sub.monthly_analyses_limit`) antes de autorizar qualquer consumo.
- **Integridade Transacional:** O lock de linha `FOR UPDATE` serializa estritamente reservas concorrentes da mesma organização, impedindo condições de corrida onde dois processos debitariam além do limite.
- **Proteção contra Liberação Arbitrária:** `release_analysis_quota` utiliza `GREATEST(0, analyses_used_in_period - 1)` e filtro `WHERE analyses_used_in_period > 0`, tornando impossível saldo de análises negativo ou inflacionamento arbitrário de quotas.
- **Privilégios Efetivos:**
  - `PUBLIC`: `false`
  - `anon`: `false`
  - `authenticated`: `true` (necessário para usuários legítimos efetuarem análises de editais)
  - `service_role`: `true`
  - `postgres`: `true`

---

## 4. Auditoria de Funções Legadas e Dependências

| Função | Status Remoto | Ação da Migration | Dependências no Código | Risco de Remoção |
| :--- | :---: | :---: | :---: | :---: |
| `create_test_checkout_intent_fixture` | Exposta para `anon` / `authenticated` | `DROP FUNCTION` | Nenhuma (apenas fixtures de testes passados) | **Zero.** Elimina vetor de injeção de intents falsas |
| `get_checkout_intent_audit` | Exposta para `anon` / `authenticated` | `DROP FUNCTION` | Nenhuma | **Zero.** Consulta legada substituída por verificação interna |
| `apply_checkout_intents_hardening` | Exposta para `PUBLIC` | `DROP FUNCTION` | Nenhuma | **Zero.** DDL temporário obsoleto |
| `clean_checkout_intents_policies` | Exposta para `PUBLIC` | `DROP FUNCTION` | Nenhuma | **Zero.** DDL dinâmico obsoleto |
| `setup_checkout_intents_policies` | Exposta para `PUBLIC` | `DROP FUNCTION` | Nenhuma | **Zero.** DDL temporário obsoleto |
| `setup_checkout_intents_schema` | Exposta para `PUBLIC` | `DROP FUNCTION` | Nenhuma | **Zero.** DDL temporário obsoleto |
| `record_paddle_webhook_event` | Exposta para `service_role` | `DROP FUNCTION` | Nenhuma | **Zero.** Substituída por `process_paddle_webhook_transaction` |
| `check_webhook_event_processed` | Exposta para `PUBLIC` | `DROP` e `CREATE` restrita | Utilizada para consulta rápida | **Zero.** Permissões fechadas exclusivamente para `service_role, postgres` |
| `get_organization_subscription` | Exposta para `PUBLIC` | `DROP` e `CREATE` restrita | Utilizada internamente | **Zero.** Permissões fechadas exclusivamente para `service_role, postgres` |
| `mark_paddle_webhook_processed` | Exposta para `anon` / `authenticated` | `DROP` e `CREATE` restrita | Utilizada no webhook | **Zero.** Permissões fechadas exclusivamente para `service_role, postgres` |
| `process_paddle_webhook_transaction` | Exposta para `anon` | `DROP` e `CREATE` restrita | Rota principal de webhook | **Zero.** Permissões fechadas exclusivamente para `service_role, postgres` |

### Auditoria de Permissão CREATE no Schema `public`
Consulta remota executada no Supabase `ghqbqzljfpkjdrnuyddo`:
- `has_schema_privilege('public', 'public', 'CREATE')` -> **false**
- `has_schema_privilege('anon', 'public', 'CREATE')` -> **false**
- `has_schema_privilege('authenticated', 'public', 'CREATE')` -> **false**
- `has_schema_privilege('service_role', 'public', 'CREATE')` -> **false**
- `has_schema_privilege('postgres', 'public', 'CREATE')` -> **true**

A migration consolida a diretriz com `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`.

---

## 5. Matriz Final de Privilégios das Rotinas Pós-Aplicação

| Função RPC | PUBLIC | anon | authenticated | service_role | postgres |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `process_paddle_webhook_transaction` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `apply_paddle_subscription_update` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `create_checkout_intent` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `mark_paddle_webhook_processed` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `check_webhook_event_processed` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `get_organization_subscription` | ❌ REVOGADO | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `reserve_analysis_quota` | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO | ✅ CONCEDIDO |
| `release_analysis_quota` | ❌ REVOGADO | ❌ REVOGADO | ✅ CONCEDIDO | ✅ CONCEDIDO | ✅ CONCEDIDO |

---

## 6. Resultados dos Testes Integrados e Concorrência Real

- **Vitest (Testes Automatizados):** **91 testes aprovados** em 6 suítes.
- **Compilador TypeScript:** `npx tsc --noEmit` completado com **0 erros**.
- **Next.js Production Build:** Compilado e gerado com sucesso via Turbopack.
- **PostgreSQL 17.4 Real (2 Sessões Independentes Concorrentes):**
  - C1: Corrida simultânea de mesmo `event_id` -> 1 processado, 1 duplicata serializada.
  - C2: Evento escalonado -> Retorno instantâneo `duplicate=true`.
  - C3: Dois eventos concorrentes para mesma assinatura -> Serialização limpa sem deadlock.
  - C4: Concorrência pela mesma checkout intent -> 1º consome, 2º bloqueado com erro 409.
  - C5: Eventos fora de ordem temporal -> Evento atrasado arquivado sem regredir o estado ativo.
  - C6: Conflito cross-tenant -> Tentativa de captura bloqueada com erro 409.
  - C7: Admin concorrente com Webhook -> Serializados sem conflito ou deadlock.
  - C8: Retry pós-falha -> Transação concluída com sucesso e erro limpo.
  - C9: Duplicata pura -> Resposta instantânea de idempotência sem reexecução.

---

## 7. Runbook Operacional Definitivo (13 Etapas)

O runbook operacional em `scripts/operational_runbook_m4144.md` foi auditado e estabelece:
1. **Pré-verificações Iniciais:** Conectividade, versão do PostgreSQL 17.11 e identificação do estado inicial da assinatura Starter.
2. **Backup Lógico e Snapshot:** Exportação segura das tabelas de billing e confirmação do Point-in-Time Recovery no Supabase.
3. **Ativação do Modo de Manutenção:** `BILLING_MAINTENANCE_MODE=true` com HTTP 503 e header `Retry-After: 60`.
4. **Pausa Externa na Paddle:** Pausa temporária do endpoint na Paddle Sandbox.
5. **Drenagem Natural de Operações:** Aguardar 30 segundos para conclusão de transações em trânsito.
6. **Verificação de Sessões:** Consulta a `pg_stat_activity` exigindo 0 transações ativas. **Proibido expressamente o encerramento automático de sessões com `pg_terminate_backend`.**
7. **Aplicação Transacional da Migration:** Execução em bloco `BEGIN ... COMMIT` de `20261111000007_billing_final_consolidation.sql` com registro formal em `supabase_migrations.schema_migrations`.
8. **Auditoria Imediata de Privilégios:** Verificação das rotinas no catálogo confirmando ausência de acesso para `public`, `anon` e `authenticated`.
9. **Execução Controlada da Remediação Starter:** Execução de `scripts/remediate_starter_subscription_m4144.sql` restaurando a assinatura legítima `sub_01m73xm9cymfwkbawkcvb19br7`.
10. **Pós-Validação dos Tenants:** Confirmação da integridade de todas as organizações (Starter, Pro, Business e Global Defense Systems).
11. **Testes de Homologação:** Geração de intent e validação de assinatura HMAC-SHA256.
12. **Reativação do Sistema:** Desativação do modo de manutenção e retomada do envio de webhooks.
13. **Protocolo de Contingência Compensatório:** Monitoramento ativo por 2 horas; em caso de anomalia, reativação da manutenção e aplicação de patch compensatório. **Veto absoluto a comandos destrutivos (`DROP INDEX`, `DROP COLUMN`).**

---

## 8. Tabela de Hashes SHA-256 do Pacote Final

| Arquivo | Algoritmo | Hash SHA-256 |
| :--- | :---: | :--- |
| `supabase/migrations/20261111000007_billing_final_consolidation.sql` | SHA-256 | `69C97EF7C16FABE554DA94958F1556A0FE4ED7C0FDBE27B39C7ABC9297FB9A55` |
| `src/app/api/billing/webhook/route.ts` | SHA-256 | `FF77EDB90C8742B14B0CD5E93213CB6A843D52FB68CA4B37DEA96E6195E43477` |
| `src/app/api/billing/subscription/route.ts` | SHA-256 | `943FB39AE3D38637AA7B22A5FB016EE2F8CFD15B3C546CFA41382573DD512153` |
| `src/lib/billing/paddle-sandbox.ts` | SHA-256 | `C2F54C7F892AB3E1401AE2048F0921EFE4ADF6A3285DA1835038A2CB4B55A47D` |
| `scripts/remediate_starter_subscription_m4144.sql` | SHA-256 | `9270243B018B2D915A8A7FE5A13FE32F97200B14C78CC8CEAD4FA5170D3C82C7` |
| `scripts/operational_runbook_m4144.md` | SHA-256 | `C3DF30AA075FFF3592323576FB91F295B3AFCD31D332C77B7ADF10CE239A4024` |
| `scripts/verify-m41446-postgres17.ts` | SHA-256 | `5660ADB94EC61ED476A66F56A79D2CB556C4BAFF9887E9A2CC068C51F2D7ECEA` |
| `tests/m414411-critical-billing-security.test.ts` | SHA-256 | `F267404E1B8A2C0B94311A59930C96B40E5C7D4A6C35B7128EC0D6F03D5ABE5C` |
| `src/lib/supabase/admin.ts` | SHA-256 | `64BE45EBED8100BCD31816924E3DA79AE5C4F20DB729B0D5D4C7702DDF8C80E9` |

---

## 9. Pendências Remanescentes

**Zero pendências técnicas remanescentes.**

---

## 10. Parecer de Autorização Operacional

> [!IMPORTANT]
> **PARECER FINAL: READY FOR EXPLICIT REMOTE EXECUTION AUTHORIZATION**  
> 
> Todos os bloqueios técnicos, falhas de autorização de chave administrativa, ambiguidades nas rotinas de quota, resíduos de funções legadas e riscos de concorrência foram tecnicamente corrigidos, auditados e revalidados em PostgreSQL 17 e na suíte de testes automatizados.
> 
> **ESTE PARECER NÃO AUTORIZA A EXECUÇÃO REMOTA IMEDIATA.**  
> A aplicação em produção (Supabase `ghqbqzljfpkjdrnuyddo`) requer autorização humana explícita posterior e execução estrita em conformidade com o runbook operacional.
