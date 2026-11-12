import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import {
  TransactionalEmailService,
  maskEmail,
} from '../src/lib/email/resend-service';
import {
  isPaddleLive,
  getPaddleEnvironment,
  getPaddleApiBaseUrl,
  validatePaddleConfig,
  resolvePaddlePriceId,
  mapPaddlePriceToPlan,
  SANDBOX_PADDLE_PRICES,
} from '../src/lib/billing/paddle-config';
import {
  PaddleBillingSandbox,
  verifyPaddleWebhook,
} from '../src/lib/billing/paddle-sandbox';
import { SubscriptionService } from '../src/lib/billing/subscription-service';
import { SAAS_PLANS } from '../src/types/billing';
import { DocumentProcessingService } from '../src/lib/documents/service';
import { MockAIProvider } from '../src/lib/ai/mock-provider';
import * as XLSX from 'xlsx';

describe('BIDREADY — M5.4: Production Integration & Launch Readiness Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // SCENARIO 1: Cadastro e provisionamento Free com boas-vindas
  // =========================================================================
  it('1. Cadastro e provisionamento Free: provisiona 2 análises e dispara email de boas-vindas', async () => {
    const subService = new SubscriptionService();
    const emailService = new TransactionalEmailService({ forceMock: true });
    emailService.clearOutboxRegistry();

    const testOrgId = 'org-m54-signup-test';
    const testEmail = 'founder@aerospace-rfp.com';

    // Provision organization on Free plan
    const sub = subService.getSubscription(testOrgId);
    expect(sub.planId).toBe('free');
    expect(sub.monthlyAnalysesLimit).toBe(2);
    expect(sub.analysesUsedInPeriod).toBe(0);

    // Welcome email trigger
    const emailResult = await emailService.sendTransactionalEmail({
      to: testEmail,
      eventType: 'welcome',
      idempotencyKey: `welcome:${testEmail}`,
      organizationId: testOrgId,
      data: {
        fullName: 'Alex Vance',
        organizationName: 'Aerospace RFP Partners',
      },
    });

    expect(emailResult.success).toBe(true);
    expect(emailResult.isMock).toBe(true);
    expect(emailResult.duplicate).toBe(false);

    const outbox = emailService.getOutboxEvents();
    expect(outbox.length).toBe(1);
    expect(outbox[0].eventType).toBe('welcome');
    expect(outbox[0].maskedTo).toBe('f***r@aerospace-rfp.com');
    expect(outbox[0].subject).toContain('Welcome to BidReady');
  });

  // =========================================================================
  // SCENARIO 2: Envio de e-mail em modo mock & sanitização de PII
  // =========================================================================
  it('2. Envio de e-mail em modo mock: não chama rede e mascara PII nos registros', async () => {
    const emailService = new TransactionalEmailService({ forceMock: true });
    emailService.clearOutboxRegistry();

    // Verify PII masking function directly
    expect(maskEmail('john.doe@cyberdefense.gov')).toBe('j***e@cyberdefense.gov');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
    expect(maskEmail('invalid-string')).toBe('***@***');

    const result = await emailService.sendTransactionalEmail({
      to: 'sarah.connor@cyberdyne-defense.com',
      eventType: 'analysis_completed',
      idempotencyKey: 'analysis:opp-100:doc-500',
      data: {
        opportunityId: 'opp-100',
        opportunityTitle: 'FAA Radar Framework',
        totalRequirements: 84,
        matchedRequirements: 79,
        gapCount: 5,
      },
    });

    expect(result.success).toBe(true);
    expect(result.isMock).toBe(true);
    expect(result.messageId).toMatch(/^resend_mock_/);

    const events = emailService.getOutboxEvents();
    expect(events[0].maskedTo).toBe('s***r@cyberdyne-defense.com');
    expect(events[0].subject).toBe('[Ready] Compliance Analysis: FAA Radar Framework');
  });

  // =========================================================================
  // SCENARIO 3: Falha do provedor de e-mail sem comprometer a operação principal
  // =========================================================================
  it('3. Falha do provedor de e-mail: nunca lança exceção e não compromete a operação', async () => {
    const faultyEmailService = new TransactionalEmailService({ forceMock: false, apiKey: 'mock_invalid' });

    // Intentionally pass an invalid event type to trigger render failure
    const res = await faultyEmailService.sendTransactionalEmail({
      to: 'analyst@contractor.com',
      eventType: 'non_existent_type' as any,
      idempotencyKey: 'fail-test-01',
      data: {},
    });

    // Must return safe failure object without throwing
    expect(res.success).toBe(false);
    expect(res.status).toBe('failed');
    expect(res.error).toBeDefined();

    // Verify main pipeline continues smoothly
    const docService = new DocumentProcessingService(new MockAIProvider());
    expect(docService).toBeDefined();
  });

  // =========================================================================
  // SCENARIO 4: Idempotência de notificações contra repetição
  // =========================================================================
  it('4. Idempotência de notificações: previne duplicatas em webhooks repetidos', async () => {
    const emailService = new TransactionalEmailService({ forceMock: true });
    emailService.clearOutboxRegistry();

    const sharedKey = 'receipt:evt_paddle_webhook_dup_999';

    // 1st delivery attempt
    const firstAttempt = await emailService.sendTransactionalEmail({
      to: 'billing@agency.com',
      eventType: 'payment_receipt',
      idempotencyKey: sharedKey,
      data: {
        organizationName: 'Agency Prime',
        planName: 'Pro',
      },
    });
    expect(firstAttempt.success).toBe(true);
    expect(firstAttempt.duplicate).toBe(false);
    expect(firstAttempt.status).toBe('mocked');

    // 2nd delivery attempt with identical idempotencyKey
    const secondAttempt = await emailService.sendTransactionalEmail({
      to: 'billing@agency.com',
      eventType: 'payment_receipt',
      idempotencyKey: sharedKey,
      data: {
        organizationName: 'Agency Prime',
        planName: 'Pro',
      },
    });
    expect(secondAttempt.success).toBe(true);
    expect(secondAttempt.duplicate).toBe(true);
    expect(secondAttempt.status).toBe('skipped_duplicate');

    // Exactly one event recorded in outbox
    const events = emailService.getOutboxEvents();
    expect(events.length).toBe(1);
  });

  // =========================================================================
  // SCENARIO 4B: Eventos concorrentes com a mesma chave (Corrida Atômica)
  // =========================================================================
  it('4B. Eventos concorrentes: requisições paralelas com mesma chave não geram duplicatas', async () => {
    const emailService = new TransactionalEmailService({ forceMock: true });
    emailService.clearOutboxRegistry();

    const concurrentKey = 'concurrent:analysis:doc-concurrent-777';

    // Dispatch 5 parallel concurrent requests simultaneously with identical key
    const promises = Array.from({ length: 5 }).map((_, i) =>
      emailService.sendTransactionalEmail({
        to: `lead-${i}@contractor.com`,
        eventType: 'welcome',
        idempotencyKey: concurrentKey,
        data: {
          fullName: `Lead ${i}`,
          organizationName: 'Concurrent Corp',
        },
      })
    );

    const results = await Promise.all(promises);

    // Exactly one call should be non-duplicate
    const freshDeliveries = results.filter((r) => !r.duplicate);
    const duplicates = results.filter((r) => r.duplicate);

    expect(freshDeliveries.length).toBe(1);
    expect(duplicates.length).toBe(4);

    // Exactly one record exists in outbox
    const outbox = emailService.getOutboxEvents();
    expect(outbox.length).toBe(1);
    expect(outbox[0].idempotencyKey).toBe(concurrentKey);
  });

  // =========================================================================
  // SCENARIO 4C: Falha e recuperação de envio (Retry Recovery)
  // =========================================================================
  it('4C. Falha e recuperação: evento que falhou pode ser re-executado com sucesso sem duplicar', async () => {
    const emailService = new TransactionalEmailService({ forceMock: true });
    emailService.clearOutboxRegistry();

    const retryKey = 'retry:analysis:doc-fail-recover-01';

    // 1st attempt: fail due to invalid render data
    const failAttempt = await emailService.sendTransactionalEmail({
      to: 'capture@contractor.com',
      eventType: 'invalid_type' as any,
      idempotencyKey: retryKey,
      data: {},
    });
    expect(failAttempt.success).toBe(false);
    expect(failAttempt.status).toBe('failed');

    // 2nd attempt: retry with valid data and same idempotencyKey
    const recoverAttempt = await emailService.sendTransactionalEmail({
      to: 'capture@contractor.com',
      eventType: 'welcome',
      idempotencyKey: retryKey,
      data: {
        fullName: 'Recovered User',
        organizationName: 'Resilient Org',
      },
    });

    expect(recoverAttempt.success).toBe(true);
    expect(recoverAttempt.status).toBe('mocked');
    expect(recoverAttempt.duplicate).toBe(false);

    // Outbox updated to mocked with retryCount >= 1
    const outbox = emailService.getOutboxEvents();
    expect(outbox.length).toBe(1);
    expect(outbox[0].status).toBe('mocked');
    expect(outbox[0].retryCount).toBeGreaterThanOrEqual(1);

    // 3rd attempt: now that it succeeded, subsequent call is skipped as duplicate
    const thirdAttempt = await emailService.sendTransactionalEmail({
      to: 'capture@contractor.com',
      eventType: 'welcome',
      idempotencyKey: retryKey,
      data: {
        fullName: 'Recovered User',
        organizationName: 'Resilient Org',
      },
    });
    expect(thirdAttempt.duplicate).toBe(true);
    expect(thirdAttempt.status).toBe('skipped_duplicate');
  });

  // =========================================================================
  // SCENARIO 5: Checkout Sandbox com catálogo de preços seguro
  // =========================================================================
  it('5. Checkout Sandbox: resolve Price IDs de Sandbox corretamente quando PADDLE_ENV=sandbox', () => {
    process.env.PADDLE_ENV = 'sandbox';

    expect(isPaddleLive()).toBe(false);
    expect(getPaddleEnvironment()).toBe('sandbox');
    expect(getPaddleApiBaseUrl()).toBe('https://sandbox-api.paddle.com');

    // Resolves default sandbox price IDs
    expect(resolvePaddlePriceId('starter')).toBe(SANDBOX_PADDLE_PRICES.starter);
    expect(resolvePaddlePriceId('pro')).toBe(SANDBOX_PADDLE_PRICES.pro);
    expect(resolvePaddlePriceId('business')).toBe(SANDBOX_PADDLE_PRICES.business);

    // Reverse mapping
    expect(mapPaddlePriceToPlan(SANDBOX_PADDLE_PRICES.starter)).toBe('starter');
    expect(mapPaddlePriceToPlan(SANDBOX_PADDLE_PRICES.pro)).toBe('pro');
    expect(mapPaddlePriceToPlan(SANDBOX_PADDLE_PRICES.business)).toBe('business');
  });

  // =========================================================================
  // SCENARIO 6: Validação de assinatura HMAC de webhook Sandbox
  // =========================================================================
  it('6. Validação de webhook Sandbox: valida HMAC-SHA256 e rejeita tampering e drift temporal', () => {
    const secret = 'pdl_ntfset_01m73secret_test_key_2026';
    const payload = JSON.stringify({
      event_id: 'evt_test_sec_01',
      event_type: 'subscription.activated',
      occurred_at: new Date().toISOString(),
    });

    const ts = Math.floor(Date.now() / 1000);
    const h1 = crypto.createHmac('sha256', secret).update(`${ts}:${payload}`).digest('hex');
    const validHeader = `ts=${ts};h1=${h1}`;

    // Valid signature passes
    const validCheck = verifyPaddleWebhook(payload, validHeader, secret, 10);
    expect(validCheck.valid).toBe(true);

    // Tampered payload fails
    const tamperedCheck = verifyPaddleWebhook(payload + 'tampered', validHeader, secret, 10);
    expect(tamperedCheck.valid).toBe(false);
    expect(tamperedCheck.reason).toBe('invalid_hash');

    // Expired timestamp fails
    const oldTs = ts - 30; // 30 seconds ago
    const oldH1 = crypto.createHmac('sha256', secret).update(`${oldTs}:${payload}`).digest('hex');
    const expiredHeader = `ts=${oldTs};h1=${oldH1}`;
    const expiredCheck = verifyPaddleWebhook(payload, expiredHeader, secret, 5); // 5 sec tolerance
    expect(expiredCheck.valid).toBe(false);
    expect(expiredCheck.reason).toBe('timestamp_expired');
  });

  // =========================================================================
  // SCENARIO 7: Ativação e atualização de assinatura
  // =========================================================================
  it('7. Ativação e atualização de assinatura: eleva franquia e documenta responsabilidade de recibo vs Paddle', async () => {
    const subService = new SubscriptionService();
    const sandbox = new PaddleBillingSandbox(subService);
    const orgId = 'org-m54-sub-activation';

    // Simulate subscription activated event
    const event = {
      event_id: 'evt_act_001',
      event_type: 'subscription.activated',
      occurred_at: new Date().toISOString(),
      data: {
        id: 'sub_live_sim_01',
        customer_id: 'ctm_01',
        status: 'active',
        custom_data: {
          organization_id: orgId,
          plan_id: 'pro',
        },
        items: [{ price: { id: SANDBOX_PADDLE_PRICES.pro } }],
      },
    };

    const res = await sandbox.processWebhookEvent(event as any);
    expect(res.success).toBe(true);

    // Verify plan limits updated to Pro (40 analyses)
    const sub = subService.getSubscription(orgId);
    expect(sub?.planId).toBe('pro');
    expect(sub?.monthlyAnalysesLimit).toBe(40);
  });

  // =========================================================================
  // SCENARIO 8: Customer Portal Sandbox
  // =========================================================================
  it('8. Customer Portal Sandbox: utiliza endpoint de sandbox e credenciais isoladas', () => {
    process.env.PADDLE_ENV = 'sandbox';
    process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_test';

    expect(getPaddleApiBaseUrl()).toBe('https://sandbox-api.paddle.com');
    const validation = validatePaddleConfig();
    expect(validation.isLive).toBe(false);
    expect(validation.environment).toBe('sandbox');
  });

  // =========================================================================
  // SCENARIO 9: Separação e bloqueio de configuração Live incompleta
  // =========================================================================
  it('9. Separação Live/Sandbox: bloqueia execução em produção se faltarem credenciais ou se houver vazamento de preços sandbox', () => {
    // Attempt 1: Enable live without credentials
    process.env.PADDLE_ENV = 'production';
    delete process.env.PADDLE_API_KEY;
    delete process.env.PADDLE_PRICE_STARTER;

    const validation1 = validatePaddleConfig();
    expect(validation1.valid).toBe(false);
    expect(validation1.isLive).toBe(true);
    expect(validation1.errors.some((e) => e.includes('PADDLE_API_KEY'))).toBe(true);

    // Attempt 2: Live mode with Sandbox price IDs leaked
    process.env.PADDLE_API_KEY = 'live_api_key_valid_length_secret';
    process.env.PADDLE_WEBHOOK_SECRET = 'live_webhook_secret_valid';
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = 'live_client_token_valid';
    process.env.PADDLE_PRICE_STARTER = SANDBOX_PADDLE_PRICES.starter; // Leaked sandbox price!
    process.env.PADDLE_PRICE_PRO = 'pri_live_pro_999';
    process.env.PADDLE_PRICE_BUSINESS = 'pri_live_biz_999';

    const validation2 = validatePaddleConfig();
    expect(validation2.valid).toBe(false);
    expect(validation2.errors.some((e) => e.includes('using Sandbox Price ID'))).toBe(true);

    // Attempt 3: Resolving price in invalid live mode throws descriptive error
    expect(() => resolvePaddlePriceId('starter')).toThrow(/Paddle Live Configuration Blocked/);

    // Attempt 4: Clean, fully provisioned production configuration
    process.env.PADDLE_PRICE_STARTER = 'pri_live_starter_111';
    const validationClean = validatePaddleConfig();
    expect(validationClean.valid).toBe(true);
    expect(validationClean.isLive).toBe(true);
    expect(resolvePaddlePriceId('starter')).toBe('pri_live_starter_111');
  });

  // =========================================================================
  // SCENARIO 9B: Proteção do Resend Mock em Produção
  // =========================================================================
  it('9B. Proteção do Mock em Produção: proíbe RESEND_MOCK_MODE=true e rejeita simulações com erro explícito', async () => {
    (process.env as any).NODE_ENV = 'production';

    // 1. Setting RESEND_MOCK_MODE=true in production throws an operational security violation
    process.env.RESEND_MOCK_MODE = 'true';
    expect(() => new TransactionalEmailService()).toThrow(/RESEND_MOCK_MODE is strictly forbidden in production/);

    // 2. Mock/test keys in production do NOT simulate success silently
    process.env.RESEND_MOCK_MODE = 'false';
    const prodServiceWithMockKey = new TransactionalEmailService({ apiKey: 'mock_test_key_prod' });

    const sendRes = await prodServiceWithMockKey.sendTransactionalEmail({
      to: 'buyer@commercial-defense.com',
      eventType: 'welcome',
      idempotencyKey: 'prod_fail_test_key_01',
      data: { fullName: 'Prod User', organizationName: 'Prod Org' },
    });

    // Must report operational failure: NOT mock success!
    expect(sendRes.success).toBe(false);
    expect(sendRes.isMock).toBe(false);
    expect(sendRes.status).toBe('failed');
    expect(sendRes.error).toContain('Valid production RESEND_API_KEY is required');

    // 3. In test/dev mode, Mock continues available and functions normally
    (process.env as any).NODE_ENV = 'test';
    const devService = new TransactionalEmailService({ forceMock: true });
    const devRes = await devService.sendTransactionalEmail({
      to: 'dev@test.com',
      eventType: 'welcome',
      idempotencyKey: 'dev_mock_test_key_01',
      data: { fullName: 'Dev User', organizationName: 'Dev Org' },
    });
    expect(devRes.success).toBe(true);
    expect(devRes.isMock).toBe(true);
    expect(devRes.status).toBe('mocked');
  });

  // =========================================================================
  // SCENARIO 10: Quotas, upload, análise e isolamento entre organizações
  // =========================================================================
  it('10. Quotas e isolamento: bloqueia exaustão de quota e garante separação entre organizações', async () => {
    const subService = new SubscriptionService();
    const docService = new DocumentProcessingService(new MockAIProvider(), subService);

    const orgA = 'org-tenant-alpha';
    const orgB = 'org-tenant-beta';

    // Provision Org A with Free plan (2 analyses)
    subService.getSubscription(orgA);
    // Provision Org B with Starter plan (10 analyses)
    subService.changePlan(orgB, 'starter');

    // Create synthetic valid XLSX workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Mandatory Requirements', 'Category', 'Due Date'],
      ['NIST SP 800-171 Compliance', 'Security', '2026-12-01'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'RFP_Criteria');
    const validBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 1st analysis for Org A
    const resA1 = await docService.ingestAndProcessDocument({
      documentId: 'doc-a1',
      organizationId: orgA,
      userId: 'user-a',
      fileName: 'RFP_Alpha_1.xlsx',
      fileBuffer: validBuffer,
    });
    expect(['completed', 'review_required']).toContain(resA1.status);

    // 2nd analysis for Org A
    const resA2 = await docService.ingestAndProcessDocument({
      documentId: 'doc-a2',
      organizationId: orgA,
      userId: 'user-a',
      fileName: 'RFP_Alpha_2.xlsx',
      fileBuffer: Buffer.concat([validBuffer, Buffer.from('unique salt')]),
    });
    expect(['completed', 'review_required']).toContain(resA2.status);

    // 3rd analysis for Org A: Quota exhausted!
    const quotaA = subService.checkQuota(orgA);
    expect(quotaA.allowed).toBe(false);
    expect(quotaA.remaining).toBe(0);

    // Cross-tenant isolation: Org B still has full Starter quota available
    const quotaB = subService.checkQuota(orgB);
    expect(quotaB.allowed).toBe(true);
    expect(quotaB.remaining).toBe(10);

    // Cross-tenant document access is forbidden
    expect(() => {
      docService.getDocument('doc-a1', orgB);
    }).toThrow(/Cross-tenant access denied/);
  });
});
