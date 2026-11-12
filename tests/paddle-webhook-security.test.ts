import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { POST as webhookRoute } from '../src/app/api/billing/webhook/route';
import { PaddleBillingSandbox, PaddleWebhookEvent } from '../src/lib/billing/paddle-sandbox';
import { SubscriptionService } from '../src/lib/billing/subscription-service';

describe('Paddle Webhook Security, Replay Protection & Signature Suite', () => {
  const secretKey = 'pdl_ntfset_test_secret_for_automated_suite_12345';
  let subscriptionService: SubscriptionService;
  let sandbox: PaddleBillingSandbox;

  beforeEach(() => {
    subscriptionService = new SubscriptionService();
    sandbox = new PaddleBillingSandbox(subscriptionService, secretKey);
  });

  function generatePaddleSignature(payload: string, secret: string, timestampSeconds?: number): string {
    const ts = timestampSeconds !== undefined ? timestampSeconds : Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}:${payload}`;
    const h1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    return `ts=${ts};h1=${h1}`;
  }

  describe('1. Cryptographic Signature Verification (HMAC-SHA256)', () => {
    it('accepts perfectly authentic signatures', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_sec_1' });
      const signatureHeader = generatePaddleSignature(payload, secretKey);

      const result = sandbox.verifyWebhookSignature(payload, signatureHeader);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('rejects tampered or forged signatures', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_sec_2' });
      const ts = Math.floor(Date.now() / 1000);
      const fakeH1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const badSignature = `ts=${ts};h1=${fakeH1}`;

      const result = sandbox.verifyWebhookSignature(payload, badSignature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_hash');
    });

    it('fails safely with missing_secret when secret is empty or absent', () => {
      const unconfiguredSandbox = new PaddleBillingSandbox(subscriptionService, '');
      const payload = JSON.stringify({ event_type: 'test' });
      const signatureHeader = generatePaddleSignature(payload, secretKey);

      const result = unconfiguredSandbox.verifyWebhookSignature(payload, signatureHeader);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_secret');
    });

    it('fails with missing_header when signature header is missing or null', () => {
      const payload = JSON.stringify({ event_type: 'test' });
      const result = sandbox.verifyWebhookSignature(payload, null);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_header');
    });

    it('fails with malformed_header when signature parts are missing', () => {
      const payload = JSON.stringify({ event_type: 'test' });
      const result = sandbox.verifyWebhookSignature(payload, 'invalid-signature-format');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('malformed_header');
    });
  });

  describe('2. Replay Protection & Timestamp Tolerance Window (Official Paddle 5s Standard)', () => {
    it('rejects expired timestamps exceeding the official 5-second tolerance window', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_expired' });
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 7; // 7 seconds ago (> 5s tolerance)
      const expiredSignature = generatePaddleSignature(payload, secretKey, expiredTimestamp);

      const result = sandbox.verifyWebhookSignature(payload, expiredSignature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('timestamp_expired');
    });

    it('rejects future timestamps outside the allowable 5-second clock-skew tolerance', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_future' });
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7; // 7 seconds in the future (> 5s tolerance)
      const futureSignature = generatePaddleSignature(payload, secretKey, futureTimestamp);

      const result = sandbox.verifyWebhookSignature(payload, futureSignature);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('timestamp_future');
    });

    it('accepts authentic timestamps within the official 5-second window (e.g. 2 seconds ago)', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_valid_time' });
      const recentTimestamp = Math.floor(Date.now() / 1000) - 2; // 2 seconds ago (<= 5s)
      const validSignature = generatePaddleSignature(payload, secretKey, recentTimestamp);

      const result = sandbox.verifyWebhookSignature(payload, validSignature);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('rejects malformed non-numeric timestamps', () => {
      const payload = JSON.stringify({ event_type: 'test' });
      const badHeader = `ts=not_a_number;h1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`;

      const result = sandbox.verifyWebhookSignature(payload, badHeader);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_timestamp');
    });

    it('accepts headers with multiple h1 signatures (Paddle secret rotation standard)', () => {
      const payload = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_multi_h1' });
      const ts = Math.floor(Date.now() / 1000);
      const fakeH1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const realSignedPayload = `${ts}:${payload}`;
      const realH1 = crypto.createHmac('sha256', secretKey).update(realSignedPayload).digest('hex');

      // Multiple h1 values in single header
      const multiHeader = `ts=${ts};h1=${fakeH1};h1=${realH1}`;
      const result = sandbox.verifyWebhookSignature(payload, multiHeader);
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('strictly evaluates clock drift near the 5-second boundary (4s passes, 6s fails)', () => {
      const payload = JSON.stringify({ event_type: 'test' });
      const now = Math.floor(Date.now() / 1000);

      // 4 seconds in the past -> passes
      const sig4s = generatePaddleSignature(payload, secretKey, now - 4);
      expect(sandbox.verifyWebhookSignature(payload, sig4s).valid).toBe(true);

      // 6 seconds in the past -> fails
      const sig6s = generatePaddleSignature(payload, secretKey, now - 6);
      const res6s = sandbox.verifyWebhookSignature(payload, sig6s);
      expect(res6s.valid).toBe(false);
      expect(res6s.reason).toBe('timestamp_expired');
    });
  });

  describe('3. Event Handling: Generic Test Notifications vs Commercial Events', () => {
    it('acknowledges generic Paddle sandbox test events without modifying organizations or quotas', async () => {
      const genericTestEvent: PaddleWebhookEvent = {
        event_id: `evt_generic_test_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'sub_test_generic_123',
          customer_id: 'ctm_test_generic_123',
          status: 'active',
          // Note: No custom_data.organization_id present (simulating Paddle Test Simulator)
        },
      };

      const result = await sandbox.processWebhookEvent(genericTestEvent);
      expect(result.success).toBe(true);
      expect(result.isGenericTestEvent).toBe(true);
      expect(result.organizationId).toBeUndefined();
      expect(result.notes).toContain('Generic Paddle sandbox notification acknowledged');
    });

    it('processes authentic commercial events with organization_id and elevates plan quota', async () => {
      const orgId = `org-commercial-${Date.now()}`;
      subscriptionService.getSubscription(orgId); // initialize as Free (2 analyses)

      const commercialEvent: PaddleWebhookEvent = {
        event_id: `evt_commercial_${Date.now()}`,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'sub_live_paddle_99',
          customer_id: 'ctm_live_paddle_99',
          status: 'active',
          custom_data: {
            organization_id: orgId,
            plan_id: 'pro',
          },
        },
      };

      const result = await sandbox.processWebhookEvent(commercialEvent);
      expect(result.success).toBe(true);
      expect(result.isGenericTestEvent).toBeUndefined();
      expect(result.organizationId).toBe(orgId);

      const updatedSub = subscriptionService.getSubscription(orgId);
      expect(updatedSub.planId).toBe('pro');
      expect(updatedSub.monthlyAnalysesLimit).toBe(40);
    });

    it('enforces idempotency: repeated delivery of the same event_id is safely ignored', async () => {
      const eventId = `evt_idemp_strict_${Date.now()}`;
      const event: PaddleWebhookEvent = {
        event_id: eventId,
        event_type: 'subscription.activated',
        occurred_at: new Date().toISOString(),
        data: {
          id: 'sub_idemp_test',
          custom_data: {
            organization_id: 'org-idemp-test',
            plan_id: 'starter',
          },
        },
      };

      const firstCall = await sandbox.processWebhookEvent(event);
      expect(firstCall.success).toBe(true);
      expect(firstCall.duplicate).toBe(false);

      const secondCall = await sandbox.processWebhookEvent(event);
      expect(secondCall.success).toBe(true);
      expect(secondCall.duplicate).toBe(true);
    });
  });

  describe('4. Webhook Route Security & Development Enforcement', () => {
    const originalEnvSecret = process.env.PADDLE_WEBHOOK_SECRET;

    afterEach(() => {
      process.env.PADDLE_WEBHOOK_SECRET = originalEnvSecret;
    });

    it('strictly returns HTTP 401 on invalid signature even in development environment', async () => {
      process.env.PADDLE_WEBHOOK_SECRET = secretKey;
      const rawBody = JSON.stringify({ event_type: 'subscription.activated', event_id: 'evt_dev_check' });
      const badHeader = `ts=${Math.floor(Date.now() / 1000)};h1=badhash0000000000000000000000000000000000000000000000000000000000`;

      const req = new NextRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paddle-signature': badHeader,
        },
        body: rawBody,
      });

      const response = await webhookRoute(req);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Unauthorized: Invalid webhook signature');
    });

    it('returns HTTP 500 if PADDLE_WEBHOOK_SECRET is not configured on the server', async () => {
      delete process.env.PADDLE_WEBHOOK_SECRET;

      const req = new NextRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paddle-signature': 'ts=123;h1=abc',
        },
        body: JSON.stringify({}),
      });

      const response = await webhookRoute(req);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toContain('PADDLE_WEBHOOK_SECRET is not configured');
    });

    it('returns HTTP 200 with acknowledgment when authentic generic test notification arrives', async () => {
      process.env.PADDLE_WEBHOOK_SECRET = secretKey;
      const rawBody = JSON.stringify({
        event_id: `evt_route_test_${Date.now()}`,
        event_type: 'subscription.activated',
        data: { id: 'test_sub_no_org' },
      });
      const validHeader = generatePaddleSignature(rawBody, secretKey);

      const req = new NextRequest('http://localhost:3000/api/billing/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'paddle-signature': validHeader,
        },
        body: rawBody,
      });

      const response = await webhookRoute(req);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.received).toBe(true);
      expect(body.isGenericTestEvent).toBe(true);
    });
  });
});
