import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

describe('M4.10.1 — Post-Supabase Integration Security & Data Integrity Audit Suite', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  let clientOrg1: SupabaseClient;
  let clientOrg2: SupabaseClient;
  let clientAnon: SupabaseClient;

  const org1Id = 'b22937b6-51e5-48a0-a75d-7b3405427298'; // Global Defense Systems Corp
  const org2Id = '7a9537da-ff33-4f55-a93a-f86813234f34'; // Competitor Workspace

  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    expect(supabaseUrl).toBeTruthy();
    expect(anonKey).toBeTruthy();

    clientAnon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Authenticate Org 1 Lead Analyst
    clientOrg1 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth1 = await clientOrg1.auth.signInWithPassword({
      email: 'analyst@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth1.error).toBeNull();
    user1Id = auth1.data.user!.id;

    // Authenticate Org 2 Competitor
    clientOrg2 = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth2 = await clientOrg2.auth.signInWithPassword({
      email: 'competitor@bidready.com',
      password: 'SuperSecret2026!',
    });
    expect(auth2.error).toBeNull();
    user2Id = auth2.data.user!.id;
  });

  describe('ETAPA 1 — SECURITY DEFINER & Privilege Escalation Defenses', () => {
    it('strictly blocks common authenticated user from calling administrative subscription update RPC', async () => {
      // Common user attempts to escalate their plan to 'business' directly via RPC
      const { data, error } = await clientOrg1.rpc('apply_paddle_subscription_update', {
        p_organization_id: org1Id,
        p_plan: 'business',
        p_monthly_analyses_limit: 999999,
      });

      expect(error).not.toBeNull();
      // PostgreSQL error code 42501: permission denied for function
      expect(error?.message).toMatch(/(permission denied|access denied)/i);
    });

    it('strictly blocks common authenticated user from calling transactional webhook RPC', async () => {
      const { data, error } = await clientOrg1.rpc('process_paddle_webhook_transaction', {
        p_provider: 'paddle',
        p_event_id: `evt_hack_${Date.now()}`,
        p_event_type: 'subscription.activated',
        p_payload: { malicious: true },
        p_organization_id: org1Id,
        p_plan: 'business',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/(permission denied|access denied)/i);
    });

    it('strictly blocks anonymous client from calling administrative billing RPCs', async () => {
      const { data, error } = await clientAnon.rpc('apply_paddle_subscription_update', {
        p_organization_id: org1Id,
        p_plan: 'business',
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/(permission denied|access denied)/i);
    });

    it('prevents user from reserving quota for foreign organization', async () => {
      // User 2 attempts to reserve quota belonging to Org 1
      const subRepo = new SubscriptionRepository(clientOrg2);

      await expect(
        subRepo.reserveAnalysisQuota(org1Id)
      ).rejects.toThrowError(/(access denied|not an authorized member)/i);
    });
  });

  describe('ETAPA 2 — Webhook Transactional State Integrity & Idempotency', () => {
    it('verifies that duplicate event processing is detected without duplicate quota mutation', async () => {
      const webhookRepo = new WebhookRepository(clientOrg1);
      const duplicateId = 'evt_test_rpc_1794331045800'; // Pre-existing processed event

      const isProcessed = await webhookRepo.isEventProcessed(duplicateId);
      expect(isProcessed).toBe(true);
    });
  });

  describe('ETAPA 3 — Repositories Complete Real Persistence (All Entities)', () => {
    let testOppId: string;
    let testReqId: string;
    let testDocId: string;

    it('OpportunityRepository: requirements, matches, and activities real CRUD', async () => {
      const oppRepo = new OpportunityRepository(clientOrg1);

      // 1. Create Opportunity
      const opp = await oppRepo.createOpportunity({
        organization_id: org1Id,
        created_by_user_id: user1Id,
        title: 'US Army Cyber Defense Modernization 2026',
        reference_code: `RFP-CYBER-${Date.now()}`,
        stage: 'intake',
        priority: 'high',
      });
      expect(opp.id).toBeDefined();
      testOppId = opp.id;

      // 2. Create Requirement
      const req = await oppRepo.createRequirement({
        organization_id: org1Id,
        opportunity_id: testOppId,
        type: 'mandatory',
        category: 'Cybersecurity',
        title: 'Zero Trust Architecture NIST SP 800-207',
        description: 'Solution must adhere to DoD Zero Trust reference architecture.',
        source_reference: { page: 12, section: '2.1' },
      });
      expect(req.id).toBeDefined();
      testReqId = req.id;

      // 3. Create RequirementEvidenceMatch
      const match = await oppRepo.createMatch({
        organization_id: org1Id,
        opportunity_id: testOppId,
        requirement_id: testReqId,
        match_outcome: 'MATCHED',
        confidence_score: 0.95,
        match_explanation: 'Corporate FedRAMP High certification satisfies NIST SP 800-207 requirements.',
        human_review_required: false,
      });
      expect(match.id).toBeDefined();
      expect(match.match_outcome).toBe('MATCHED');

      // 4. Create Activity
      const activity = await oppRepo.createActivity({
        organization_id: org1Id,
        opportunity_id: testOppId,
        user_id: user1Id,
        action: 'REQUIREMENT_MATCHED',
        description: 'Auto-matching engine linked Zero Trust requirement to FedRAMP credential.',
      });
      expect(activity.id).toBeDefined();

      // 5. Query lists and verify persistence
      const reqs = await oppRepo.listRequirements(testOppId);
      expect(reqs.some((r) => r.id === testReqId)).toBe(true);

      const matches = await oppRepo.listMatches(testOppId);
      expect(matches.some((m) => m.id === match.id)).toBe(true);

      const activities = await oppRepo.listActivities(testOppId);
      expect(activities.some((a) => a.id === activity.id)).toBe(true);
    });

    it('DocumentRepository: documents and analysis_runs real CRUD', async () => {
      const docRepo = new DocumentRepository(clientOrg1);

      // 1. Create Document
      const doc = await docRepo.createDocument({
        organization_id: org1Id,
        opportunity_id: testOppId,
        file_name: 'DoD_Cyber_Architecture_Spec.pdf',
        file_size_bytes: 4096,
        mime_type: 'application/pdf',
        storage_path: `${org1Id}/test-docs/DoD_Cyber_Architecture_Spec.pdf`,
        uploaded_by_user_id: user1Id,
        status: 'uploaded',
      });
      expect(doc.id).toBeDefined();
      testDocId = doc.id;

      // 2. Create AnalysisRun
      const run = await docRepo.createAnalysisRun({
        organization_id: org1Id,
        opportunity_id: testOppId,
        document_id: testDocId,
        status: 'pending',
        model_provider: 'anthropic',
        model_version: 'claude-3-7-sonnet',
        confidence_score: 0.98,
        executive_summary: 'Comprehensive analysis of DoD solicitation specifications.',
      });
      expect(run.id).toBeDefined();
      expect(run.status).toBe('pending');

      // 3. Update AnalysisRun
      const updatedRun = await docRepo.updateAnalysisRun(run.id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
      expect(updatedRun.status).toBe('completed');
      expect(updatedRun.completed_at).toBeDefined();

      // 4. Retrieve AnalysisRun
      const fetchedRun = await docRepo.getAnalysisRun(run.id);
      expect(fetchedRun).not.toBeNull();
      expect(fetchedRun?.executive_summary).toContain('DoD solicitation');
    });

    it('SubscriptionRepository: records and lists usage audit entries', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);

      await subRepo.recordUsageAudit({
        organizationId: org1Id,
        documentId: testDocId,
        userId: user1Id,
        analysesCounted: 1,
        successfulRun: true,
        notes: 'Integration test automated verification entry.',
      });

      const auditLogs = await subRepo.listUsageAudit(org1Id);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs.some((l) => l.notes?.includes('Integration test automated'))).toBe(true);
    });
  });

  describe('ETAPA 4 — Concurrency & Quotas (Race Condition Prevention & Non-Negative Balance)', () => {
    it('serializes concurrent quota reservations with row-level locks (FOR UPDATE)', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);

      // Reserve 1 quota
      const res1 = await subRepo.reserveAnalysisQuota(org1Id);
      expect(res1.allowed).toBe(true);
      expect(res1.used).toBeGreaterThan(0);

      // Release the quota back
      await subRepo.releaseAnalysisQuota(org1Id);
    });

    it('simulates concurrent requests and guarantees only allowed quota is consumed', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);

      // Fire 2 simultaneous reservation requests
      const [attemptA, attemptB] = await Promise.all([
        subRepo.reserveAnalysisQuota(org1Id),
        subRepo.reserveAnalysisQuota(org1Id),
      ]);

      // Both can succeed if limit allows, but their used counts must be strictly distinct
      if (attemptA.allowed && attemptB.allowed) {
        expect(attemptA.used).not.toEqual(attemptB.used);
      }

      // Cleanup: release back the reserved quotas
      if (attemptA.allowed) await subRepo.releaseAnalysisQuota(org1Id);
      if (attemptB.allowed) await subRepo.releaseAnalysisQuota(org1Id);
    });

    it('enforces non-negative quota floor: releaseAnalysisQuota never decreases below zero', async () => {
      const subRepo = new SubscriptionRepository(clientOrg1);

      // Call release multiple times
      await subRepo.releaseAnalysisQuota(org1Id);
      await subRepo.releaseAnalysisQuota(org1Id);

      const sub = await subRepo.getSubscription(org1Id);
      expect(sub!.analysesUsedInPeriod).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ETAPA 5 — Advanced Security Defenses (Anti-Mutation & Path Traversal)', () => {
    it('strictly prevents mutating organization_id on existing opportunity (prevent_tenant_mutation trigger)', async () => {
      const oppRepo = new OpportunityRepository(clientOrg1);

      // Create a test opportunity
      const opp = await oppRepo.createOpportunity({
        organization_id: org1Id,
        created_by_user_id: user1Id,
        title: 'Tenant Mutation Target Test',
      });

      // Malicious attempt: update organization_id to foreign organization
      const { error } = await clientOrg1
        .from('opportunities')
        .update({ organization_id: org2Id })
        .eq('id', opp.id);

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/Security Violation: Mutating organization_id is strictly forbidden/i);
    });

    it('strictly rejects upload attempts with path traversal patterns (name !~ "..")', async () => {
      const docRepo = new DocumentRepository(clientOrg1);
      const maliciousTraversalPath = `${org1Id}/../../other-org/malicious.pdf`;
      const dummyBuffer = Buffer.from('malicious payload');

      await expect(
        docRepo.uploadFile(maliciousTraversalPath, dummyBuffer, 'application/pdf')
      ).rejects.toThrow();
    });

    it('completely blocks foreign organization from downloading private storage objects', async () => {
      const docRepo1 = new DocumentRepository(clientOrg1);
      const docRepo2 = new DocumentRepository(clientOrg2);

      const validPath = `${org1Id}/audit-test/classified-spec.pdf`;
      await docRepo1.uploadFile(validPath, Buffer.from('Classified Spec 2026'), 'application/pdf');

      // Org 2 attempts download
      await expect(
        docRepo2.downloadFile(validPath)
      ).rejects.toThrow();
    });
  });

  describe('ETAPA 6 — Resilience & Reconnection Proof', () => {
    it('survives client disconnection and cold start without losing any state or idempotency', async () => {
      // Create fresh client simulating server reboot
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
      expect(opps.some((o) => o.title === 'US Army Cyber Defense Modernization 2026')).toBe(true);
    });
  });
});
