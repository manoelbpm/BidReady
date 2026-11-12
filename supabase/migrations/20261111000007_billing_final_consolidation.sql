-- ============================================================================
-- BIDREADY: MIGRATION CONSOLIDADA DE BILLING (M4.14.4.12)
-- Migration: 20261111000007_billing_final_consolidation.sql
-- Descrição:
--   1. Revoga CREATE no schema public para PUBLIC (segurança de schema).
--   2. Adiciona coluna last_event_occurred_at em saas_subscriptions (se não existir).
--   3. Cria índice único parcial idx_saas_sub_provider_id_unique contra colisão cross-tenant.
--   4. Elimina todas as sobrecargas obsoletas, fixtures de teste e procedures inseguras.
--   5. Implementa process_paddle_webhook_transaction com:
--      - Lock hierárquico à prova de deadlocks: Event Advisory Lock -> Event Row Lock -> Intent Lock -> Org Advisory Lock -> Sub Row Lock.
--      - Idempotência real: revalidação de processed_successfully após aquisição de locks.
--      - Validação estrita de occurred_at (rejeição de payloads sem timestamp válido).
--      - Validação estrita de checkout intent na 1ª associação: token, org, plano e price_id obrigatórios (sem bypass de NULL).
--      - Preservação estrita de períodos de cobrança existentes (sem sobrescrita por NOW() artificial).
--      - Catálogo oficial fechado: Free (2), Starter (10), Pro (40), Business (120).
--      - Proteção contra substituição arbitrária de assinaturas ativas e descarte seguro de eventos fora de ordem.
--   6. Implementa apply_paddle_subscription_update para operações de plataforma com:
--      - Lock consultivo transacional.
--      - Validação estrita de limites do catálogo.
--      - Proteção contra colisão cross-tenant.
--   7. Configura permissões estritas: REVOKE ALL em todas as RPCs para PUBLIC, anon e authenticated
--      e GRANT exclusivo para service_role e postgres.
--   8. Hardening da trilha de auditoria (usage_audit_logs): remove política de inserção direta
--      por authenticated, revoga DML de PUBLIC, anon e authenticated, e restringe INSERT a service_role e postgres.
-- ============================================================================

-- 1. SEGURANÇA DE SCHEMA: Revogação de permissão CREATE em public para PUBLIC
CREATE SCHEMA IF NOT EXISTS auth;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;


-- 2. ESTRUTURA: Coluna de auditoria de ordenação temporal de eventos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'saas_subscriptions' 
      AND column_name = 'last_event_occurred_at'
  ) THEN
    ALTER TABLE public.saas_subscriptions 
    ADD COLUMN last_event_occurred_at timestamp with time zone;
  END IF;
END $$;

-- 3. INTEGRIDADE: Índice único parcial para garantir que nenhum provider_subscription_id seja compartilhado
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_sub_provider_id_unique
ON public.saas_subscriptions (provider_subscription_id)
WHERE provider_subscription_id IS NOT NULL;

-- 4. ELIMINAÇÃO DE SOBRECARGAS OBSOLETAS E FIXTURES INSEGURAS
DROP FUNCTION IF EXISTS public.process_paddle_webhook_transaction(text, text, uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, jsonb, text);
DROP FUNCTION IF EXISTS public.process_paddle_webhook_transaction(text, text, text, jsonb, uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone);
DROP FUNCTION IF EXISTS public.apply_paddle_subscription_update(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer);
DROP FUNCTION IF EXISTS public.apply_paddle_subscription_update(uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone);
DROP FUNCTION IF EXISTS public.mark_paddle_webhook_processed(text, boolean, text);
DROP FUNCTION IF EXISTS public.check_webhook_event_processed(text);
DROP FUNCTION IF EXISTS public.get_organization_subscription(uuid);
DROP FUNCTION IF EXISTS public.create_checkout_intent(uuid, uuid, plan_tier, text, integer);
DROP FUNCTION IF EXISTS public.create_test_checkout_intent_fixture(uuid, text, text);
DROP FUNCTION IF EXISTS public.create_test_checkout_intent_fixture(text, uuid, uuid, plan_tier, text, text, timestamp with time zone, text);
DROP FUNCTION IF EXISTS public.get_checkout_intent_audit(text);
DROP FUNCTION IF EXISTS public.setup_checkout_intents_policies();
DROP FUNCTION IF EXISTS public.setup_checkout_intents_schema();
DROP FUNCTION IF EXISTS public.apply_checkout_intents_hardening();
DROP FUNCTION IF EXISTS public.clean_checkout_intents_policies();
DROP FUNCTION IF EXISTS public.record_paddle_webhook_event(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.release_analysis_quota(uuid);
DROP FUNCTION IF EXISTS public.release_analysis_quota(uuid, uuid);
DROP FUNCTION IF EXISTS public.reserve_analysis_quota(uuid);
DROP FUNCTION IF EXISTS public.reserve_analysis_quota(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.consume_analysis_quota(uuid, uuid);

-- 4B. TABELA DE AUDITORIA E CONTROLE DE RESERVAS DE QUOTA (M4.14.4.15)
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

-- 4C. FUNÇÃO AUXILIAR DE MEMBERSHIP COM SEGURANÇA REFORÇADA
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role, postgres;



-- 5. PROCEDURE CONSOLIDADA DE PROCESSAMENTO DE WEBHOOK PADDLE
CREATE OR REPLACE FUNCTION public.process_paddle_webhook_transaction(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_organization_id uuid DEFAULT NULL::uuid,
  p_plan plan_tier DEFAULT NULL::plan_tier,
  p_status subscription_lifecycle DEFAULT NULL::subscription_lifecycle,
  p_provider_sub_id text DEFAULT NULL::text,
  p_provider_cust_id text DEFAULT NULL::text,
  p_cancel_at_period_end boolean DEFAULT NULL::boolean,
  p_analyses_limit integer DEFAULT NULL::integer,
  p_grace_period_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_row_id uuid;
  v_already_successful boolean;
  v_event_prev_error text;
  v_existing_org_id uuid;
  v_intent_token text;
  v_intent record;
  v_has_intent boolean := false;
  v_payload_price_id text;
  v_occurred_at_raw text;
  v_event_occurred_at timestamp with time zone;
  v_current_sub_id text;
  v_current_status subscription_lifecycle;
  v_current_last_event timestamp with time zone;
  v_existing_period_start timestamp with time zone;
  v_existing_period_end timestamp with time zone;
  v_catalog_limit integer;
  v_period_start timestamp with time zone;
  v_period_end timestamp with time zone;
BEGIN
  -- 1. Validação de identificador do evento
  IF p_event_id IS NULL OR trim(p_event_id) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', false,
      'error', 'Missing event_id in webhook transaction call'
    );
  END IF;

  -- 2. Extração e validação estrita de timestamp occurred_at
  v_occurred_at_raw := p_payload->>'occurred_at';
  IF v_occurred_at_raw IS NULL OR trim(v_occurred_at_raw) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', false,
      'event_id', p_event_id,
      'error', 'Missing occurred_at in webhook payload'
    );
  END IF;

  BEGIN
    v_event_occurred_at := v_occurred_at_raw::timestamp with time zone;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'duplicate', false,
      'event_id', p_event_id,
      'error', 'Invalid occurred_at timestamp format in webhook payload'
    );
  END;

  -- 3. NÍVEL 1 DE LOCK: Lock consultivo transacional no event_id (Serialização de duplicatas concorrentes)
  PERFORM pg_advisory_xact_lock(hashtext('bidready_event_lock'), hashtext(p_event_id));

  -- 4. NÍVEL 2 DE LOCK: Inserção atômica e bloqueio da linha em billing_webhook_events
  INSERT INTO public.billing_webhook_events (
    provider,
    event_id,
    event_type,
    payload,
    processed_successfully,
    processed_at
  ) VALUES (
    COALESCE(p_provider, 'paddle'),
    p_event_id,
    p_event_type,
    p_payload,
    false,
    NOW()
  ) ON CONFLICT (event_id) DO NOTHING;

  SELECT id, processed_successfully, error_message
  INTO v_event_row_id, v_already_successful, v_event_prev_error
  FROM public.billing_webhook_events
  WHERE event_id = p_event_id
  FOR UPDATE;

  -- 5. Revalidação de idempotência pós-locks
  IF v_already_successful = TRUE THEN
    RETURN jsonb_build_object(
      'success', true,
      'duplicate', true,
      'event_id', p_event_id,
      'organization_id', p_organization_id
    );
  END IF;

  -- 6. Acknowledge seguro para eventos genéricos ou de teste sem contexto comercial
  IF p_organization_id IS NULL AND p_provider_sub_id IS NULL THEN
    UPDATE public.billing_webhook_events
    SET processed_successfully = true,
        error_message = NULL,
        processed_at = NOW()
    WHERE event_id = p_event_id;

    RETURN jsonb_build_object(
      'success', true,
      'duplicate', false,
      'event_id', p_event_id,
      'is_generic', true
    );
  END IF;

  -- 7. Extração rigorosa de price_id do payload da Paddle
  v_payload_price_id := COALESCE(
    p_payload->'data'->'items'->0->'price'->>'id',
    p_payload->'data'->'items'->0->>'price_id',
    p_payload->'data'->'details'->'line_items'->0->'item'->'price'->>'id',
    p_payload->'data'->'details'->'line_items'->0->>'price_id',
    p_payload->'data'->>'price_id'
  );

  -- 8. Vinculação Autoritativa de Assinatura e Validação de Checkout Intent
  IF p_provider_sub_id IS NOT NULL AND trim(p_provider_sub_id) <> '' THEN
    SELECT organization_id INTO v_existing_org_id
    FROM public.saas_subscriptions
    WHERE provider_subscription_id = p_provider_sub_id;

    IF v_existing_org_id IS NOT NULL THEN
      -- Evento subsequente: A assinatura já está registrada e vinculada a um tenant
      IF p_organization_id IS NOT NULL AND p_organization_id <> v_existing_org_id THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Conflict: Subscription %s already belongs to organization %s', p_provider_sub_id, v_existing_org_id)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Conflict: Subscription %s already belongs to organization %s', p_provider_sub_id, v_existing_org_id)
        );
      END IF;

      -- Adota a organização registrada como autoritativa
      p_organization_id := v_existing_org_id;
    ELSE
      -- Primeira associação: DEVE possuir checkout intent válida (SEM fallback por organização/plano)
      v_intent_token := COALESCE(
        p_payload->'data'->'custom_data'->>'intent_token',
        p_payload->'data'->'custom_data'->>'intent_id',
        p_payload->'custom_data'->>'intent_token',
        p_payload->'custom_data'->>'intent_id'
      );

      IF v_intent_token IS NULL OR trim(v_intent_token) = '' THEN
        UPDATE public.billing_webhook_events
        SET error_message = 'No checkout intent token provided. First subscription association requires a valid intent token.'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', 'No checkout intent token provided. First subscription association requires a valid intent token.'
        );
      END IF;

      -- NÍVEL 3 DE LOCK: Lock consultivo na intent token e bloqueio da linha
      PERFORM pg_advisory_xact_lock(hashtext('bidready_intent_lock'), hashtext(v_intent_token));

      SELECT * INTO v_intent
      FROM public.checkout_intents
      WHERE intent_token = v_intent_token
      FOR UPDATE;

      IF v_intent.id IS NULL THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Checkout intent %s not found', v_intent_token)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Checkout intent %s not found', v_intent_token)
        );
      END IF;

      IF v_intent.status = 'consumed' THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Checkout intent %s already consumed', v_intent_token)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Checkout intent %s already consumed', v_intent_token)
        );
      END IF;

      IF v_intent.status = 'expired' OR v_intent.expires_at <= NOW() THEN
        UPDATE public.checkout_intents SET status = 'expired' WHERE id = v_intent.id;
        UPDATE public.billing_webhook_events
        SET error_message = format('Checkout intent %s expired', v_intent_token)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Checkout intent %s expired', v_intent_token)
        );
      END IF;

      IF v_intent.status <> 'pending' THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Checkout intent %s is not pending', v_intent_token)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Checkout intent %s is not pending', v_intent_token)
        );
      END IF;

      IF p_organization_id IS NOT NULL AND v_intent.organization_id <> p_organization_id THEN
        UPDATE public.billing_webhook_events
        SET error_message = 'Cross-tenant organization mismatch with checkout intent'
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', 'Cross-tenant organization mismatch with checkout intent'
        );
      END IF;

      -- Validação estrita de plano: Obrigatório e idêntico à intent (sem ignorar NULL)
      IF p_plan IS NULL OR v_intent.plan_id <> p_plan THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Intent plan %s does not match payload plan %s', v_intent.plan_id, p_plan)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Intent plan %s does not match payload plan %s', v_intent.plan_id, p_plan)
        );
      END IF;

      -- Validação estrita de price_id: Obrigatório e idêntico à intent (sem ignorar NULL)
      IF v_payload_price_id IS NULL OR v_intent.price_id <> v_payload_price_id THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Intent price %s does not match payload price %s', v_intent.price_id, v_payload_price_id)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Intent price %s does not match payload price %s', v_intent.price_id, v_payload_price_id)
        );
      END IF;

      -- Validação estrita de evento de ciclo de vida inicial
      IF p_event_type NOT IN ('subscription.created', 'subscription.activated', 'transaction.completed', 'transaction.paid') THEN
        UPDATE public.billing_webhook_events
        SET error_message = format('Invalid event type %s for initial subscription association', p_event_type)
        WHERE event_id = p_event_id;

        RETURN jsonb_build_object(
          'success', false,
          'duplicate', false,
          'event_id', p_event_id,
          'error', format('Invalid event type %s for initial subscription association', p_event_type)
        );
      END IF;

      -- Consumo atômico da intent
      UPDATE public.checkout_intents
      SET status = 'consumed',
          consumed_at = NOW(),
          consumed_by_provider_sub_id = p_provider_sub_id
      WHERE id = v_intent.id;

      v_has_intent := true;
      p_organization_id := v_intent.organization_id;
    END IF;
  ELSE
    -- Sem subscription_id em payload comercial
    IF p_organization_id IS NOT NULL THEN
      UPDATE public.billing_webhook_events
      SET error_message = 'Missing provider_subscription_id for commercial organization update'
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object(
        'success', false,
        'duplicate', false,
        'event_id', p_event_id,
        'error', 'Missing provider_subscription_id for commercial organization update'
      );
    END IF;
  END IF;

  -- 9. NÍVEL 4 DE LOCK: Lock consultivo serializado por organização
  PERFORM pg_advisory_xact_lock(hashtext('bidready_billing_mutation_lock'), hashtext(p_organization_id::text));

  -- 10. Revalidação de colisão cross-tenant pós-advisory lock
  IF p_provider_sub_id IS NOT NULL AND trim(p_provider_sub_id) <> '' THEN
    SELECT organization_id INTO v_existing_org_id
    FROM public.saas_subscriptions
    WHERE provider_subscription_id = p_provider_sub_id
      AND organization_id <> p_organization_id;

    IF FOUND THEN
      UPDATE public.billing_webhook_events
      SET error_message = format('CROSS-TENANT COLLISION: provider_subscription_id %s is already assigned to organization %s', p_provider_sub_id, v_existing_org_id)
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object(
        'success', false,
        'duplicate', false,
        'event_id', p_event_id,
        'error', format('CROSS-TENANT COLLISION: provider_subscription_id %s is already assigned to organization %s', p_provider_sub_id, v_existing_org_id)
      );
    END IF;
  END IF;

  -- 11. NÍVEL 5 DE LOCK: Inspeção e bloqueio da linha da organização em saas_subscriptions
  SELECT provider_subscription_id, status, last_event_occurred_at, current_period_start, current_period_end
  INTO v_current_sub_id, v_current_status, v_current_last_event, v_existing_period_start, v_existing_period_end
  FROM public.saas_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF FOUND THEN
    -- Descarte seguro de evento recebido fora de ordem temporal
    IF v_current_last_event IS NOT NULL AND v_event_occurred_at < v_current_last_event THEN
      UPDATE public.billing_webhook_events
      SET processed_successfully = true,
          error_message = NULL,
          processed_at = NOW()
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object(
        'success', true,
        'duplicate', false,
        'ignored_out_of_order', true,
        'current_last_event', v_current_last_event,
        'event_occurred_at', v_event_occurred_at,
        'organization_id', p_organization_id,
        'event_id', p_event_id
      );
    END IF;

    -- Bloqueio contra substituição desautorizada de assinatura ativa
    IF v_current_sub_id IS NOT NULL
       AND p_provider_sub_id IS NOT NULL
       AND v_current_sub_id <> p_provider_sub_id
       AND v_current_status = 'active'::subscription_lifecycle
       AND NOT v_has_intent THEN
      UPDATE public.billing_webhook_events
      SET error_message = 'Unauthorized replacement of active subscription'
      WHERE event_id = p_event_id;

      RETURN jsonb_build_object(
        'success', false,
        'duplicate', false,
        'event_id', p_event_id,
        'error', 'Unauthorized replacement of active subscription'
      );
    END IF;
  END IF;

  -- 12. Determinação estrita de limites conforme catálogo oficial do BidReady:
  -- Free (2), Starter (10), Pro (40), Business (120)
  CASE COALESCE(p_plan, 'free'::plan_tier)
    WHEN 'starter'::plan_tier THEN v_catalog_limit := 10;
    WHEN 'pro'::plan_tier THEN v_catalog_limit := 40;
    WHEN 'business'::plan_tier THEN v_catalog_limit := 120;
    ELSE v_catalog_limit := 2; -- free
  END CASE;

  -- 13. Preservação de períodos de cobrança existentes (sem sobrescrita por NOW() artificial)
  BEGIN
    v_period_start := (p_payload->'data'->'current_billing_period'->>'starts_at')::timestamp with time zone;
    v_period_end := (p_payload->'data'->'current_billing_period'->>'ends_at')::timestamp with time zone;
  EXCEPTION WHEN OTHERS THEN
    v_period_start := NULL;
    v_period_end := NULL;
  END;

  -- Se o payload não trouxer períodos de faturamento, preservar integralmente os períodos existentes
  IF v_period_start IS NULL THEN
    v_period_start := COALESCE(v_existing_period_start, NOW());
  END IF;

  IF v_period_end IS NULL THEN
    v_period_end := COALESCE(v_existing_period_end, NOW() + interval '30 days');
  END IF;

  -- 14. Atualização / Inserção Atômica em saas_subscriptions
  INSERT INTO public.saas_subscriptions (
    organization_id,
    plan,
    status,
    monthly_analyses_limit,
    analyses_used_in_period,
    current_period_start,
    current_period_end,
    grace_period_ends_at,
    billing_provider,
    provider_customer_id,
    provider_subscription_id,
    cancel_at_period_end,
    last_event_occurred_at,
    updated_at
  ) VALUES (
    p_organization_id,
    COALESCE(p_plan, 'free'::plan_tier),
    COALESCE(p_status, 'active'::subscription_lifecycle),
    v_catalog_limit,
    0,
    v_period_start,
    v_period_end,
    p_grace_period_ends_at,
    'paddle',
    NULLIF(trim(p_provider_cust_id), ''),
    NULLIF(trim(p_provider_sub_id), ''),
    COALESCE(p_cancel_at_period_end, false),
    v_event_occurred_at,
    NOW()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan = COALESCE(EXCLUDED.plan, public.saas_subscriptions.plan),
    status = COALESCE(EXCLUDED.status, public.saas_subscriptions.status),
    monthly_analyses_limit = EXCLUDED.monthly_analyses_limit,
    provider_subscription_id = COALESCE(EXCLUDED.provider_subscription_id, public.saas_subscriptions.provider_subscription_id),
    provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, public.saas_subscriptions.provider_customer_id),
    cancel_at_period_end = COALESCE(EXCLUDED.cancel_at_period_end, public.saas_subscriptions.cancel_at_period_end),
    grace_period_ends_at = EXCLUDED.grace_period_ends_at,
    current_period_start = COALESCE(EXCLUDED.current_period_start, public.saas_subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, public.saas_subscriptions.current_period_end),
    last_event_occurred_at = EXCLUDED.last_event_occurred_at,
    updated_at = NOW();

  -- 15. Atualização de status de sucesso do evento
  UPDATE public.billing_webhook_events
  SET processed_successfully = true,
      error_message = NULL,
      processed_at = NOW()
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'duplicate', false,
    'organization_id', p_organization_id,
    'event_id', p_event_id
  );
END;
$$;

-- 6. PROCEDURE ADMINISTRATIVA DE ATUALIZAÇÃO DE ASSINATURA (PLATAFORMA)
CREATE OR REPLACE FUNCTION public.apply_paddle_subscription_update(
  p_organization_id uuid,
  p_plan plan_tier,
  p_status subscription_lifecycle,
  p_provider_subscription_id text DEFAULT NULL::text,
  p_provider_customer_id text DEFAULT NULL::text,
  p_cancel_at_period_end boolean DEFAULT false,
  p_monthly_analyses_limit integer DEFAULT NULL::integer,
  p_grace_period_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_sub text;
  v_new_cust text;
  v_existing_org uuid;
  v_current_sub_id text;
  v_catalog_limit integer;
  v_sub_exists boolean;
BEGIN
  -- Lock consultivo serializado por organização
  PERFORM pg_advisory_xact_lock(hashtext('bidready_billing_mutation_lock'), hashtext(p_organization_id::text));

  v_new_sub := NULLIF(trim(p_provider_subscription_id), '');
  v_new_cust := NULLIF(trim(p_provider_customer_id), '');

  -- Determinação do limite estrito de análises do catálogo oficial:
  -- Free (2), Starter (10), Pro (40), Business (120)
  CASE p_plan
    WHEN 'starter'::plan_tier THEN v_catalog_limit := 10;
    WHEN 'pro'::plan_tier THEN v_catalog_limit := 40;
    WHEN 'business'::plan_tier THEN v_catalog_limit := 120;
    ELSE v_catalog_limit := 2; -- free
  END CASE;

  -- Rejeição de manipulação client-side do limite mensal
  IF p_monthly_analyses_limit IS NOT NULL AND p_monthly_analyses_limit <> v_catalog_limit THEN
    RAISE EXCEPTION 'INVALID LIMIT: Plan % requires exactly % analyses limit, got %', p_plan, v_catalog_limit, p_monthly_analyses_limit;
  END IF;

  -- Verificação de colisão cross-tenant
  IF v_new_sub IS NOT NULL THEN
    SELECT organization_id INTO v_existing_org
    FROM public.saas_subscriptions
    WHERE provider_subscription_id = v_new_sub
      AND organization_id <> p_organization_id;

    IF FOUND THEN
      RAISE EXCEPTION 'CROSS-TENANT COLLISION: provider_subscription_id % is already assigned to organization %', v_new_sub, v_existing_org;
    END IF;
  END IF;

  -- Consulta de assinatura existente
  SELECT provider_subscription_id INTO v_current_sub_id
  FROM public.saas_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  v_sub_exists := FOUND;

  IF NOT v_sub_exists THEN
    INSERT INTO public.saas_subscriptions (
      organization_id,
      plan,
      status,
      monthly_analyses_limit,
      analyses_used_in_period,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      billing_provider,
      provider_subscription_id,
      provider_customer_id,
      cancel_at_period_end,
      updated_at
    ) VALUES (
      p_organization_id,
      p_plan,
      p_status,
      v_catalog_limit,
      0,
      NOW(),
      NOW() + interval '30 days',
      p_grace_period_ends_at,
      'paddle',
      v_new_sub,
      v_new_cust,
      COALESCE(p_cancel_at_period_end, false),
      NOW()
    );
  ELSE
    -- Preservação do identificador existente caso parâmetro não forneça novo
    v_new_sub := COALESCE(v_new_sub, v_current_sub_id);

    UPDATE public.saas_subscriptions
    SET plan = p_plan,
        status = p_status,
        provider_subscription_id = v_new_sub,
        provider_customer_id = COALESCE(v_new_cust, provider_customer_id),
        cancel_at_period_end = COALESCE(p_cancel_at_period_end, cancel_at_period_end),
        monthly_analyses_limit = v_catalog_limit,
        grace_period_ends_at = p_grace_period_ends_at,
        updated_at = NOW()
    WHERE organization_id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_organization_id,
    'plan', p_plan,
    'status', p_status,
    'provider_subscription_id', v_new_sub,
    'provider_customer_id', v_new_cust,
    'monthly_limit', v_catalog_limit
  );
END;
$$;

-- 7. WEBHOOK AUDIT MARKER COM LIMPEZA DE ERROR_MESSAGE EM SUCESSO
CREATE OR REPLACE FUNCTION public.mark_paddle_webhook_processed(
  p_event_id text,
  p_success boolean,
  p_error_message text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.billing_webhook_events
  SET processed_successfully = p_success,
      error_message = CASE WHEN p_success THEN NULL ELSE p_error_message END,
      processed_at = NOW()
  WHERE event_id = p_event_id;
END;
$$;

-- 8. AUDITORIA DE EVENTOS DE WEBHOOK
CREATE OR REPLACE FUNCTION public.check_webhook_event_processed(
  p_event_id text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.billing_webhook_events
    WHERE event_id = p_event_id AND processed_successfully = true
  );
$$;

-- 9. CONSULTA DE ASSINATURA POR ORGANIZAÇÃO
CREATE OR REPLACE FUNCTION public.get_organization_subscription(
  p_organization_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub record;
BEGIN
  SELECT * INTO v_sub FROM public.saas_subscriptions WHERE organization_id = p_organization_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN to_jsonb(v_sub);
END;
$$;

-- 10. GERAÇÃO SEGURA DE CHECKOUT INTENT
CREATE OR REPLACE FUNCTION public.create_checkout_intent(
  p_organization_id uuid,
  p_user_id uuid,
  p_plan_id plan_tier,
  p_price_id text,
  p_expires_in_seconds integer DEFAULT 3600
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent_token text;
  v_expires_at timestamptz;
  v_record record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND role IN ('owner'::membership_role, 'admin'::membership_role)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Forbidden: User %s lacks owner/admin privileges for organization %s', p_user_id, p_organization_id)
    );
  END IF;

  v_intent_token := 'intent_' || floor(extract(epoch from now()) * 1000)::text || '_' || replace(gen_random_uuid()::text, '-', '');
  v_expires_at := NOW() + (p_expires_in_seconds || ' seconds')::interval;

  INSERT INTO public.checkout_intents (
    intent_token,
    organization_id,
    user_id,
    plan_id,
    price_id,
    status,
    expires_at,
    created_at
  ) VALUES (
    v_intent_token,
    p_organization_id,
    p_user_id,
    p_plan_id,
    p_price_id,
    'pending',
    v_expires_at,
    NOW()
  ) RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', true,
    'intent_token', v_record.intent_token,
    'organization_id', v_record.organization_id,
    'plan_id', v_record.plan_id,
    'price_id', v_record.price_id,
    'expires_at', v_record.expires_at
  );
END;
$$;

-- 11. GESTÃO E CONTROLE DE RESERVAS DE QUOTA DE ANÁLISE (M4.14.4.15)
CREATE OR REPLACE FUNCTION public.reserve_analysis_quota(
  p_organization_id uuid,
  p_user_id uuid DEFAULT NULL::uuid,
  p_opportunity_id text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub record;
  v_reservation_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user IS DISTINCT FROM 'postgres' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
  END IF;


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

  -- Lifecycle status check (ETAPA 4):
  -- active: allowed
  -- trialing: allowed
  -- past_due: allowed ONLY IF grace_period_ends_at IS NOT NULL AND grace_period_ends_at >= NOW()
  -- past_due with NULL grace_period: BLOCKED
  -- past_due with expired grace_period: BLOCKED
  -- all other statuses: BLOCKED
  IF v_sub.status = 'active' OR v_sub.status = 'trialing' THEN
    NULL;
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

  IF v_sub.analyses_used_in_period >= v_sub.monthly_analyses_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Monthly analysis quota limit reached.',
      'limit', v_sub.monthly_analyses_limit,
      'used', v_sub.analyses_used_in_period
    );
  END IF;

  UPDATE public.saas_subscriptions
  SET analyses_used_in_period = analyses_used_in_period + 1,
      updated_at = NOW()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.analysis_quota_reservations (
    organization_id,
    user_id,
    opportunity_id,
    status,
    created_at
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_opportunity_id,
    'reserved',
    NOW()
  ) RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reservation_id', v_reservation_id,
    'limit', v_sub.monthly_analyses_limit,
    'used', v_sub.analyses_used_in_period + 1,
    'remaining', v_sub.monthly_analyses_limit - (v_sub.analyses_used_in_period + 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_analysis_quota(
  p_reservation_id uuid,
  p_organization_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res record;
  v_sub record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user IS DISTINCT FROM 'postgres' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
  END IF;


  SELECT * INTO v_res
  FROM public.analysis_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reservation not found.'
    );
  END IF;

  IF v_res.organization_id <> p_organization_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cross-tenant violation: reservation belongs to a different organization.'
    );
  END IF;

  IF v_res.status = 'released' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'released',
      'idempotent', true,
      'released_at', v_res.released_at
    );
  END IF;

  IF v_res.status = 'consumed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quota reservation has already been consumed and cannot be released.'
    );
  END IF;

  IF v_res.status <> 'reserved' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid reservation status: %s', v_res.status)
    );
  END IF;

  SELECT * INTO v_sub
  FROM public.saas_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Subscription not found for organization.'
    );
  END IF;

  UPDATE public.saas_subscriptions
  SET analyses_used_in_period = GREATEST(0, analyses_used_in_period - 1),
      updated_at = NOW()
  WHERE organization_id = p_organization_id
    AND analyses_used_in_period > 0;

  UPDATE public.analysis_quota_reservations
  SET status = 'released',
      released_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'status', 'released',
    'used', GREATEST(0, v_sub.analyses_used_in_period - 1)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_analysis_quota(
  p_reservation_id uuid,
  p_organization_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user IS DISTINCT FROM 'postgres' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
  END IF;


  SELECT * INTO v_res
  FROM public.analysis_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found.');
  END IF;

  IF v_res.organization_id <> p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-tenant violation: reservation belongs to a different organization.');
  END IF;

  -- Idempotency check: if already consumed, return success without duplicate modification
  IF v_res.status = 'consumed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'consumed',
      'idempotent', true,
      'consumed_at', v_res.consumed_at
    );
  END IF;

  -- A released reservation can never be consumed
  IF v_res.status = 'released' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Quota reservation has already been released and cannot be consumed.'
    );
  END IF;

  IF v_res.status <> 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Reservation is in %s state and cannot be consumed.', v_res.status));
  END IF;

  UPDATE public.analysis_quota_reservations
  SET status = 'consumed',
      consumed_at = NOW()
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object('success', true, 'reservation_id', p_reservation_id, 'status', 'consumed');
END;
$$;

-- 11. RECONCILIAÇÃO E RECUPERAÇÃO ATÔMICA DE RESERVAS DE QUOTA
CREATE OR REPLACE FUNCTION public.reconcile_quota_reservation(
  p_reservation_id uuid,
  p_organization_id uuid,
  p_matching_succeeded boolean DEFAULT NULL::boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res record;
  v_sub record;
  v_succeeded boolean;
  v_persisted_matches integer;
  v_persisted_activity integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND current_user IS DISTINCT FROM 'postgres' AND NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'Access Denied: Not an authorized member of organization.';
  END IF;

  SELECT * INTO v_res
  FROM public.analysis_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation not found.');
  END IF;

  IF v_res.organization_id <> p_organization_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cross-tenant violation: reservation belongs to a different organization.');
  END IF;

  -- Se já consumida: retorno idempotente seguro
  IF v_res.status = 'consumed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'consumed',
      'action', 'none',
      'already_reconciled', true
    );
  END IF;

  -- Se já liberada: retorno idempotente seguro
  IF v_res.status = 'released' THEN
    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'released',
      'action', 'none',
      'already_reconciled', true
    );
  END IF;

  IF v_res.status <> 'reserved' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Invalid reservation status: %s', v_res.status));
  END IF;

  -- Determinação do estado real da análise/matching (NUNCA baseado apenas em idade)
  IF p_matching_succeeded IS NOT NULL THEN
    v_succeeded := p_matching_succeeded;
  ELSE
    -- Inspeção direta do estado persistido no banco
    BEGIN
      SELECT COUNT(*) INTO v_persisted_matches
      FROM public.requirement_evidence_matches
      WHERE opportunity_id::text = v_res.opportunity_id
        AND organization_id = p_organization_id
        AND created_at >= (v_res.created_at - interval '10 seconds');
    EXCEPTION WHEN OTHERS THEN
      v_persisted_matches := 0;
    END;

    BEGIN
      SELECT COUNT(*) INTO v_persisted_activity
      FROM public.opportunity_activities
      WHERE opportunity_id::text = v_res.opportunity_id
        AND organization_id = p_organization_id
        AND action = 'MATCHING_ENGINE_EXECUTED'
        AND created_at >= (v_res.created_at - interval '10 seconds');
    EXCEPTION WHEN OTHERS THEN
      v_persisted_activity := 0;
    END;

    IF v_persisted_matches > 0 OR v_persisted_activity > 0 THEN
      v_succeeded := true;
    ELSE
      v_succeeded := false;
    END IF;
  END IF;

  IF v_succeeded THEN
    -- Matching concluído: marcar consumida sem re-debitar
    UPDATE public.analysis_quota_reservations
    SET status = 'consumed',
        consumed_at = NOW()
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'consumed',
      'action', 'consumed',
      'reconciled_via', CASE WHEN p_matching_succeeded IS NOT NULL THEN 'caller_signal' ELSE 'persisted_evidence' END
    );
  ELSE
    -- Matching falhou ou não foi persistido: estornar quota uma única vez
    SELECT * INTO v_sub
    FROM public.saas_subscriptions
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.saas_subscriptions
      SET analyses_used_in_period = GREATEST(0, analyses_used_in_period - 1),
          updated_at = NOW()
      WHERE organization_id = p_organization_id
        AND analyses_used_in_period > 0;
    END IF;

    UPDATE public.analysis_quota_reservations
    SET status = 'released',
        released_at = NOW()
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object(
      'success', true,
      'reservation_id', p_reservation_id,
      'status', 'released',
      'action', 'released',
      'reconciled_via', CASE WHEN p_matching_succeeded IS NOT NULL THEN 'caller_signal' ELSE 'persisted_evidence' END
    );
  END IF;
END;
$$;

-- 12. POLÍTICAS DE PERMISSÃO RIGOROSAS (ISOLAMENTO DE RPCS PRIVILEGIADAS)
REVOKE EXECUTE ON FUNCTION public.process_paddle_webhook_transaction(text, text, text, jsonb, uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_paddle_webhook_transaction(text, text, text, jsonb, uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.apply_paddle_subscription_update(uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paddle_subscription_update(uuid, plan_tier, subscription_lifecycle, text, text, boolean, integer, timestamp with time zone) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.mark_paddle_webhook_processed(text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_paddle_webhook_processed(text, boolean, text) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.check_webhook_event_processed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_webhook_event_processed(text) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.get_organization_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_subscription(uuid) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.create_checkout_intent(uuid, uuid, plan_tier, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_intent(uuid, uuid, plan_tier, text, integer) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.reserve_analysis_quota(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_analysis_quota(uuid, uuid, text) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.release_analysis_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_analysis_quota(uuid, uuid) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.consume_analysis_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_analysis_quota(uuid, uuid) TO service_role, postgres;

REVOKE EXECUTE ON FUNCTION public.reconcile_quota_reservation(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_quota_reservation(uuid, uuid, boolean) TO service_role, postgres;

-- 13. HARDENING DA TRILHA DE AUDITORIA: usage_audit_logs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND c.relname = 'usage_audit_logs'
  ) THEN
    -- Remove política permissiva de inserção direta por usuários comuns
    DROP POLICY IF EXISTS "Members can insert usage audit logs in their organization" ON public.usage_audit_logs;

    -- Revoga privilégios de mutação de usuários anônimos, autenticados e do papel público
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.usage_audit_logs FROM PUBLIC, anon, authenticated;

    -- Garante privilégios de gravação estritamente para processos confiáveis da plataforma
    GRANT INSERT ON TABLE public.usage_audit_logs TO service_role, postgres;

    -- Preserva privilégio de leitura para usuários autenticados (conforme política RLS de consulta)
    GRANT SELECT ON TABLE public.usage_audit_logs TO authenticated;
  END IF;
END $$;



