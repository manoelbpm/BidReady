# PADDLE APPROVAL, KYC & COMMERCIAL ENTITLEMENTS VALIDATION — M8

**Document ID:** `COMM-DOC-017`  
**Reference:** M8 Paddle Approval & Payout Readiness  
**Target:** Brazilian Entity KYC, Product Compliance & Code Entitlement Audit  
**Status:** Verification Completed / Operational Checklist Ready  
**Restrictions:** No Documents Submitted — No Remote Changes — Zero Production Mutations

---

## 1. CONFRONTAÇÃO DOS PLANOS COMERCIAIS COM A IMPLEMENTAÇÃO REAL

Uma auditoria exaustiva entre os planos anunciados (`commercial/02_positioning_and_offer.md`, `src/types/billing.ts`, `src/app/page.tsx`) e a lógica de execução no backend e banco de dados foi realizada para garantir que **nenhum benefício seja comercializado sem implementação comprovada**:

```
+---------------+--------------+--------------------------+------------------------------+-------------------------------------+
| PLANO         | PREÇO (USD)  | FRANQUIA DE ANÁLISES     | REPOSITÓRIO DE EVIDÊNCIAS    | SUPORTE & RECURSOS TÉCNICOS         |
+---------------+--------------+--------------------------+------------------------------+-------------------------------------+
| Free Trial    | $0 / mês     | 2 análises / mês         | Até 5 artefatos (Seed base)  | Comunidade / Documentação           |
| Starter       | $29 / mês    | 10 análises / mês        | Ilimitado na tabela Postgres | Suporte Padrão por E-mail           |
| Pro           | $69 / mês    | 40 análises / mês        | Ilimitado na tabela Postgres | Suporte Prioritário por E-mail (24h)|
| Business      | $149 / mês   | 120 análises / mês       | Ilimitado na tabela Postgres | Onboarding & Acesso Multi-usuário   |
+---------------+--------------+--------------------------+------------------------------+-------------------------------------+
```

### Resultados da Auditoria de Código e Entitlements:

1. **Quotas de Documentos (100% Implementado no Código):**
   - **Mecanismo:** A tabela `saas_subscriptions` e as RPCs PostgreSQL (`check_organization_quota`, reservas e consumos atômicos em `src/lib/billing/subscription-service.ts`) controlam de forma determinística os limites:
     - Free: bloqueia na 3ª análise (após 2).
     - Starter: bloqueia na 11ª análise (após 10).
     - Pro: bloqueia na 41ª análise (após 40).
     - Business: bloqueia na 121ª análise (após 120).
   - **Status:** **HOMOLOGADO E AUDITADO.**

2. **Repositório de Evidências (Auditoria de Limites):**
   - **Comportamento Real:** A rota `/api/evidence` permite listar (`GET`) e criar (`POST`) evidências sem bloqueio artificial no banco; a rota `/api/evidence` possui ação de `seed` que injeta exatamente 5 artefatos padrão para novos usuários (FedRAMP, ISO 27001, CPARS, etc.).
   - **Correção Comercial:** O plano Free é divulgado com "Biblioteca de evidências de até 5 artefatos" e os planos pagos com "Biblioteca ilimitada de evidências da empresa". Não há necessidade de bloqueio forçado prejudicial no código no momento, pois o volume natural do usuário Free é guiado pelo seed e pela franquia de 2 editais.

3. **SLA Prioritário no Plano Pro (Ajuste de Realidade):**
   - **Realidade do Código:** Todas as chamadas de IA (Google Gemini Flash) compartilham o mesmo tempo de resposta de API (~2 a 4 segundos por documento). Não existe fila técnica de baixa prioridade no código para usuários Free/Starter.
   - **Ajuste Comercial:** A menção a "Fila prioritária de processamento" foi removida em M8. O benefício do plano Pro é explicitado como **"Suporte prioritário por e-mail com resposta em até 24 horas úteis"** (nível de serviço de atendimento humano).

4. **Controle de Acesso RBAC no Plano Business (Ajuste de Realidade):**
   - **Realidade do Código:** O banco possui tabela `organization_members` com papéis básicos (`owner`, `admin`, `member`), mas **não há** editor de permissões granulares por botão na interface.
   - **Ajuste Comercial:** Removida a alegação de "RBAC granular e logs de conformidade avançados". O benefício do plano Business é anunciado como **"Acesso multi-usuário para equipe com repositório compartilhado de evidências e extração paralela de alto volume"**.

---

## 2. CHECKLIST OPERACIONAL DE APROVAÇÃO PADDLE LIVE (KYC BRASIL)

Para aprovação da conta da Paddle como Merchant of Record (MoR) para uma pessoa jurídica brasileira:

### A. Dados Cadastrais da Empresa Brasileira (Pessoa Jurídica)
- [ ] **Razão Social:** Exatamente idêntica ao Cadastro Nacional de Pessoa Jurídica (CNPJ).
- [ ] **Nome Fantasia (Trading Name):** BidReady.
- [ ] **CNPJ:** Ativo e regular na Receita Federal do Brasil.
- [ ] **CNAE Principal e Secundários:** Adequados para desenvolvimento e licenciamento de software (ex: 6202-3/00 — Desenvolvimento de programas de computador customizáveis; 6203-1/00 — Desenvolvimento de programas não-customizáveis / SaaS; ou 6311-9/00 — Tratamento de dados e provedores de serviços de aplicação).
- [ ] **Endereço Comercial:** Endereço fiscal ou sede da empresa no Brasil (deve coincidir com o comprovante de endereço).
- [ ] **Website Corporativo Oficial:** URL do produto com domínio próprio ativo (`https://[seu-dominio].com`).

### B. Documentação Societária e Fiscal
- [ ] **Contrato Social Consolidado** (ou Estatuto Social + Ata de Eleição da Diretoria, ou Certificado de MEI/Requerimento de Empresário Individual) registrado na Junta Comercial.
- [ ] **Comprovante de Inscrição e Situação Cadastral no CNPJ** (emitido no site da Receita Federal com data recente, < 30 dias).
- [ ] **Comprovante de Endereço Comercial:** Fatura de energia elétrica, telecomunicações ou extrato bancário em nome da pessoa jurídica emitido nos últimos 90 dias.

### C. Identificação do Responsável Legal (Ultimate Beneficial Owner - UBO)
- [ ] **Documento de Identidade com Foto:** Passaporte válido ou Carteira Nacional de Habilitação (CNH) do sócio administrador/titular da conta.
- [ ] **Comprovante de Residência do Responsável:** Em nome do sócio titular emitido nos últimos 90 dias.
- [ ] **Declaração de Participação Societária:** Lista de sócios que detenham 25% ou mais de participação no capital social.

### D. Requisitos do Produto SaaS Exigidos pela Equipe de Compliance da Paddle
A Paddle audita o site público antes de aprovar a conta Live. O site publicado deve conter visivelmente no rodapé e menu:
- [ ] **Descrição Clara do Produto:** Explicar claramente que o BidReady é um software de análise e extração de requisitos para propostas comerciais e RFPs.
- [ ] **Tabela de Preços Transparente:** Exibir em USD os valores ($0, $29, $69, $149) e periodicidade mensal.
- [ ] **Termos de Uso (Terms of Service):** Em inglês, regulando uso aceitável, cancelamento de assinatura e limitações de responsabilidade (já implementado em `/terms`).
- [ ] **Política de Privacidade (Privacy Policy):** Em inglês, cobrindo tratamento de dados e cookies (já implementado em `/privacy`).
- [ ] **Política de Cancelamento e Reembolso (Refund Policy):** Conforme exigência da Paddle, explicitar o direito de cancelamento self-service a qualquer momento via portal do cliente e política de reembolso (geralmente prorata ou 14 dias conforme política de MoR da Paddle).
- [ ] **Dados de Contato de Suporte:** E-mail de suporte visível (`support@[seu-dominio].com`).
- [ ] **Menção Legal do MoR:** Rodapé informando: *"Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders."*

---

## 3. PASSO A PASSO PARA CRIAÇÃO DOS PRICE IDS LIVE NO PAINEL PADDLE

Após a aprovação da conta Live pela Paddle, execute exclusivamente estes passos para obter os IDs de produção:

1. **Acessar o Painel Paddle:** Alterne o botão superior de "Sandbox" para "Live".
2. **Navegar até Catálogo:** Vá para `Catalog` -> `Products`.
3. **Criar Produto:**
   - Nome: `BidReady Subscription`
   - Tax Category: `Digital Goods - Software as a Service (SaaS)`
4. **Criar os 3 Preços Recorrentes (Prices):**
   - **Preço 1 (Starter):**
     - Description: `Starter Plan - 10 Document Analyses / month`
     - Billing cycle: `Every month`
     - Currency: `USD`
     - Amount: `29.00`
     - Copiar o ID gerado: `pri_01...` -> Guardar como `PADDLE_PRICE_STARTER`.
   - **Preço 2 (Pro):**
     - Description: `Pro Plan - 40 Document Analyses / month`
     - Billing cycle: `Every month`
     - Currency: `USD`
     - Amount: `69.00`
     - Copiar o ID gerado: `pri_01...` -> Guardar como `PADDLE_PRICE_PRO`.
   - **Preço 3 (Business):**
     - Description: `Business Plan - 120 Document Analyses / month`
     - Billing cycle: `Every month`
     - Currency: `USD`
     - Amount: `149.00`
     - Copiar o ID gerado: `pri_01...` -> Guardar como `PADDLE_PRICE_BUSINESS`.
5. **Configurar Webhook Live:**
   - Vá para `Developer Tools` -> `Notifications`.
   - URL: `https://[seu-dominio]/api/billing/webhook`.
   - Copiar o Secret: `pdl_ntfset_...` -> Guardar como `PADDLE_WEBHOOK_SECRET`.
6. **Obter Chaves de API Live:**
   - Obter a `PADDLE_API_KEY` (inicia com `paddlegb_...`).
   - Obter o Client Token (`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` inicia com `live_...`).

---

## 4. EVIDÊNCIAS DE VERIFICAÇÃO PÓS-APROVAÇÃO

Após a inserção das credenciais na Vercel:
- [ ] Requisição de Checkout `/api/billing/checkout` retorna transação vinculada aos Price IDs Live (sem usar IDs de Sandbox).
- [ ] Tentativa de checkout com ID de Sandbox em produção é rejeitada com erro de guarda preventiva.
- [ ] Assinatura de teste inicial ($29) gera evento `subscription.created` com assinatura HMAC validada.
