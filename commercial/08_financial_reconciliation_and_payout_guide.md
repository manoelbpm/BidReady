# GUIA OPERACIONAL: CONCILIAÇÃO FINANCEIRA E REPASSE INTERNACIONAL (PADDLE → BRASIL)

**Documento:** `COMM-DOC-008`  
**Referência:** M5.1 Operational Revenue Readiness  
**Moeda de Venda:** USD ($)  
**Moeda de Liquidação Bancária:** BRL (R$) via Wire Transfer / SWIFT ou USD via Conta Global PJ  
**Status:** Especificação Operacional Conclusiva

---

## 1. NATUREZA DA PADDLE COMO MERCHANT OF RECORD (MoR)

A Paddle opera no modelo **Merchant of Record (MoR)**, o que traz profundas diferenças operacionais em relação a gateways convencionais (como Stripe Gateway ou Pagar.me):

1. **Responsabilidade Fiscal Global:** A Paddle é a revendedora autorizada do software. Ela emite a fatura e o recibo para o comprador final norte-americano, recolhe e recolhe os impostos aplicáveis (US Sales Tax por estado, sem que a empresa brasileira precise se registrar em cada estado americano).
2. **Saldo Retido e Ciclos de Payout:** Os pagamentos de clientes (via Cartão, Apple Pay, Google Pay) não entram imediatamente na conta bancária do fundador. Eles são acumulados no saldo do seller na Paddle (*Available Balance*).
3. **Moeda de Venda vs. Moeda de Liquidação:** A venda ocorre em **USD**. O saldo é mantido em **USD**. A liquidação e saque para o Brasil dependem do canal bancário configurado.

---

## 2. MAPEAMENTO DE DADOS: O QUE VEM DA PADDLE VS. EXTRATOS EXTERNOS

| Dado Financeiro | Fonte Autoritativa Paddle | Fonte Externa / Comprovante Bancário | Descrição e Limitações |
| :--- | :---: | :---: | :--- |
| **Valor Bruto da Venda (Gross Revenue)** | ✅ Paddle API (`/transactions` -> `details.totals.grand_total`) | — | Valor total cobrado do cartão do cliente em USD (ex: \$29.00). |
| **Taxas de Processamento da Paddle** | ✅ Paddle API (`/transactions` -> `details.totals.fee`) | — | Taxa padrão Paddle: **5% + \$0.50** por transação (ex: \$1.95 em uma assinatura de \$29). |
| **Receita Líquida do Vendedor (Earnings)** | ✅ Paddle API (`/transactions` -> `details.totals.earnings`) | — | Valor líquido que entra no saldo do seller em USD (ex: \$27.05 em \$29.00). |
| **Reembolsos e Chargebacks** | ✅ Paddle API (`/adjustments`) | — | Estornos totais ou parciais e taxas de disputa debitadas diretamente do saldo. |
| **Saldo Disponível (Available Balance)** | ⚠️ Painel Web Paddle / Extrato de Payout | — | A Paddle API Sandbox bloqueia o endpoint direto `/payouts` (HTTP 403 restrito por escopo). A conferência de saldo consolidado é obtida via Painel Web Paddle Seller ou Relatórios Periódicos (`/reports`). |
| **Taxa de Câmbio USD → BRL Efetiva** | ❌ Não fornecido pela Paddle | ✅ Contrato de Câmbio / Extrato Bancário | A Paddle transfere em USD via rede bancária internacional. A cotação comercial PTAX + spread cambial (1% a 2%) e IOF (0,38%) são definidos pelo banco liquidante brasileiro. |
| **Valor Efetivamente Creditado em BRL** | ❌ Não fornecido pela Paddle | ✅ Extrato Bancário Brasileiro (Banco Inter, Cora, Husky, Nomad, Remessa Online) | Valor final em Reais creditado na conta corrente da PJ brasileira após fechamento do câmbio. |
| **Custos de Infraestrutura e IA (COGS)** | ❌ Não fornecido pela Paddle | ✅ Faturas OpenAI / Google Cloud / Supabase / Vercel | Custo de processamento de tokens de IA por edital (~$0,15 a $0,40) e infraestrutura base. |
| **Margem de Contribuição Líquida Real** | ❌ Cálculo Próprio (BidReady Model) | ✅ DRE Gerencial | Margem real = (Earnings em BRL) - (Custos de Câmbio) - (COGS IA/Infra) - (Impostos NFSe Brasileira). |

---

## 3. CHECKLIST OBJETIVO DE PRONTIDÃO PARA RECEBIMENTO NO BRASIL

Para que os valores faturados em Sandbox sejam transferidos para o mundo real quando a conta Live for aprovada, as seguintes verificações devem ser concluídas pelo proprietário da conta:

### A. Verificação Cadastral e Jurídica (KYC / AML na Paddle)
- [ ] **Empresa Ativa (CNPJ):** CNPJ regular no Brasil com CNAE compatível com desenvolvimento e licenciamento de software (ex: CNAE 6202-3/00 ou 6203-1/00).
- [ ] **Contrato Social e Documentos dos Sócios:** Cópia autenticada do Contrato Social / Certificado de MEI / EIRELI e documento de identidade com foto (Passaporte ou CNH) dos beneficiários finais (>25% de participação).
- [ ] **Comprovante de Endereço da Empresa:** Fatura de serviços públicos em nome da pessoa jurídica com menos de 90 dias.

### B. Configuração Bancária e Opções de Liquidação
Existem duas rotas recomendadas para receber recursos da Paddle no Brasil:

#### Rota 1: Conta Global PJ em Dólar (Recomendada — Menor Custo Cambial)
- **Provedores:** Husky (Nomad PJ), Banco Inter Global PJ, Remessa Online PJ ou Wise Business.
- **Vantagem:** A Paddle transfere USD diretamente via ACH / Wire local nos EUA para as coordenadas de roteamento (Routing Number e Account Number) da conta internacional da sua PJ brasileira.
- **Custo:** Sem taxa de recebimento internacional; spread cambial reduzido (1% a 1,2%) no momento em que o proprietário decidir converter para BRL; IOF de 0,38%.

#### Rota 2: Wire Transfer Direto para Banco Tradicional no Brasil (SWIFT)
- **Requisitos:** Código SWIFT do banco brasileiro e código IBAN da conta PJ.
- **Desvantagens:** Taxa de recebimento de ordem internacional cobrada pelo banco brasileiro (\$20 a \$50 por remessa), além de spread cambial elevado (2% a 4%). Recomendado apenas se o montante acumulado for superior a \$2.000.

### C. Limiares de Saque e Prazos da Paddle
- **Frequência de Pagamento:** Semanal ou Mensal (configurável no painel da Paddle).
- **Limite Mínimo de Saque (Payout Threshold):** Padrão de \$100 USD para transferências Wire/ACH. Se o saldo for inferior a \$100, o valor acumula para o próximo ciclo sem expirar.
- **Prazo de Compensação:** Entre 3 a 5 dias úteis após a data de corte do payout da Paddle para a compensação na conta de destino.

### D. Tributação Brasileira de Exportação de Serviços
- [ ] **Emissão de NFSe:** A prestação de serviço de software para o exterior (exportação de serviços para a Paddle UK/Ireland) goza de imunidade/isenção de PIS/COFINS e ISS (a depender da legislação municipal local), incidindo alíquota reduzida no Simples Nacional (Anexo III) ou Lucro Presumido.
- [ ] **Vínculo com o Contrato de Câmbio:** Toda entrada de divisas em BRL deve ser vinculada à respectiva fatura da Paddle e ao contrato de câmbio registrado no SISBACEN.
