# STATUS DA OPERAÇÃO COMERCIAL & PRONTIDÃO DE JORNADA — M9.1

**Identificador do Documento:** `COMM-DOC-014`  
**Referência:** M9.1 Validação Comercial e Alinhamento Documental  
**Mercado-Alvo:** Estados Unidos (Pequenas prestadoras de serviços de TI e cibersegurança governamental)  
**Status Atual:** **Shortlist sob Validação Documental / Zero Abordagens Enviadas / Produto Sem Acesso Público em Produção**  
**Ambiente de Execução:** Localhost & Bateria de Testes Automatizados (Supabase Remoto `ghqbqzljfpkjdrnuyddo` preservado intocado)

---

## 1. SITUAÇÃO REAL DA OPERAÇÃO COMERCIAL

1. **Shortlist em Validação Documental:** A lista de 10 potenciais clientes documentada em `commercial/20_verified_prospect_shortlist.md` constitui uma compilação de dados públicos (SAM.gov, GSA eLibrary e diretórios comerciais) sob escrutínio prévio. Não há relacionamento prévio estabelecido com nenhuma das empresas.
2. **Nenhuma Abordagem Enviada:** **Zero mensagens, e-mails ou convites no LinkedIn foram disparados até o momento.** Qualquer template produzido permanece como minuta em arquivo.
3. **Nenhum Cliente ou Interesse Confirmado:** Não existem clientes ativos, propostas em negociação ou intenções de compra registradas.
4. **Produto Sem Acesso Público em Produção:** O BidReady não possui deploy em nuvem nem domínio público configurado. O sistema opera exclusivamente em ambiente local (`localhost:3000`) para desenvolvimento e verificação interna.
5. **Funil Comercial Não Operacional em Produção:** O fluxo de aquisição e pagamento NÃO está aberto ao público externo. A prontidão verificada refere-se estritamente à integridade lógica do código e aos testes automatizados locais.
6. **Bloqueios Administrativos Mantidos:** Paddle Live, deploy em produção, apontamento de DNS e contratação de serviços continuam estritamente bloqueados aguardando autorização formal.

---

## 2. VERIFICAÇÃO TÉCNICA DO FLUXO EM AMBIENTE LOCAL

A tabela abaixo documenta o status de implementação de cada etapa lógica verificada nos testes locais, sem que isso represente disponibilidade em ambiente público de produção:

```
+------------------------------------------------------------------------------------------------------------------+
| ETAPA DA JORNADA              | STATUS NO CÓDIGO (LOCAL)       | AMBIENTE & OBSERVAÇÃO TÉCNICA                   |
+------------------------------------------------------------------------------------------------------------------+
| 1. Visita à Página Inicial    | ✅ Implementado (EN)           | Localhost: http://localhost:3000                |
|                               |                                | Sem deploy público; inacessível externamente.   |
+------------------------------------------------------------------------------------------------------------------+
| 2. Apresentação da Proposta   | ✅ Implementado (EN)           | Localhost. Explica citações e rastreabilidade   |
|                               |                                | sem garantias jurídicas ou promessas irreais.   |
+------------------------------------------------------------------------------------------------------------------+
| 3. Demonstração Interativa    | ✅ Implementado (EN)           | Localhost: http://localhost:3000/demo           |
|                               |                                | Baseada em documento sintético local.           |
+------------------------------------------------------------------------------------------------------------------+
| 4. Cadastro de Conta          | ✅ Implementado                | Localhost: http://localhost:3000/signup         |
|                               |                                | Provisionamento do plano Free (2 análises/mês). |
+------------------------------------------------------------------------------------------------------------------+
| 5. Análise de Documentos      | ✅ Implementado                | Localhost: http://localhost:3000/upload         |
|                               |                                | Suporta PDF, DOCX e XLSX (até 50MB, sem OCR).   |
+------------------------------------------------------------------------------------------------------------------+
| 6. Tabela de Preços           | ✅ Implementado (EN)           | Localhost: http://localhost:3000/pricing        |
|                               |                                | Starter ($29/10), Pro ($69/40), Business ($149) |
+------------------------------------------------------------------------------------------------------------------+
| 7. Checkout Paddle            | ✅ Implementado                | Integrado apenas ao Paddle Sandbox de testes.   |
|                               |                                | Ambiente Live desativado por política.          |
+------------------------------------------------------------------------------------------------------------------+
```

---

## 3. PENDÊNCIAS E RESTRIÇÕES OPERACIONAIS (GATES)

### Restrições Operacionais Mantidas:
1. **Credenciais Paddle Live Não Ativadas:**  
   O sistema opera com `PADDLE_ENV=sandbox`. Nenhuma cobrança real pode ser processada.
2. **Ausência de Domínio e Deploy em Nuvem:**  
   A aplicação roda exclusivamente em máquina local. Nenhum prospect externo consegue acessar qualquer link ou página do produto.
3. **Disparo de E-mails em Modo Mock:**  
   O serviço de e-mails opera localmente em modo simulado (Mock Mode do Resend). Não há domínio de envio com registros SPF/DKIM/DMARC apontados.
4. **Migration 8 Pendente no Banco Remoto:**  
   A tabela `email_outbox` não foi aplicada no Supabase remoto (`ghqbqzljfpkjdrnuyddo`), prevenindo impactos no ambiente de banco hospedado.

---

## 4. INVENTÁRIO DE DEPENDÊNCIAS DE LANÇAMENTO (AÇÕES DO PROPRIETÁRIO)

Caso o proprietário do projeto decida futuramente avançar para o ambiente operacional de produção, serão necessárias as seguintes ações administrativas:

| Dependência | Ação Exigida | Impacto Financeiro Estimado | Status Atual |
| :--- | :--- | :--- | :--- |
| **1. Registro de Domínio** | Compra de domínio comercial (ex.: `.io`, `.ai` ou `.com`). | ~US$ 12.00 / ano | 🛑 Bloqueado |
| **2. Deploy em Produção** | Vinculação do repositório à Vercel e configuração do domínio. | US$ 0 (Hobby) / US$ 20/mês (Pro) | 🛑 Bloqueado |
| **3. Configuração de DNS Resend** | Criação de registros DNS TXT (SPF, DKIM, DMARC) no domínio. | US$ 0 (Free até 3.000 envios/mês) | 🛑 Bloqueado |
| **4. Aprovação Paddle Live (KYC)** | Envio de documentação PJ no painel Paddle para habilitar transações reais. | Sem custo inicial (% por transação) | 🛑 Bloqueado |
| **5. Criação de Planos no Paddle Live** | Criação dos planos Starter ($29), Pro ($69) e Business ($149) e extração dos Price IDs. | US$ 0 | 🛑 Bloqueado |
| **6. Aplicação da Migration 8** | Execução de `20261111000008_email_outbox.sql` no Supabase remoto. | US$ 0 | 🛑 Bloqueado |

---

## 5. DOCUMENTOS DE REFERÊNCIA AUTORITATIVOS

- **`commercial/20_verified_prospect_shortlist.md`:** Shortlist de 10 pequenas empresas americanas com contratos e veículos públicos auditados, com divisão clara entre dados confirmados em fontes oficiais e estimativas de mercado. Substitui e anula a lista preliminar `commercial/12_first_10_prospects.md`.
- **`commercial/21_customer_discovery_outreach.md`:** Modelos de abordagem exclusiva para pesquisa de mercado (*customer discovery*), perguntas para entrevista qualitativa de 10–15 minutos e checklist de conformidade CAN-SPAM. Sem links de produção e sem promessas não comprovadas.
- **Histórico Preservado:** Os arquivos preliminares `commercial/11`, `12` e `13` permanecem arquivados como histórico, mas não refletem a metodologia rigorosa aprovada no documento 20.
