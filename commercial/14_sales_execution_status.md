# STATUS DA OPERAÇÃO COMERCIAL & PRONTIDÃO DE JORNADA — M9.1

**Identificador do Documento:** `COMM-DOC-014`  
**Referência:** M9.1 Validação Documental e Ajustes Fatuais de Prontidão  
**Mercado-Alvo:** Estados Unidos (Pequenas empresas prestadoras de serviços de TI e cibersegurança governamental)  
**Status Atual:** **Candidatas sob Validação Documental / Zero Contatos Enviados / Produto Sem Acesso Público em Produção**  
**Ambiente de Execução:** Localhost & Bateria de Testes Automatizados (Supabase Remoto `ghqbqzljfpkjdrnuyddo` preservado intocado)

---

## 1. SITUAÇÃO REAL DA OPERAÇÃO COMERCIAL

1. **Candidatas sob Validação Documental:** A relação de empresas listada em `commercial/20_verified_prospect_shortlist.md` representa um conjunto de candidatas para futura pesquisa de mercado (*customer discovery*), identificadas em fontes públicas (SAM.gov, GSA eLibrary e diretórios comerciais). Nenhuma dessas empresas é cliente ou prospect qualificado em negociação.
2. **Nenhuma Abordagem Realizada:** **Zero e-mails, mensagens de LinkedIn ou contatos telefônicos foram realizados.** Não existem abordagens comerciais ou de pesquisa em andamento.
3. **Nenhum Cliente ou Interesse Confirmado:** Não existem clientes ativos, cartas de intenção ou interesse comercial documentado.
4. **Produto Sem Acesso Público em Produção:** O BidReady não possui deploy em nuvem nem domínio público configurado. O sistema opera exclusivamente em ambiente local de desenvolvimento (`localhost:3000`) para verificação interna e testes automatizados.
5. **Funil Comercial Não Disponível para Produção:** O fluxo de cadastro, upload e pagamento não está acessível ao público externo. A verificação realizada até o momento limita-se à integridade técnica do código e à passagem de testes em localhost.
6. **Bloqueios Administrativos Estritos:** Deploy em produção, ativação do Paddle Live, apontamento de DNS e contratação de serviços externos continuam estritamente bloqueados, dependendo de autorização formal.

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
   O sistema opera com `PADDLE_ENV=sandbox`. Nenhuma cobrança real pode ser processada. A modalidade de credenciamento (se elegível como pessoa física/CPF ou estritamente pessoa jurídica/PJ no Brasil) continua aguardando retorno oficial do suporte da Paddle.
2. **Ausência de Domínio e Deploy em Nuvem:**  
   A aplicação roda exclusivamente em máquina local. Nenhum destinatário externo consegue acessar qualquer link ou página do produto.
3. **Disparo de E-mails em Modo Mock:**  
   O serviço de e-mails opera localmente em modo simulado (Mock Mode do Resend). Não há domínio de envio com registros SPF/DKIM/DMARC apontados nem endereço físico comercial configurado.
4. **Migration 8 Pendente no Banco Remoto:**  
   A migration `20261111000008_email_outbox.sql` ainda **NÃO foi aplicada ao banco Supabase remoto** (`ghqbqzljfpkjdrnuyddo`), prevenindo alterações estruturais na infraestrutura remota.

---

## 4. INVENTÁRIO DE DEPENDÊNCIAS DE LANÇAMENTO (AÇÕES DO PROPRIETÁRIO)

Caso o proprietário do projeto decida futuramente avançar para o ambiente operacional de produção, serão necessárias as seguintes ações administrativas:

| Dependência | Ação Exigida | Impacto Financeiro Estimado | Status Atual |
| :--- | :--- | :--- | :--- |
| **1. Registro de Domínio** | Compra de domínio comercial (ex.: `.io`, `.ai` ou `.com`). | ~US$ 12.00 / ano | 🛑 Bloqueado |
| **2. Hospedagem Comercial (Vercel)** | Contratação do plano Vercel Pro (referência de produção para SaaS comercial, sujeito a aprovação). O plano Vercel Hobby não é elegível para uso comercial. | ~US$ 20.00 / mês | 🛑 Bloqueado |
| **3. Configuração de DNS Resend** | Criação de registros DNS TXT (SPF, DKIM, DMARC) no domínio. | US$ 0 (Plano inicial gratuito de envios) | 🛑 Bloqueado |
| **4. Aprovação Paddle Live (KYC)** | Submissão de documentos no painel Paddle para habilitar transações reais. A definição da titularidade (PJ ou PF) depende de resposta do suporte da Paddle. | Sem custo inicial (% retida por transação) | 🛑 Bloqueado |
| **5. Criação de Planos no Paddle Live** | Criação dos planos Starter ($29), Pro ($69) e Business ($149) e extração dos Price IDs. | US$ 0 | 🛑 Bloqueado |
| **6. Aplicação da Migration 8** | Execução de `20261111000008_email_outbox.sql` no Supabase remoto. | US$ 0 | 🛑 Bloqueado |

---

## 5. DOCUMENTOS DE REFERÊNCIA AUTORITATIVOS

- **`commercial/20_verified_prospect_shortlist.md`:** Relação de 9 candidatas ativas para pesquisa de mercado, com separação explícita entre dados confirmados em fontes oficiais e estimativas de mercado. Registra o descarte de 7 empresas (incluindo Lunarline, adquirida pela Motorola Solutions).
- **`commercial/21_customer_discovery_outreach.md`:** Modelos de comunicação honestos e transparentes voltados exclusivamente para pesquisa de mercado, sem links para ambientes de produção inexistentes, com CAN-SPAM registrado como pendente de adequação operacional e roteiro investigativo de 10–15 minutos.
- **Histórico Preservado:** Os arquivos preliminares `commercial/11`, `12` e `13` permanecem arquivados como histórico, mas encontram-se superados pelas diretrizes factuais dos documentos 20 e 21.
