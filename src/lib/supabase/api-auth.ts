import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { OpportunityRepository } from './repositories/opportunity-repository';
import { EvidenceRepository } from './repositories/evidence-repository';
import { OpportunityService } from '@/lib/opportunities/service';

export interface AuthenticatedRequestContext {
  client: SupabaseClient | null;
  userId: string;
  organizationId: string;
  oppRepo: OpportunityRepository | null;
  evidenceRepo: EvidenceRepository | null;
  oppService: OpportunityService;
}

export async function getRequestContext(
  request: NextRequest,
  overrideOrgId?: string,
  overrideUserId?: string
): Promise<AuthenticatedRequestContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get('authorization');
  const orgHeader = request.headers.get('x-organization-id');
  const userHeader = request.headers.get('x-user-id');

  let client: SupabaseClient | null = null;
  let userId = overrideUserId || userHeader || 'f8936e3d-49d9-4c64-8941-888c76b53f66';
  let organizationId = overrideOrgId || orgHeader || 'b22937b6-51e5-48a0-a75d-7b3405427298';

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    // 1. Bearer Token in Authorization header
    if (authHeader) {
      client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
      try {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch {}
    } else {
      // 2. Cookie session
      try {
        const serverClient = await createServerClient();
        const {
          data: { session },
        } = await serverClient.auth.getSession();
        if (session?.access_token) {
          client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${session.access_token}` } },
          });
          userId = session.user.id;
        }
      } catch {
        // Not in cookie browser context
      }
    }

    if (client) {
      // Fetch organization from profiles if available
      try {
        const { data: profile } = await client
          .from('profiles')
          .select('organization_id')
          .eq('id', userId)
          .maybeSingle();

        if (profile?.organization_id) {
          organizationId = profile.organization_id;
        }
      } catch {
        // fallback
      }

      const oppRepo = new OpportunityRepository(client);
      const evidenceRepo = new EvidenceRepository(client);
      const oppService = new OpportunityService(undefined, oppRepo, evidenceRepo);

      return {
        client,
        userId,
        organizationId,
        oppRepo,
        evidenceRepo,
        oppService,
      };
    }
  }

  // Fallback in-memory
  const oppService = new OpportunityService();
  return {
    client: null,
    userId: userId || 'user-1',
    organizationId: organizationId || 'org-1',
    oppRepo: null,
    evidenceRepo: null,
    oppService,
  };
}
