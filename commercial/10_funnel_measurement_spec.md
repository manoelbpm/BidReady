# ESPECIFICAÇÃO DE MENSURAÇÃO DO FUNIL DE AQUISIÇÃO (ANALYTICS SPEC)

**Documento:** `COMM-DOC-010`  
**Referência:** M5.2 Product-Led Acquisition Readiness  
**Princípio:** Zero infraestrutura paga externa / Zero migrations remotas nesta etapa  
**Status:** Especificação de Eventos e Arquitetura de Rastreamento

---

## 1. O FUNIL DE AQUISIÇÃO SELF-SERVICE (11 ETAPAS)

Para mensurar o comportamento do usuário desde a primeira visita anônima até a conversão e retenção sem intermediários humanos, o funil é estruturado nas seguintes 11 etapas críticas:

```
[Topo do Funnel — Descoberta & Tráfego]
  Etapa 1: Landing Page Views (`page_view_home`)
  Etapa 2: CTA Clicks (`cta_click_signup` / `cta_click_demo`)
         ↓
[Meio do Funil — Cadastro & Ativação de Onboarding]
  Etapa 3: Signup Started (`signup_attempt`)
  Etapa 4: Signup Completed (`signup_success` / `organization_provisioned`)
  Etapa 5: First Analysis Started / Completed (`document_uploaded` / `requirements_extracted`)
         ↓
[Engajamento & Limite de Uso Gratuito]
  Etapa 6: Free Quota Exhausted (`free_quota_exceeded` / HTTP 402)
  Etapa 7: Pricing Page Views (`page_view_pricing` / `settings_billing_view`)
         ↓
[Monetização & Conversão]
  Etapa 8: Checkout Started (`checkout_intent_created` via `/api/billing/checkout`)
  Etapa 9: Payment Completed (`payment_confirmed` via Paddle Webhook)
  Etapa 10: Trial/Free-to-Paid Conversion (`subscription_active`)
         ↓
[Retenção & Lifecycle]
  Etapa 11: Cancellation / Churn Scheduled (`subscription_canceled` / `cancel_at_period_end`)
```

---

## 2. O QUE PODE SER MEDIDO IMEDIATAMENTE (COM MECANISMOS JÁ DISPONÍVEIS)

Sem adicionar serviços pagos ou tabelas remotas, o sistema atual já rastreia de forma determinística os seguintes eventos essenciais:

| Métrica / Evento | Onde é Capturado Hoje | Mecanismo Disponível |
| :--- | :--- | :--- |
| **Signup Completed** | `auth.users` / `public.organization_members` | Contagem direta de usuários autenticados vinculados a workspaces. |
| **First Analysis Completed** | `public.analysis_quota_reservations` / `public.documents` | Registro de primeira reserva consumida (`status = 'consumed'`) por tenant. |
| **Free Quota Exhausted** | Resposta HTTP 402 no endpoint `/api/documents/upload` | `analyses_used_in_period >= 2` em `public.saas_subscriptions`. |
| **Checkout Started** | `public.checkout_intents` | Inserção auditada com `user_id`, `organization_id`, `plan_id` e `intent_token`. |
| **Payment Completed** | `public.billing_webhook_events` | Inserção e confirmação atômica via `process_paddle_webhook_transaction`. |
| **Active Subscriptions** | `public.saas_subscriptions` | Consulta de `plan IN ('starter', 'pro', 'business') AND status = 'active'`. |
| **Cancellation Scheduled** | `public.saas_subscriptions` | Consulta de `cancel_at_period_end = true`. |

---

## 3. O QUE DEPENDE DE INFRAESTRUTURA FUTURA (FRONTEND TELEMETRY)

Para rastrear o topo do funil anônimo (antes de o usuário criar uma conta), será necessária a inclusão de um mecanismo leve de telemetria frontend quando autorizado:

| Métrica | Dado Necessário | Ferramenta Gratuita / Privacy-Friendly Recomendada |
| :--- | :--- | :--- |
| **Landing Page Views** | Contagem de sessões únicas por URL de origem / UTM | PostHog (Open-Source / Free Tier até 1M eventos/mês) ou Plausible Analytics |
| **CTA Clicks** | Cliques em "Start Free Trial" e "Explore Interactive Demo" | Event listeners no frontend enviando telemetria assíncrona (navigator.sendBeacon) |
| **Demo Completion Rate** | % de tempo assistido / cliques no inspetor de citações | Eventos customizados na página `/demo` |
| **Drop-off no Form de Signup**| Abandono de campo de e-mail | Rastreamento de blur/foco em inputs |

---

## 4. TAXAS DE CONVERSÃO ALVO (BENCHMARKS B2B GOVCON)

```
[Visitas na Landing Page]  (100%)
          ↓  (Meta de Conversão: 5% a 8%)
[Cadastros Concluídos]     (5% - 8%)
          ↓  (Meta de Ativação: > 60%)
[1ª Análise Executada]     (3% - 5%)
          ↓  (Meta de Esgotamento do Free: > 50%)
[Consumo das 2 Análises]   (1.5% - 2.5%)
          ↓  (Meta de Conversão Trial-to-Paid: 10% a 15%)
[Assinatura Paga Ativa]    (0.3% - 0.8% do tráfego total)
```
