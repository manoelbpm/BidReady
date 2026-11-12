# ARQUITETURA DE COMUNICAÇÃO TRANSACIONAL E AUTOMAÇÃO OPERACIONAL — BIDREADY

**Documento:** `COMM-DOC-009`  
**Referência:** M5.1 Operational Revenue Readiness  
**Idioma:** Português (Documentação Operacional) / Modelos de E-mail em Inglês  
**Status:** Especificação de Templates & Triggers (Sem disparos comerciais reais)

---

## 1. FLUXO DE E-MAILS TRANSACIONAIS DO CICLO DE RECEITA

Os e-mails transacionais (diferente de e-mails frios ou campanhas de marketing) são disparados exclusivamente em resposta a eventos operacionais diretos do usuário. Todos os textos voltados ao cliente estão em inglês profissional:

### E-mail 1: Boas-Vindas & Onboarding (Cadastro Concluído)
- **Gatilho:** Inserção do usuário em `auth.users` e provisionamento de `public.organizations`.
- **Assunto:** Welcome to BidReady — Your workspace is ready
- **Conteúdo:**
```text
Hi {{first_name}},

Welcome to BidReady. Your organization workspace ({{organization_name}}) has been provisioned with your complimentary Free Trial (2 monthly tender document analyses).

To get your first compliance matrix in under 3 minutes:
1. Go to your Dashboard: {{app_url}}/dashboard
2. Click "Upload Solicitation" and select any RFP, SOW, or task order PDF.
3. Review your extracted technical requirements, page citations, and compliance matrix.

If you have questions, reply directly to this email or check our documentation at {{app_url}}/support.

Best regards,
The BidReady Team
```

### E-mail 2: Análise Concluída (Notificação de Processamento)
- **Gatilho:** Conclusão bem-sucedida do pipeline de parsing e extração de requisitos.
- **Assunto:** [Ready] Compliance Analysis: {{opportunity_title}}
- **Conteúdo:**
```text
Hi {{first_name}},

BidReady has finished analyzing your solicitation: {{opportunity_title}}.

Summary:
• Extracted Requirements: {{total_requirements}}
• Direct Page Citations: 100% verified
• Verified Capability Matches: {{matched_requirements}}
• Compliance Gaps Requiring Review: {{gap_count}}

Access your interactive compliance checklist and export your matrix here:
{{app_url}}/opportunities/{{opportunity_id}}

Best regards,
The BidReady Team
```

### E-mail 3: Confirmação de Pagamento & Liberação de Plano
- **Gatilho:** Webhook Paddle `transaction.completed` / `subscription.created` processado com sucesso.
- **Assunto:** Receipt & Subscription Confirmation — BidReady {{plan_name}}
- **Conteúdo:**
```text
Hi {{first_name}},

Thank you for subscribing to BidReady {{plan_name}}!

Your payment of ${{amount_paid}} USD was successfully processed by our Merchant of Record, Paddle. Your upgraded monthly quota of {{monthly_limit}} document analyses is active immediately.

Subscription Details:
• Plan: BidReady {{plan_name}} (${{monthly_price}}/month)
• Monthly Allowance: {{monthly_limit}} Document Analyses
• Current Billing Period: {{period_start}} to {{period_end}}
• Next Renewal Date: {{period_end}}

You can manage your subscription, download official invoices, or update your payment method anytime via your Settings portal:
{{app_url}}/settings

Best regards,
The BidReady Billing Team
```

### E-mail 4: Renovação Periódica Bem-Sucedida
- **Gatilho:** Webhook Paddle `subscription.updated` / `transaction.paid` de renovação mensal.
- **Assunto:** Your BidReady subscription has renewed
- **Conteúdo:**
```text
Hi {{first_name}},

This is a confirmation that your BidReady {{plan_name}} subscription has renewed for the upcoming billing cycle ({{period_start}} to {{period_end}}).

Your monthly allowance of {{monthly_limit}} document analyses has been refreshed.

Invoice and payment receipt: {{receipt_url}}

Thank you for trusting BidReady for your proposal capture operations.

Best regards,
The BidReady Billing Team
```

### E-mail 5: Falha no Pagamento & Início do Período de Tolerância (Grace Period)
- **Gatilho:** Webhook Paddle `subscription.past_due` com `grace_period_ends_at`.
- **Assunto:** Action Required: Payment failed for your BidReady subscription
- **Conteúdo:**
```text
Hi {{first_name}},

We were unable to process the recurring payment for your BidReady {{plan_name}} subscription.

Don't worry: your access and analysis quota remain active during your 7-day grace period, which ends on {{grace_period_ends_at}}.

To prevent any disruption to your active bid analyses, please update your payment method using the secure link below:
{{customer_portal_url}}

If you need an updated invoice or have corporate procurement questions, reply to this email.

Best regards,
The BidReady Billing Team
```

---

## 2. AUTOATENDIMENTO PARA GERENCIAMENTO DE ASSINATURAS

Conforme implementado na rota `/api/billing/portal` e na interface de `/settings`:
1. O usuário clica em **"Manage Billing & Invoices ↗"** ou **"Cancel Plan"**.
2. A API gera uma sessão segura na Paddle Customer Portal API (`/customers/{id}/portal-sessions`).
3. O usuário é redirecionado em nova aba para a interface hospedada da Paddle, onde pode:
   - Trocar o cartão corporativo cadastrado.
   - Baixar faturas oficiais e recibos fiscais com o tax ID / CNPJ da empresa.
   - Programar cancelamento ao final do período (mantendo o acesso até `current_period_end`).
   - Reativar assinatura antes do término do período.
4. **Impacto Operacional:** 0 chamados de suporte para troca de cartão ou emissão de segunda via de fatura.

---

## 3. SISTEMA DE ALERTAS POR EXCEÇÃO AO PROPRIETÁRIO

O proprietário da operação não deve monitorar logs rotineiros. O sistema de alertas (via bot de Telegram ou canal de Webhook privado no Slack) só dispara nas seguintes **3 exceções críticas**:

| Código de Alerta | Evento Crítico | Ação Necessária do Proprietário |
| :--- | :--- | :--- |
| `CRIT-001-PAYMENT-SYNC` | Webhook de pagamento retornou erro de banco persistente após 3 tentativas da Paddle. | Inspecionar status da tabela `saas_subscriptions` para o `provider_subscription_id` indicado. |
| `CRIT-002-PARSE-FAIL` | Documento de cliente falhou consecutivamente no parser e extração por 3 vezes. | Verificar se o arquivo possui criptografia de proteção de senha, formatação rasterizada ou corrupção de arquivo. |
| `CRIT-003-ENTERPRISE-INQUIRY`| Cliente atingiu o teto do plano Business (120 análises) e solicitou quota adicional. | Oportunidade de expansão de conta: emitir proposta personalizada. |
