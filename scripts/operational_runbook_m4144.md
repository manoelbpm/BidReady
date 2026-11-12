# BIDREADY: RUNBOOK OPERACIONAL DEFINITIVO DE BILLING (13 ETAPAS)
# MILESTONE: FINAL PATCH (Quota Reservation Recovery & Identity Binding)
# TARGET PROJECT: ghqbqzljfpkjdrnuyddo (Supabase PostgreSQL 17.11)
# STATUS: AGUARDANDO AUTORIZAÇÃO HUMANA EXPRESSA (ZERO MUTAÇÕES REMOTAS ATIVAS)

---

## 1. PRÉ-VERIFICAÇÕES INICIAIS DE SISTEMA
1. Confirmar conectividade e versão do PostgreSQL remoto no Supabase SQL Editor:
```sql
SELECT version();
-- DEVE retornar: PostgreSQL 17.11 no x86_64
```
2. Confirmar o estado inicial da assinatura Starter na organização alvo:
```sql
SELECT id, organization_id, plan, status, provider_subscription_id, provider_customer_id, current_period_start, current_period_end
FROM public.saas_subscriptions 
WHERE organization_id = 'e2e00000-0000-4000-a000-000000000010';
```
*Critério de aceitação:* Retorna registro com `provider_subscription_id = 'sub_legitimate_test_1794361279434'`.

---

## 2. BACKUP E PROCEDIMENTO COMPLETO DE RECUPERAÇÃO (TODAS AS TABELAS AFETADAS)
1. Exportar o backup lógico integral (dados completos, colunas e registros, não apenas contagens) das três tabelas de billing afetadas via consulta JSON:
```sql
SELECT jsonb_build_object(
  'exported_at', NOW(),
  'billing_webhook_events', (SELECT jsonb_agg(to_jsonb(w)) FROM public.billing_webhook_events w),
  'checkout_intents', (SELECT jsonb_agg(to_jsonb(c)) FROM public.checkout_intents c),
  'saas_subscriptions', (SELECT jsonb_agg(to_jsonb(s)) FROM public.saas_subscriptions s)
) AS pre_maintenance_backup;
```
2. Salvar o output JSON resultante em arquivo local de contingência (ex: `scripts/backup_pre_maintenance_20261111.json`).
3. **Mecanismo de Restauração Lógica Completo (Validado em PostgreSQL 17):**
Em caso de necessidade de reversão, a restauração deve ser executada estritamente na ordem correta de dependências relacionais, atualizando apenas os registros do snapshot e preservando intactos quaisquer eventos ou dados legítimos criados posteriormente:

```sql
-- ORDEM 1: Restauração de billing_webhook_events (tabela independente sem Foreign Keys)
INSERT INTO public.billing_webhook_events (
  id, provider, event_id, event_type, payload, processed_successfully, error_message, processed_at
)
SELECT 
  (e->>'id')::uuid,
  e->>'provider',
  e->>'event_id',
  e->>'event_type',
  (e->'payload')::jsonb,
  (e->>'processed_successfully')::boolean,
  e->>'error_message',
  (e->>'processed_at')::timestamptz
FROM jsonb_array_elements(:'backup_json'::jsonb->'billing_webhook_events') AS e
ON CONFLICT (event_id) DO UPDATE SET
  provider = EXCLUDED.provider,
  event_type = EXCLUDED.event_type,
  payload = EXCLUDED.payload,
  processed_successfully = EXCLUDED.processed_successfully,
  error_message = EXCLUDED.error_message,
  processed_at = EXCLUDED.processed_at;

-- ORDEM 2: Restauração de checkout_intents (preserva FKs para organizations e auth.users)
INSERT INTO public.checkout_intents (
  id, organization_id, user_id, intent_token, plan_id, price_id, quantity, status, expires_at, created_at
)
SELECT 
  (c->>'id')::uuid,
  (c->>'organization_id')::uuid,
  (c->>'user_id')::uuid,
  c->>'intent_token',
  (c->>'plan_id')::plan_tier,
  c->>'price_id',
  (c->>'quantity')::integer,
  c->>'status',
  (c->>'expires_at')::timestamptz,
  (c->>'created_at')::timestamptz
FROM jsonb_array_elements(:'backup_json'::jsonb->'checkout_intents') AS c
ON CONFLICT (intent_token) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  user_id = EXCLUDED.user_id,
  plan_id = EXCLUDED.plan_id,
  price_id = EXCLUDED.price_id,
  quantity = EXCLUDED.quantity,
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at,
  created_at = EXCLUDED.created_at;

-- ORDEM 3: Restauração de saas_subscriptions (preserva FK para organizations)
INSERT INTO public.saas_subscriptions (
  id, organization_id, plan, status, monthly_analyses_limit, analyses_used_in_period,
  current_period_start, current_period_end, grace_period_ends_at, billing_provider,
  provider_customer_id, provider_subscription_id, cancel_at_period_end, created_at, updated_at
)
SELECT 
  (s->>'id')::uuid,
  (s->>'organization_id')::uuid,
  (s->>'plan')::plan_tier,
  (s->>'status')::subscription_lifecycle,
  (s->>'monthly_analyses_limit')::integer,
  (s->>'analyses_used_in_period')::integer,
  (s->>'current_period_start')::timestamptz,
  (s->>'current_period_end')::timestamptz,
  (s->>'grace_period_ends_at')::timestamptz,
  s->>'billing_provider',
  s->>'provider_customer_id',
  s->>'provider_subscription_id',
  (s->>'cancel_at_period_end')::boolean,
  (s->>'created_at')::timestamptz,
  (s->>'updated_at')::timestamptz
FROM jsonb_array_elements(:'backup_json'::jsonb->'saas_subscriptions') AS s
ON CONFLICT (organization_id) DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  monthly_analyses_limit = EXCLUDED.monthly_analyses_limit,
  analyses_used_in_period = EXCLUDED.analyses_used_in_period,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  grace_period_ends_at = EXCLUDED.grace_period_ends_at,
  billing_provider = EXCLUDED.billing_provider,
  provider_customer_id = EXCLUDED.provider_customer_id,
  provider_subscription_id = EXCLUDED.provider_subscription_id,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;
```

4. **Matriz de Validação de Restauração (Comprovada em PostgreSQL 17 Isolado):**
| Cenário Operacional | Ação Pós-Backup | Comportamento do Restore | Resultado Validado |
|---|---|---|:---:|
| **1. Alteração posterior de registro existente** | Registro alterado (ex: plano alterado de `starter` para `free`) | Reverte colunas para o estado exato do snapshot via UPSERT | **RESTAURADO** |
| **2. Exclusão posterior de registro existente** | Registro deletado acidentalmente (ex: `checkout_intents`) | Cláusula `INSERT` do UPSERT reinserirá o registro ausente | **RESTAURADO** |
| **3. Inclusão de registro posterior** | Novo tenant ou assinatura inserida após o backup | Não consta no JSON de backup; UPSERT não toca nesta chave | **PRESERVADO** |
| **4. Preservação de evento de webhook posterior** | Novo evento de webhook recebido pós-backup | Chave `event_id` nova não sofre mutação nem exclusão | **PRESERVADO** |
| **5. Integridade de FKs, constraints e unicidade** | Validação de unicidade e vínculos relacionais | Constraints `saas_subscriptions_org_key`, FKs e índice único parcial ativamente validados | **PRESERVADO** |

*Critério de aceitação:* Arquivo JSON de backup exportado, não-vazio e conferido antes de qualquer intervenção.
```
*Critério de aceitação:* Arquivo JSON de backup exportado, não-vazio e conferido antes de qualquer intervenção.

---

## 3. ATIVAÇÃO DO MODO DE MANUTENÇÃO
1. No painel de configuração da aplicação (Vercel / Ambiente de Produção):
   - Definir a variável de ambiente: `BILLING_MAINTENANCE_MODE=true`.
   - Com essa flag ativa:
     - `POST /api/billing/webhook` responde **HTTP 503 com `Retry-After: 60`**, instruindo a Paddle a reter e retentar os webhooks automaticamente.
     - `POST /api/billing/subscription` responde **HTTP 503**, rejeitando novas alterações administrativas.

---

## 4. BLOQUEIO TEMPORÁRIO DE NOVAS OPERAÇÕES DE BILLING
1. No painel da **Paddle Sandbox** (Developer -> Notifications / Webhooks):
   - Pausar temporariamente o destino de webhooks como camada redundante de contenção externa.
2. Confirmar que requisições de teste ao endpoint `/api/billing/webhook` retornam imediatamente HTTP 503.

---

## 5. DRENAGEM DE OPERAÇÕES EM ANDAMENTO
1. Aguardar 30 segundos após a ativação do modo de manutenção para que quaisquer requisições HTTP em voo concluam.
2. Monitorar os logs de runtime da Vercel/Node.js para confirmar que o tráfego em `/api/billing/*` cessou completamente.

---

## 6. DIAGNÓSTICO DE CONEXÕES, TRANSAÇÕES E CRITÉRIOS DE LOCKS
1. Executar consulta de diagnóstico detalhada para avaliar conexões, transações e bloqueadores efetivos via `pg_blocking_pids()`:
```sql
SELECT
    a.pid,
    a.usename,
    a.application_name,
    a.client_addr,
    a.state,
    now() - a.state_change AS state_age,
    now() - a.query_start AS query_age,
    pg_blocking_pids(a.pid) AS blocked_by,
    ARRAY(
        SELECT blocking_pid 
        FROM pg_stat_activity ba, unnest(pg_blocking_pids(ba.pid)) AS blocking_pid 
        WHERE blocking_pid = a.pid
    ) AS is_blocking_pids,
    c.relname AS target_table,
    l.mode AS lock_mode,
    l.granted,
    CASE
        WHEN cardinality(pg_blocking_pids(a.pid)) > 0 OR EXISTS (
            SELECT 1 FROM pg_stat_activity ba WHERE a.pid = ANY(pg_blocking_pids(ba.pid))
        ) THEN 'EFFECTIVE_BLOCKER'
        WHEN a.state IN ('idle in transaction', 'idle in transaction (aborted)') THEN 'OPEN_TRANSACTION'
        WHEN l.mode IN ('AccessExclusiveLock', 'ExclusiveLock', 'ShareRowExclusiveLock') AND l.granted THEN 'HEAVY_DDL_LOCK'
        WHEN a.state = 'active' AND (now() - a.query_start) > interval '5 seconds' THEN 'LONG_RUNNING_QUERY'
        ELSE 'BENIGN_TRANSIENT'
    END AS risk_classification,
    LEFT(a.query, 120) AS query_sample
FROM pg_stat_activity a
LEFT JOIN pg_locks l ON a.pid = l.pid
LEFT JOIN pg_class c ON l.relation = c.oid
WHERE a.pid <> pg_backend_pid()
  AND (
    c.relname IN ('saas_subscriptions', 'billing_webhook_events', 'checkout_intents', 'quota_reservations', 'organizations', 'schema_migrations')
    OR a.state IN ('idle in transaction', 'idle in transaction (aborted)')
    OR cardinality(pg_blocking_pids(a.pid)) > 0
  )
ORDER BY a.state_change ASC;
```
2. **Critérios Técnicos Reais para Iniciar a Manutenção:**
   - **Sessões `idle` de Pool:** Conexões em pool (PgBouncer, Supavisor, PostgREST) são normais, inofensivas e **não bloqueiam a manutenção**.
   - **Locks de Leitura Benignos:** Leituras transitórias instantâneas (`AccessShareLock`) em tabelas não-relacionadas ou de healthcheck são permitidas.
   - **Distinção de `RowExclusiveLock`:** `RowExclusiveLock` ocorre em comandos comuns de manipulação (`INSERT`/`UPDATE`). Ele **não é classificado isoladamente como conflito automático**; apenas se torna bloqueador se houver dependência mútua detectada por `pg_blocking_pids()` ou se for mantido por transação aberta ociosa.
   - **Critérios de Bloqueio Rígidos (DEVE SER RIGOROSAMENTE 0):**
     - `EFFECTIVE_BLOCKER`: Zero processos bloqueando ou sendo bloqueados por outros (`cardinality(pg_blocking_pids) > 0`).
     - `OPEN_TRANSACTION`: Zero sessões em `idle in transaction` ou `idle in transaction (aborted)` segurando locks em relações de billing.
     - `HEAVY_DDL_LOCK`: Zero locks exclusivos pesados (`AccessExclusiveLock`, `ExclusiveLock`, `ShareRowExclusiveLock`) nas relações afetadas.
     - `LONG_RUNNING_QUERY`: Zero consultas ativas com duração superior a 5 segundos nas tabelas afetadas.
   - **PROIBIÇÃO DE TERMINAÇÃO FORÇADA:** É vedado o uso de `pg_terminate_backend`. Se houver transações conflitantes, aguardar a drenagem natural.

---

## 7. FASE 4: APLICAÇÃO DA MIGRATION CONSOLIDADA E ALINHAMENTO DE HISTÓRICO SUPABASE CLI
1. **Comprovação e Reconciliação do Escopo das Migrations (0002 a 0006):**
   - O catálogo remoto `supabase_migrations.schema_migrations` possui unicamente a versão `20261110165931` (`20261110000001_core_schema`).
   - O diretório local possui 7 arquivos de migration (0001 a 0007).
   - A reconciliação individual 1:1 comprovou:
     - `0002_rls_policies`: **RECONCILIADA 100%** (todas as 12 tabelas com RLS, funções, trigger e policies verificadas).
     - `0003_evidence_and_matching`: **RECONCILIADA 100%** (3 enums, colunas adicionadas, 3 tabelas, 7 índices e policies verificadas).
     - `0004_billing_and_subscriptions`: **RECONCILIADA 100%** (enums, tabelas `saas_subscriptions`, `billing_webhook_events`, `usage_audit_logs`, 4 índices e policies verificadas).
     - `0005_secure_checkout_intents_rpc`: **RECONCILIADA 100%** (privilégios restritos a `postgres` e `service_role` em `checkout_intents` e `create_checkout_intent`).
     - `0006_unique_provider_subscription_id`: **DIVERGÊNCIA / NÃO APLICADA** (índice `idx_saas_sub_provider_id_unique` não existe no banco remoto).
2. **Procedimento de Segurança Obrigatório (Alinhamento de Histórico):**
   - É **proibido** marcar a migration 0006 como aplicada, pois seus objetos não existem no catálogo remoto.
   - Alinhar formalmente o histórico na CLI marcando **apenas as migrations 0002 a 0005** como aplicadas:
     ```bash
     npx supabase migration repair --status applied 20261110000002
     npx supabase migration repair --status applied 20261110000003
     npx supabase migration repair --status applied 20261110000004
     npx supabase migration repair --status applied 20261110000005
     ```
   - As migrations `20261111000006` e `20261111000007` **permanecem como pendentes** para aplicação legítima e sequencial.
3. **Validação Prévia do Dry-Run:**
   - Executar dry-run para comprovar que as migrations pendentes são exclusivamente a 0006 e a 0007:
     ```bash
     npx supabase db push --dry-run
     ```
   - **Critério de parada estrito:** As únicas migrations pendentes listadas devem ser:
     1. `20261111000006_unique_provider_subscription_id.sql`
     2. `20261111000007_billing_final_consolidation.sql`
4. **Aplicação Oficial:**
   - Executar a aplicação controlada:
     ```bash
     npx supabase db push
     ```
   - A CLI executa a migration 0006 (criando o índice único parcial) e em seguida a consolidada 0007 (dentro de transações atômicas com `BEGIN ... COMMIT`) e grava os registros oficiais em `schema_migrations`, impedindo reaplicações acidentais futuras.

---

## 8. FASE 5A: VERIFICAÇÃO ESTRUTURAL E PRIVILÉGIOS (PRÉ-REQUISITO DA REMEDIAÇÃO)
1. Executar consulta de auditoria de privilégios no catálogo oficial do Supabase:
```sql
SELECT 
  p.proname,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_privilege,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_privilege,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_privilege,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_privilege
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'process_paddle_webhook_transaction',
    'apply_paddle_subscription_update',
    'create_checkout_intent',
    'mark_paddle_webhook_processed',
    'check_webhook_event_processed',
    'get_organization_subscription',
    'reserve_analysis_quota',
    'release_analysis_quota',
    'consume_analysis_quota',
    'reconcile_quota_reservation'
  );
```
*Critério de parada estrito:*
- `public_privilege` = **false** para todas as 10 funções.
- `anon_privilege` = **false** para todas as 10 funções.
- `authenticated_privilege` = **false** para todas as 10 funções.
- `service_role_privilege` = **true** para todas as 10 funções.

2. Confirmar que as funções legadas de teste foram excluídas:
```sql
SELECT count(*) FROM pg_proc WHERE proname IN ('create_test_checkout_intent_fixture', 'get_checkout_intent_audit', 'setup_checkout_intents_schema');
```
*Critério de aceitação:* DEVE retornar **0**.

3. Confirmar a existência da coluna `last_event_occurred_at`:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'saas_subscriptions' AND column_name = 'last_event_occurred_at';
```
*Critério de aceitação:* DEVE retornar 1 linha (`timestamp with time zone`).

---

## 9. FASE 5B: EXECUÇÃO CONTROLADA DA RECUPERAÇÃO STARTER
1. Revalidar que os dados na Paddle Sandbox permanecem ativos:
   - Subscription: `sub_01m73xm9cymfwkbawkcvb19br7`
   - Customer: `ctm_01m73w7d3pc1sna6v8a9fy1vqx`
   - Organization: `e2e00000-0000-4000-a000-000000000010`
2. Executar no Supabase SQL Editor o script integral de recuperação:
   `scripts/remediate_starter_subscription_m4144.sql`
3. Verificar a mensagem de sucesso no output do PostgreSQL:
   `NOTICE: SUCCESS: Starter Organization e2e00000-0000-4000-a000-000000000010 successfully restored to official Paddle Subscription sub_01m73xm9cymfwkbawkcvb19br7`.

---

## 10. VERIFICAÇÃO INTEGRAL DAS ASSINATURAS E PERÍODOS DE COBRANÇA
1. Validar o registro final persistido na organização Starter:
```sql
SELECT id, organization_id, plan, status, provider_subscription_id, provider_customer_id, current_period_start, current_period_end, last_event_occurred_at
FROM public.saas_subscriptions 
WHERE organization_id = 'e2e00000-0000-4000-a000-000000000010';
```
*Critério de aceitação:*
- `provider_subscription_id` = `'sub_01m73xm9cymfwkbawkcvb19br7'`
- `provider_customer_id` = `'ctm_01m73w7d3pc1sna6v8a9fy1vqx'`
- `last_event_occurred_at` = `'2026-11-10 23:45:25.025182+00'`
- `plan` = `'starter'`
- `status` = `'active'`
- `monthly_analyses_limit` = `10`

2. Confirmar que os demais tenants (ex: Global Defense Systems `b22937b6-51e5-48a0-a75d-7b3405427298`) permanecem 100% inalterados:
```sql
SELECT organization_id, plan, status, provider_subscription_id FROM public.saas_subscriptions;
```

---

## 11. TESTES DE CHECKOUT E WEBHOOK EM SANDBOX
1. No ambiente de homologação conectado ao backend, testar a geração de intent:
   - `POST /api/billing/checkout` -> confirma retorno de `intentToken` criptográfico.
2. Enviar um webhook de teste via Paddle Simulator para endpoint de staging ou rota local:
   - Valida cálculo de HMAC-SHA256 e tolerância temporal de 5 segundos.

---

## 12. REATIVAÇÃO CONTROLADA DO BILLING
1. No painel de configuração da aplicação (Vercel / Produção):
   - Remover ou definir `BILLING_MAINTENANCE_MODE=false`.
2. No painel da Paddle Sandbox:
   - Reativar o envio de notificações de webhook.
3. Observar os logs da aplicação: as notificações retidas durante a janela de manutenção serão entregues e processadas com sucesso.

---

## 13. FASE 7: PROTOCOLO DE CONTINGÊNCIA E CRITÉRIOS DE ROLLBACK COMPENSATÓRIO
1. **Monitoramento Ativo (primeiras 2 horas pós-reativação):**
   - Inspecionar `SELECT count(*), bool_and(processed_successfully) FROM public.billing_webhook_events WHERE processed_at > NOW() - interval '2 hours';`.
   - Monitorar taxa de erros HTTP 5xx nas rotas `/api/billing/*`.
2. **Critérios de Contingência e Mitigação Compensatória:**
   - Caso qualquer anomalia crítica seja identificada:
     1. Reativar imediatamente `BILLING_MAINTENANCE_MODE=true` e pausar webhooks na Paddle.
     2. **PROIBIÇÃO DE COMANDOS DESTRUTIVOS:** **NUNCA executar `DROP INDEX` ou `DROP COLUMN`**. A eliminação de índices ou colunas destrói histórico temporal e remove a proteção relacional contra colisões cross-tenant.
     3. Diagnosticar a causa-raiz inspecionando `billing_webhook_events.error_message`.
     4. Se for necessário ajuste de código ou procedimento, aplicar uma nova migration numerada compensatória (ex: `20261111000008_billing_patch.sql`) em bloco transacional.
