-- ==============================================================================
-- BIDREADY M4.14.3.7 — SECURE CHECKOUT INTENTS & PRIVILEGED RPC HARDENING
-- ==============================================================================

-- 1. Ensure public.checkout_intents table has zero direct access from anon/authenticated
REVOKE ALL ON TABLE public.checkout_intents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.checkout_intents TO service_role, postgres;

-- 2. Restrict create_checkout_intent RPC execution strictly to service_role and postgres
REVOKE ALL ON FUNCTION public.create_checkout_intent(uuid, uuid, plan_tier, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_intent(uuid, uuid, plan_tier, text, integer) TO service_role, postgres;
