-- Migration 20261111000006_unique_provider_subscription_id.sql
-- STATUS: PROPOSED ONLY — DO NOT EXECUTE WITHOUT HUMAN APPROVAL
--
-- Objective: Permanently enforce global 1:1 uniqueness of provider_subscription_id across tenants
-- Allows multiple NULL values (free tier tenants) via partial index condition.

CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_sub_provider_id_unique 
ON public.saas_subscriptions (provider_subscription_id) 
WHERE provider_subscription_id IS NOT NULL;

COMMENT ON INDEX public.idx_saas_sub_provider_id_unique IS 
'Enforces global 1:1 tenant isolation for Paddle subscriptions, permanently preventing cross-tenant subscription collisions or overwrites.';
