-- ============================================================================
-- BIDREADY: SCRIPT CONTROLADO DE RECUPERAÇÃO DA ASSINATURA STARTER
-- Script: scripts/remediate_starter_subscription_m4144.sql
-- Organização Alvo: e2e00000-0000-4000-a000-000000000010
-- Identificador Paddle Oficial: sub_01m73xm9cymfwkbawkcvb19br7
-- Customer ID Paddle Oficial: ctm_01m73w7d3pc1sna6v8a9fy1vqx
-- Timestamp Histórico Original: 2026-11-10 23:45:25.025182+00
-- Limite Oficial do Catálogo: 10 análises mensais
-- ============================================================================

DO $$
DECLARE
  v_target_org uuid := 'e2e00000-0000-4000-a000-000000000010'::uuid;
  v_legitimate_sub text := 'sub_01m73xm9cymfwkbawkcvb19br7';
  v_legitimate_cust text := 'ctm_01m73w7d3pc1sna6v8a9fy1vqx';
  v_occurred_at timestamp with time zone := '2026-11-10 23:45:25.025182+00'::timestamp with time zone;
  v_existing_org uuid;
  v_col_exists boolean;
  v_row_count integer;
BEGIN
  -- 1. Lock consultivo serializado por organização
  PERFORM pg_advisory_xact_lock(hashtext('bidready_billing_mutation_lock'), hashtext(v_target_org::text));

  -- 2. Verificação de pré-requisito: A migration 20261111000007 DEVE ter sido aplicada
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'saas_subscriptions' 
      AND column_name = 'last_event_occurred_at'
  ) INTO v_col_exists;

  IF NOT v_col_exists THEN
    RAISE EXCEPTION 'FATAL: Migration 20261111000007_billing_final_consolidation.sql must be applied before running Starter remediation (column last_event_occurred_at is missing)';
  END IF;

  -- 3. Verificação de colisão cross-tenant
  SELECT organization_id INTO v_existing_org
  FROM public.saas_subscriptions
  WHERE provider_subscription_id = v_legitimate_sub
    AND organization_id <> v_target_org;

  IF FOUND THEN
    RAISE EXCEPTION 'CROSS-TENANT COLLISION: Legitimate sub % is already linked to tenant %', v_legitimate_sub, v_existing_org;
  END IF;

  -- 4. Atualização segura da assinatura Starter
  UPDATE public.saas_subscriptions
  SET provider_subscription_id = v_legitimate_sub,
      provider_customer_id = v_legitimate_cust,
      last_event_occurred_at = v_occurred_at,
      plan = 'starter'::plan_tier,
      status = 'active'::subscription_lifecycle,
      monthly_analyses_limit = 10,
      updated_at = NOW()
  WHERE organization_id = v_target_org;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'REMEDIATION FAILED: Target organization % was not found in saas_subscriptions', v_target_org;
  END IF;

  RAISE NOTICE 'SUCCESS: Starter Organization % successfully restored to official Paddle Subscription %', v_target_org, v_legitimate_sub;
END $$;
