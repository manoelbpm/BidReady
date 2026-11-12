# ARQUITETURA DE AUTOMAÇÃO OPERACIONAL — ZERO HUMAN INTERVENTION

**Documento:** `COMM-DOC-007`  
**Objetivo:** Operação 100% autônoma (Hands-Off) para aquisição, ativação, conversão e retenção  
**Idioma:** Português (Documentação Estratégica e Operacional)  
**Status:** Especificação de Arquitetura e Dependências (Nenhuma ferramenta paga contratada)

---

## 1. VISÃO GERAL DO FLUXO HANDS-OFF

Para que o BidReady ganhe escala e valide tração nos Estados Unidos sem exigir o tempo operacional diário do fundador (evitando reuniões individuais de vendas, suporte manual repetitivo e faturamento manual), a jornada do cliente foi desenhada como um **funil 100% self-service orientado pelo produto (Product-Led Growth - PLG)**.

```
[Lead Discovery] → [Async Outreach / Community] → [Landing Page]
       ↓
[Self-Serve Signup & Auto-Provisioning] (Zero Human Touch)
       ↓
[Automated Trial Activation: 3 Document Analyses]
       ↓
[In-App Paywall Trigger / Paddle Checkout]
       ↓
[Automated Webhook Sync & Quota Provisioning]
       ↓
[AI-Powered First-Line Support & Ticket Classification]
       ↓
[Human Alerting by Exception ONLY]
```

---

## 2. ETAPAS DETALHADAS DO FLUXO OPERACIONAL

### Etapa 1: Descoberta e Qualificação de Leads (Lead Sourcing)
- **Como funciona:** Execução periódica de scripts para extrair empresas do diretório SAM.gov (subcontratadas ativas em NAICS 541512, 541519, 541330) e enriquecimento de contatos via Apollo.io ou chamadas de API públicas.
- **Validação de e-mail:** Verificação automática de validade de caixa postal (ZeroBounce/NeverBounce) para assegurar taxa de bounce < 2%.
- **Toque humano:** 0%.

### Etapa 2: Apresentação Assíncrona e Landing Page
- **Como funciona:** O prospect recebe a sequência de e-mails em conformidade com o CAN-SPAM Act direcionando-o para a landing page ou para o vídeo de demonstração interativo (Loom de 4:30 min).
- **Sem reuniões de vendas:** Não há botão "Schedule a 30-minute Demo with Sales". Toda a demonstração é gravada, mostrando a extração real de requisitos e citações.
- **Toque humano:** 0%.

### Etapa 3: Cadastro e Provisionamento Automático (Onboarding)
- **Como funciona:** O usuário clica em "Start Free Trial", cadastra-se com e-mail corporativo (autenticação Supabase Auth).
- **Provisionamento:** Um trigger de banco ou função de onboarding cria imediatamente o workspace (`public.organizations`), vincula a membership de proprietário (`owner`) e concede a quota de teste (3 análises gratuitas).
- **Toque humano:** 0%.

### Etapa 4: Experiência do Produto e "Aha! Moment"
- **Como funciona:** Ao carregar seu primeiro edital em PDF, o motor do BidReady extrai as cláusulas e exibe as citações de página em menos de 3 minutos.
- **Notificação Automática:** Um e-mail transacional é enviado via Resend/SendGrid informando a conclusão da análise com o resumo de requisitos e lacunas.
- **Toque humano:** 0%.

### Etapa 5: Conversão e Checkout Paddle
- **Como funciona:** Ao consumir a 3ª análise gratuita, qualquer nova tentativa de upload aciona o paywall no aplicativo.
- **Transação:** O usuário escolhe o plano (Starter US\$29, Pro US\$69, Business US\$149) e realiza o pagamento via Paddle Checkout (cartão de crédito corporativo, Apple Pay ou Google Pay).
- **Ativação Instantânea:** O webhook da Paddle envia o evento `transaction.completed` / `subscription.created` para o endpoint seguro do BidReady, que valida o checkout intent, atualiza `public.saas_subscriptions` e eleva o limite de quota imediatamente.
- **Toque humano:** 0%.

### Etapa 6: Suporte de Primeiro Nível Automatizado
- **Como funciona:** Um widget de suporte integrado ao app (Crisp / Intercom ou bot local de documentação) responde a dúvidas comuns (formatos de arquivo suportados, limites de quota, política de privacidade) consultando o FAQ do produto.
- **Toque humano:** 0%.

### Etapa 7: Roteamento de Exceções Humanas (Human-in-the-Loop)
O fundador só é acionado nas seguintes situações estritas (alertas via bot de Telegram / Slack Webhook):
1. **Falha de Webhook de Pagamento:** Erro repetido de processamento no webhook da Paddle.
2. **Cliente Enterprise/Agência:** Solicitação formal de customização de volume acima de 120 análises mensais.
3. **Bug Crítico de Ingestão:** Edital em formato suportado que falhou persistentemente no parser após retentativas.

---

## 3. MAPA DE DEPENDÊNCIAS E FERRAMENTAS RECOMENDADAS

Para implementar essa automação quando houver autorização orçamentária (dentro do limite de R\$500 / US\$100):

| Componente | Ferramenta Recomendada | Custo Estimado | Função |
| :--- | :--- | :--- | :--- |
| **Hospedagem Web** | Vercel (Pro para Operação Comercial) | US$ 20,00 / mês | Hospedagem Next.js comercial com SLA e conformidade de termos |
| **Banco de Dados & Storage** | Supabase (Pro para Produção Comercial) | US$ 25,00 / mês | PostgreSQL 24/7 sem pausa, backups diários pontuais e RLS |
| **Merchant of Record** | Paddle | 5% + US$ 0,50 por transação | Faturamento global, recolhimento tributário (MoR) e cartões |
| **E-mails Transacionais**| Resend | Gratuito até 3.000/mês; US$ 20 Pro | Avisos de boas-vindas, análise pronta, quotas e recibos |
| **Demonstração em Vídeo**| Loom / Vidyard | Gratuito | Hospedagem da demo de 5 minutos |
| **Alertas de Exceção** | Telegram Bot / Slack Webhook | Gratuito | Notificações operacionais para o proprietário |

---

## 4. ESTIMATIVA E ESTRUTURAÇÃO DO ORÇAMENTO POR FASE

Para garantir total conformidade contratual com os provedores e estabilidade de infraestrutura para clientes pagantes dos EUA, os custos são divididos estritamente em três fases:

### Fase A: Desenvolvimento & Sandbox Local (Fase Atual)
- **Custos Fixos:** **US$ 0,00 / mês**.
- **Infraestrutura:** PostgreSQL local, mocks de provedores, Paddle Sandbox e ferramentas de desenvolvimento locais.

### Fase B: Validação Comercial Controlada (Piloto de Pré-Lançamento)
- **Custos Fixos Iniciais:** **US$ 10 a US$ 14 / ano** (~US$ 1,00 / mês) referentes ao registro do domínio próprio internacional (.com).
- **Ambiente:** Vercel e Supabase utilizados exclusivamente para testes técnicos pontuais com primeiros usuários de convite fechado.
- **Custos Variáveis:** Consumo sob demanda da API Google Gemini Flash (~US$ 0,01 a US$ 0,03 por edital analisado).

### Fase C: Operação Comercial de Produção (Lançamento Oficial com SLA Comercial)
- **Custos Fixos Mensais Obrigatórios:**
  - **Vercel Pro:** **US$ 20,00 / mês** (Plano obrigatório pelos termos de serviço da Vercel para SaaS comercial com tráfego de produção).
  - **Supabase Pro:** **US$ 25,00 / mês** (Garante instância ativa 24/7 sem pausa por inatividade, backups diários pontuais e SLAs de banco de dados).
  - **Domínio Próprio (.com):** **~US$ 1,00 / mês** (diluído do pagamento anual).
  - **Resend (E-mail):** **US$ 0,00** (Free Tier até 3.000 e-mails/mês) ou **US$ 20,00** (Pro tier quando o volume escalar).
  - **Total de Custos Fixos em Produção Comercial:** **US$ 46,00 / mês** (~R$ 260,00 / mês).
- **Custos Variáveis de Produção (por Demanda):**
  - **Processamento de IA (Gemini 3.8 Flash):** ~US$ 0,01 a US$ 0,03 por edital analisado (100 análises custam menos de US$ 3,00).
  - **Taxa Paddle (Merchant of Record):** 5% + US$ 0,50 por transação, descontado diretamente sobre as assinaturas faturadas em USD.
- **Compatibilidade com Orçamento Inicial (R$ 500,00 ~ US$ 90,00):** Cobre com folga o domínio (.com) e o primeiro mês completo de operação comercial com Vercel Pro e Supabase Pro assim que autorizada a publicação.
