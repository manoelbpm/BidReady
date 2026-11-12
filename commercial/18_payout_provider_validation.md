# VALIDATION OF PADDLE PAYOUT PROVIDERS FOR BRAZILIAN ENTITIES — M8

**Document ID:** `COMM-DOC-018`  
**Reference:** M8 Paddle Approval & Payout Readiness  
**Target:** Financial Payout Feasibility, Banking Options & FX Reconciliation for Brazilian PJ  
**Status:** Verification Completed / Gaps & Pendencies Explicitly Identified  
**Strict Policy:** No assumptions made. Documented based on official Paddle payout terms, provider terms, and cross-border Brazilian regulations.

---

## 1. REGRAS GERAIS DE REPASSE (PAYOUT) DA PADDLE

A Paddle opera no modelo **Merchant of Record (MoR)** sob a entidade legal britânica **Paddle.com Market Ltd**. Os valores pagos pelos clientes finais (em USD) acumulam no saldo da conta do vendedor e são transferidos de acordo com as seguintes regras fundamentais:

1. **Calendário de Repasses:**
   - A apuração ocorre no dia 1 de cada mês. Se o saldo acumulado for igual ou superior ao piso configurado (mínimo de US$ 100), a transferência é enfileirada.
   - Os pagamentos são emitidos pela Paddle entre os **dias 2 e 15 de cada mês**.
   - O prazo de compensação bancária varia entre 1 e 4 dias úteis após o envio.
2. **Piso Mínimo de Transferência:**
   - O piso padrão é de **US$ 100,00**. Saldos inferiores permanecem retidos no painel até atingirem o valor mínimo no ciclo seguinte.
3. **Regra Absoluta de Titularidade (Name Match):**
   - **O nome da conta bancária de recebimento DEVE coincidir exatamente com a Razão Social da empresa aprovada no KYC da Paddle.**
   - A Paddle rejeita categoricamente transferências para contas bancárias de pessoas físicas ou contas de terceiros quando a conta do vendedor é cadastrada como pessoa jurídica (CNPJ).

---

## 2. ANÁLISE COMPARATIVA DAS 5 ALTERNATIVAS DE RECEBIMENTO

---

### Opção 1: Payoneer (Método Nativo Oficial da Paddle)
- **Elegibilidade:** **100% ELEGÍVEL E HOMOLOGADO.**  
  A Paddle possui integração nativa direta com a Payoneer no painel de configurações de transferência (`Transfer Preferences` -> `Payoneer`).
- **País & Titularidade:**  
  A conta Payoneer deve ser aberta como **Pessoa Jurídica (Company Account)** utilizando o mesmo CNPJ, Razão Social e sócio administrador cadastrados na Paddle.
- **Moedas:**  
  A Paddle transfere em **USD** diretamente para o saldo Payoneer. O resgate para o banco brasileiro do titular é liquidado em **BRL**.
- **Tarifas e Conversão Cambial:**
  - Taxa da Paddle para envio à Payoneer: **US$ 0,00** (gratuito).
  - Taxa da Payoneer para saque em BRL: Spread cambial médio entre **1,5% e 2,0%** sobre o câmbio comercial + IOF de 0,38% (exportação de serviços).
- **Restrições:**  
  Exige processo próprio de KYC da Payoneer para a PJ brasileira (envio de Contrato Social e documento do sócio).
- **Fonte Oficial:**  
  [Paddle Help Center — Payout Methods](https://paddle.com/help/payouts/payout-methods) e Payoneer Partner Integration Documentation.

---

### Opção 2: Wire Transfer Internacional Direto (SWIFT para Banco no Brasil)
- **Elegibilidade:** **100% ELEGÍVEL E HOMOLOGADO.**  
  A Paddle permite cadastrar dados bancários internacionais (IBAN/SWIFT) de qualquer banco comercial brasileiro (Itaú, Bradesco, Banco do Brasil, BTG Pactual Empresas, Santander, etc.).
- **País & Titularidade:**  
  Conta corrente de pessoa jurídica sediada no Brasil (CNPJ), com titularidade idêntica à cadastrada na Paddle.
- **Moedas:**  
  A Paddle envia **USD** via rede bancária internacional SWIFT. O banco brasileiro recebe a ordem e fecha o contrato de câmbio pronto para crédito em **BRL**.
- **Tarifas e Conversão Cambial:**
  - **Taxa da Paddle para Wire Internacional:** **US$ 15,00 por transferência**, deduzida antes da emissão.
  - **Bancos Intermediários (Correspondentes):** Podem deduzir entre **US$ 15,00 e US$ 30,00** do valor em trânsito.
  - **Tarifa do Banco Brasileiro:** Varia de US$ 0 (bancos digitais/BTG) até R$ 100–250 em grandes bancos tradicionais.
  - **Spread Cambial:** 1,0% a 2,5% dependendo da instituição + IOF de 0,38%.
- **Restrições:**  
  Totalmente **inviável para faturamentos iniciais baixos**. Se o repasse for de US$ 100, os custos fixos de remessa (US$ 15 + intermediários) consomem de 30% a 50% do valor.
- **Fonte Oficial:**  
  [Paddle Help Center — Wire Transfer Fees](https://paddle.com/help/payouts/payout-fees).

---

### Opção 3: Inter Global PJ (Banco Inter & Co nos EUA)
- **Elegibilidade:** **PENDÊNCIA DE CONFIRMAÇÃO FORMAL.**
- **País & Titularidade:**  
  A conta Inter Global PJ fornece dados de roteamento bancário doméstico nos EUA (Routing Number ACH e Account Number) vinculados ao CNPJ brasileiro através da Inter & Co Payments / banco parceiro nos EUA (Community Federal Savings Bank).
- **Moedas:**  
  Recebe **USD** via rede doméstica ACH nos EUA. A conversão para BRL ocorre via aplicativo do Inter PJ com spread de ~1,0% a 1,5%.
- **Tarifas:**  
  Se a Paddle aceitar como transferência doméstica em USD nos EUA, a taxa da Paddle é **US$ 0,00**.
- **Restrições Críticas:**  
  A Paddle exige comprovação de titularidade exata da conta bancária. Muitas contas digitais transfronteiriças utilizam contas *FBO (For Benefit Of)* ou custódia compartilhada onde o nome legal do beneficiário final pode constar como subconta. Se o nome não constar de forma 100% isolada no extrato formal emitido pelo banco americano, a equipe de compliance da Paddle rejeita o método de payout.
- **Status / Pendência:**  
  **Não pode ser assumido como garantido sem consulta prévia.** Requer abertura da conta, emissão de um comprovante de dados bancários (Voided Check / Bank Letter) e submissão ao suporte da Paddle para pré-validação.

---

### Opção 4: Husky (Nomad PJ)
- **Elegibilidade:** **PENDÊNCIA DE CONFIRMAÇÃO FORMAL.**
- **País & Titularidade:**  
  A Husky opera como facilitadora de câmbio especializada em profissionais e empresas de tecnologia brasileiras que recebem do exterior. Ela disponibiliza uma conta de repasse nos EUA.
- **Moedas:**  
  Recebe **USD** localmente nos EUA e liquida automaticamente em **BRL** na conta bancária brasileira da empresa via TED/PIX.
- **Tarifas:**  
  Taxa fixa de 1,0% sobre a operação de câmbio da Husky + IOF de 0,38%. Taxa de envio Paddle: US$ 0,00 se for reconhecido como ACH doméstico.
- **Restrições Críticas:**  
  A Husky utiliza contas virtuais de liquidação através de bancos parceiros (como Bangor Savings Bank ou Evolve). É necessário verificar se a Paddle aprova essas contas como contas empresariais diretas, ou se as enquadra como intermediárias não-autorizadas.
- **Status / Pendência:**  
  **Pendente de validação.** Embora centenas de desenvolvedores usem Husky para plataformas como Deel e Google, a Paddle possui regras mais rígidas de verificação antifraude para contas de merchant.

---

### Opção 5: Wise Business
- **Elegibilidade:** **NÃO RECOMENDADO / ELEVADO RISCO DE RECUSA.**
- **Justificativa:**  
  A Wise suspendeu e restringiu severamente a abertura de novas contas multi-moeda e detalhes bancários em USD para pessoas jurídicas sediadas exclusivamente no Brasil sem presença física comprovada nos EUA ou na Europa.
- **Status:** **Descartado para a fase de lançamento.**

---

## 3. QUADRO RESUMO E MATRIZ DE DECISÃO

| Provedor de Recebimento | Status de Elegibilidade na Paddle | Custo Fixo por Payout | Spread Cambial Médio | Viabilidade no Lançamento Inicial |
| :--- | :---: | :---: | :---: | :--- |
| **1. Payoneer PJ** | 🟢 **100% Confirmado Oficialmente** | **US$ 0,00** | ~1,5% a 2,0% | **RECOMENDADO (Menor risco e sem taxa fixa)** |
| **2. Wire Internacional (SWIFT)** | 🟢 **100% Confirmado Oficialmente** | **~US$ 15 a US$ 40** | ~1,0% a 2,0% | **Apenas para repasses > US$ 1.000** |
| **3. Inter Global PJ** | 🟡 **Pendente de Validação Documental** | US$ 0,00 (se aceito) | ~1,0% a 1,5% | Exige submeter Bank Letter ao suporte Paddle |
| **4. Husky (Nomad PJ)** | 🟡 **Pendente de Validação Documental** | US$ 0,00 (se aceito) | ~1,0% fixo | Exige consultar suporte da Husky e Paddle |
| **5. Wise Business** | 🔴 **Restrito / Inviável** | — | — | Não utilizar para abertura nova |

---

## 4. RECOMENDAÇÃO OPERACIONAL ESTRATÉGICA

Para garantir que o BidReady comece a operar e faturar **sem qualquer risco de ter seus repasses bloqueados pela Paddle**:

1. **Rota Primária Imediata:** Adotar **Payoneer PJ** como primeiro método de payout configurado no painel da Paddle. Sendo parceira oficial integrada da Paddle, a aprovação é nativa, o piso é de apenas US$ 100 e a Paddle não cobra a taxa de US$ 15 de transferência internacional.
2. **Rota Secundária (Fase de Escala):** Quando a empresa atingir um faturamento mensal superior a US$ 1.500 (~R$ 8.000), configurar uma conta de câmbio direto (BTG Pactual Empresas ou Inter Global PJ após validação formal), reduzindo o spread cambial para 1,0%.
