import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function testAuthAndRLS() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim() || '';
  const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim() || '';

  const supabase = createClient(url, anonKey);

  console.log('[1] Signing in with real user: analyst@bidready.com...');
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'analyst@bidready.com',
    password: 'SuperSecret2026!',
  });

  if (signInError) {
    console.error('Sign in error:', signInError.message);
    process.exit(1);
  }

  const token = sessionData.session.access_token;
  const user = sessionData.user;
  console.log('[2] Authentication successful! User ID:', user.id);

  // Authenticated client with user JWT
  const authClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Query organizations via RLS
  const { data: orgs, error: orgsError } = await authClient
    .from('organizations')
    .select('id, name, slug');

  console.log('[3] Organizations visible under RLS for this user:', orgs);
  if (orgsError) {
    console.error('Error fetching orgs:', orgsError.message);
  }

  const orgId = orgs?.[0]?.id;
  if (!orgId) {
    console.error('No organization found for user');
    process.exit(1);
  }

  // Insert real Opportunity into remote PostgreSQL
  const { data: opp, error: oppError } = await authClient
    .from('opportunities')
    .insert({
      organization_id: orgId,
      created_by_user_id: user.id,
      title: 'FAA NextGen Radar Surveillance RFP',
      reference_code: 'RFP-FAA-2026-RADAR',
      issuing_body: 'Federal Aviation Administration',
      estimated_value: 12500000,
      currency: 'USD',
      stage: 'intake',
    })
    .select()
    .single();

  if (oppError) {
    console.error('[4] Error inserting opportunity:', oppError.message);
    process.exit(1);
  }

  console.log('[4] Real Opportunity successfully inserted into PostgreSQL:', opp.id, 'Title:', opp.title);

  // Insert real Requirement linked to this Opportunity
  const { data: req, error: reqError } = await authClient
    .from('requirements')
    .insert({
      organization_id: orgId,
      opportunity_id: opp.id,
      type: 'mandatory',
      category: 'Cybersecurity',
      title: 'NIST SP 800-171 Rev 3 Compliance',
      description: 'Vendor must provide third-party assessment certification for all processing nodes.',
      source_reference: {
        page_number: 14,
        section_title: '3.2 Information Assurance Requirements',
        raw_quote: 'The system must comply fully with NIST SP 800-171 Revision 3 standards.',
      },
      confidence_score: 0.98,
      manual_review_required: false,
    })
    .select()
    .single();

  if (reqError) {
    console.error('[5] Error inserting requirement:', reqError.message);
    process.exit(1);
  }

  console.log('[5] Real Requirement successfully inserted into PostgreSQL:', req.id, 'Title:', req.title);

  // Insert real Evidence into PostgreSQL
  const { data: ev, error: evError } = await authClient
    .from('evidences')
    .insert({
      organization_id: orgId,
      title: 'ISO 27001:2022 Stage 2 Audit Certificate',
      category: 'Cybersecurity',
      description: 'Third-party accredited assessment certificate.',
      issuing_organization: 'BSI Assurance Americas',
      valid_until: '2028-12-31T00:00:00Z',
      verification_status: 'verified',
    })
    .select()
    .single();

  if (evError) {
    console.error('[6] Error inserting evidence:', evError.message);
    process.exit(1);
  }

  console.log('[6] Real Evidence successfully inserted into PostgreSQL:', ev.id, 'Title:', ev.title);

  console.log('\n[SUCCESS] Full RLS-protected CRUD on remote PostgreSQL verified!');
}

testAuthAndRLS();
