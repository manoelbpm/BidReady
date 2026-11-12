import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import {
  OpportunityRepository,
  EvidenceRepository,
  DocumentRepository,
  NotificationRepository,
  SubscriptionRepository,
  WebhookRepository,
} from '../src/lib/supabase/repositories';

// Load .env.local safely
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Ignore if already loaded or not present
  }
}

describe('M4.10 — Supabase PostgreSQL Real Persistence & Multi-Tenant Security Suite', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  let clientOrg1: SupabaseClient;
  let clientOrg2: SupabaseClient;

  const org1Id = 'b22937b6-51e5-48a0-a75d-7b3405427298'; // Global Defense Systems Corp
  const org2Id = '7a9537da-ff33-4f55-a93a-f86813234f34'; // Competitor Workspace

  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    expect(supabaseUrl).toBeTruthy();
    expect(anonKey).toBeTruthy();
    expect(supabaseUrl).not.toContain('placeholder');

    // 1. Authenticate Organization 1 Lead Analyst
    clientOrg1 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth1 = await clientOrg1.auth.signInWithPassword({
      email: 'analyst@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth1.error).toBeNull();
    expect(auth1.data.user).toBeDefined();
    user1Id = auth1.data.user!.id;

    // 2. Authenticate Organization 2 Competitor
    clientOrg2 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth2 = await clientOrg2.auth.signInWithPassword({
      email: 'competitor@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth2.error).toBeNull();
    expect(auth2.data.user).toBeDefined();
    user2Id = auth2.data.user!.id;
  });

  describe('1. Security & Environment Variable Auditing', () => {
    it('never exposes service_role key or database master secrets in frontend environment', () => {
      // Check all environment variables prefixed with NEXT_PUBLIC_
      const publicVars = Object.keys(process.env).filter((k) => k.startsWith('NEXT_PUBLIC_'));

      for (const varName of publicVars) {
        expect(varName).not.toContain('SERVICE_ROLE');
        expect(varName).not.toContain('DATABASE_URL');
        expect(varName).not.toContain('SECRET');
      }

      // Check that service role is not in NEXT_PUBLIC_
      expect(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });
  });

  describe('2. Real CRUD Operations on Remote PostgreSQL (Authenticated Client + RLS)', () => {
    let createdOppId: string;
    let createdEvidenceId: string;
    let createdNotifId: string;

    it('creates, retrieves, and updates an Opportunity in PostgreSQL', async () => {
      const oppRepo = new OpportunityRepository(clientOrg1);

      // Create
      const newOpp = await oppRepo.createOpportunity({
        organization_id: org1Id,
        created_by_user_id: user1Id,
        title: 'DoD Tactical Communications RFP 2026',
        description: 'Secure tactical communications framework for multi-domain operations.',
        reference_code: `RFP-DOD-${Date.now()}`,
        issuing_body: 'Defense Information Systems Agency (DISA)',
        estimated_value: 12500000,
        currency: 'USD',
        priority: 'high',
        stage: 'intake',
      });

      expect(newOpp.id).toBeDefined();
      expect(newOpp.organization_id).toBe(org1Id);
      expect(newOpp.title).toBe('DoD Tactical Communications RFP 2026');
      createdOppId = newOpp.id;

      // Read
      const retrieved = await oppRepo.getOpportunity(createdOppId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(createdOppId);
      expect(retrieved!.estimated_value).toBe(12500000);

      // Update
      const updated = await oppRepo.updateOpportunity(createdOppId, {
        priority: 'critical' as any,
        stage: 'review' as any,
      });
      expect(updated.stage).toBe('review');

      // Add Requirement linked to this Opportunity
      const req = await oppRepo.createRequirement({
        organization_id: org1Id,
        opportunity_id: createdOppId,
        type: 'MANDATORY',
        category: 'Cybersecurity',
        title: 'NSA Type 1 Encryption Compliance',
        description: 'Hardware crypto core must be certified under NSA Suite B cryptographic standards.',
        source_reference: { page: 42, section: '3.2.1' },
      });
      expect(req.id).toBeDefined();
      expect(req.opportunity_id).toBe(createdOppId);

      const reqList = await oppRepo.listRequirements(createdOppId);
      expect(reqList.length).toBeGreaterThanOrEqual(1);
      expect(reqList.some((r) => r.id === req.id)).toBe(true);
    });

    it('creates, verifies, and lists corporate Evidence artifacts in PostgreSQL', async () => {
      const evidenceRepo = new EvidenceRepository(clientOrg1);

      const ev = await evidenceRepo.createEvidence({
        organization_id: org1Id,
        title: 'NSA Suite B Cryptographic Core Certification',
        category: 'Cybersecurity',
        description: 'Certified cryptographic coprocessor security evaluation report.',
        issuing_organization: 'National Security Agency',
        valid_until: '2028-12-31T00:00:00Z',
        tags: ['NSA', 'Crypto', 'Type 1', 'FIPS-140-3'],
        verification_status: 'pending_verification',
      });

      expect(ev.id).toBeDefined();
      expect(ev.organization_id).toBe(org1Id);
      expect(ev.verification_status).toBe('pending_verification');
      createdEvidenceId = ev.id;

      // Verify the evidence
      const verified = await evidenceRepo.verifyEvidence(
        createdEvidenceId,
        user1Id,
        true
      );
      expect(verified.verification_status).toBe('verified');
      expect(verified.verified_by_user_id).toBe(user1Id);
      expect(verified.verified_at).toBeDefined();

      // List evidence
      const list = await evidenceRepo.listEvidence(org1Id);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.some((item) => item.id === createdEvidenceId)).toBe(true);
    });

    it('creates and marks internal notifications as read in PostgreSQL', async () => {
      const notifRepo = new NotificationRepository(clientOrg1);

      const notif = await notifRepo.createNotification({
        organization_id: org1Id,
        user_id: user1Id,
        type: 'DEADLINE_APPROACHING',
        title: 'NSA Certification Expiry Alert',
        message: 'Review scheduled within next 30 days.',
        severity: 'warning',
      });

      expect(notif.id).toBeDefined();
      expect(notif.is_read).toBe(false);
      createdNotifId = notif.id;

      const updated = await notifRepo.markAsRead(createdNotifId);
      expect(updated.is_read).toBe(true);
    });
  });

  describe('3. Cold-Start / Process Restart Data Persistence Proof', () => {
    it('retrieves previously inserted records using a completely fresh client instance', async () => {
      // Simulate client cold restart
      const freshClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await freshClient.auth.signInWithPassword({
        email: 'analyst@bidready.com',
        password: 'SuperSecret2026!',
      });

      const oppRepo = new OpportunityRepository(freshClient);
      const opps = await oppRepo.listOpportunities(org1Id);

      expect(opps.length).toBeGreaterThan(0);
      const targetOpp = opps.find((o) => o.title === 'DoD Tactical Communications RFP 2026');
      expect(targetOpp).toBeDefined();
      expect(targetOpp?.organization_id).toBe(org1Id);
      expect(targetOpp?.stage).toBe('review');
    });
  });

  describe('4. Multi-Tenant Isolation & Row-Level Security (RLS) Enforcement', () => {
    it('completely hides Organization 1 opportunities and evidence from Organization 2', async () => {
      // Org 2 user attempts to list opportunities
      const oppRepo2 = new OpportunityRepository(clientOrg2);
      const org2Opps = await oppRepo2.listOpportunities(org2Id);

      // Verify Org 2 cannot see Org 1 opportunities
      const crossTenantOpps = org2Opps.filter((o) => o.organization_id === org1Id);
      expect(crossTenantOpps.length).toBe(0);

      // Org 2 user attempts to list evidence
      const evRepo2 = new EvidenceRepository(clientOrg2);
      const org2Evidences = await evRepo2.listEvidence(org2Id);

      const crossTenantEvidence = org2Evidences.filter((e) => e.organization_id === org1Id);
      expect(crossTenantEvidence.length).toBe(0);
    });

    it('strictly rejects cross-tenant insertion into foreign organization via RLS check', async () => {
      const oppRepo2 = new OpportunityRepository(clientOrg2);

      // Org 2 attempts to insert an opportunity pretending to belong to Org 1
      await expect(
        oppRepo2.createOpportunity({
          organization_id: org1Id, // Target foreign organization
          created_by_user_id: user2Id,
          title: 'Malicious Cross-Tenant Injection',
        })
      ).rejects.toThrowError(/(violates row-level security|new row violates row-level security)/i);
    });
  });

  describe('5. Supabase Private Storage Upload, Download & Multi-Tenant Isolation', () => {
    const testDocId = `doc-test-${Date.now()}`;
    const storagePath = `${org1Id}/${testDocId}/sample-tender-document.pdf`;
    const dummyPdfContent = Buffer.from('%PDF-1.4 Mock Tender Specification Content for Testing');

    it('successfully uploads and downloads private document in tender-documents bucket', async () => {
      const docRepo = new DocumentRepository(clientOrg1);

      // 1. Upload
      const uploadRes = await docRepo.uploadFile(storagePath, dummyPdfContent, 'application/pdf');
      expect(uploadRes.path).toBeDefined();

      // 2. Download
      const downloadedBlob = await docRepo.downloadFile(storagePath);
      expect(downloadedBlob).toBeDefined();
      const downloadedText = await downloadedBlob.text();
      expect(downloadedText).toContain('%PDF-1.4 Mock Tender Specification Content');
    });

    it('blocks foreign organization from downloading private files in tender-documents bucket', async () => {
      const docRepoForeign = new DocumentRepository(clientOrg2);

      // Org 2 attempts to download Org 1 private file
      await expect(
        docRepoForeign.downloadFile(storagePath)
      ).rejects.toThrow();
    });
  });

  describe('6. PostgreSQL Webhook Persistence & Atomic Idempotency Security Guard', () => {
    it('strictly forbids common authenticated user from directly invoking record_paddle_webhook_event', async () => {
      const webhookRepo = new WebhookRepository(clientOrg1);
      const uniqueEventId = `evt_paddle_test_${Date.now()}`;

      await expect(
        webhookRepo.recordWebhookEvent({
          provider: 'paddle',
          eventId: uniqueEventId,
          eventType: 'subscription.activated',
          payload: { test: true },
        })
      ).rejects.toThrowError(/(permission denied|access denied)/i);
    });

    it('allows checking webhook idempotency status via security definer check', async () => {
      const webhookRepo = new WebhookRepository(clientOrg1);
      const isProcessed = await webhookRepo.isEventProcessed('evt_test_rpc_1794331045800');
      expect(isProcessed).toBe(true);
    });
  });

  describe('7. SaaS Subscriptions & Quota Database Management', () => {
    it('strictly forbids common authenticated user from elevating subscription via apply_paddle_subscription_update', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);

      await expect(
        subRepo.applySubscriptionUpdate({
          organizationId: org1Id,
          planId: 'business',
          monthlyAnalysesLimit: 9999,
        })
      ).rejects.toThrowError(/(permission denied|access denied)/i);
    });

    it('allows organization member to read their own subscription record from PostgreSQL via RLS', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);
      const sub = await subRepo.getSubscription(org1Id);

      expect(sub).not.toBeNull();
      expect(sub?.organizationId).toBe(org1Id);
      expect(sub?.status).toBe('active');
    });
  });
});
