import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/api-auth';
import { supabaseAdmin, isServiceRoleConfigured } from '@/lib/supabase/admin';

/**
 * Reconciles a pending or interrupted quota reservation based on actual matching state.
 * Never recovers based on age alone; verifies matching outcome or caller signal.
 */
export async function reconcileQuotaReservation(
  reservationId: string,
  organizationId: string,
  matchingSucceeded?: boolean
) {
  if (!isServiceRoleConfigured()) {
    return { success: false, error: 'Service role is not configured' };
  }

  const { data, error } = await supabaseAdmin.rpc('reconcile_quota_reservation', {
    p_reservation_id: reservationId,
    p_organization_id: organizationId,
    p_matching_succeeded: matchingSucceeded ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data;
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const { oppService, organizationId, userId, oppRepo, client } = await getRequestContext(request);

    // 1. Strict Identity Binding: authenticated user cannot be spoofed by x-user-id header
    let validatedUserId = userId;
    if (client) {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or expired authentication credentials.' },
          { status: 401 }
        );
      }
      validatedUserId = user.id;

      // 2. Organization Membership Validation: verify active membership in organization_members
      const { data: membership, error: memErr } = await client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', validatedUserId)
        .maybeSingle();

      if (memErr || !membership) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: User is not an authorized member of the organization.' },
          { status: 403 }
        );
      }
    }

    // 3. Strict Opportunity & Tenant Validation: opportunity must strictly belong to organization
    const opportunity = await oppService.getOpportunityAsync(id, organizationId);
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: `Opportunity "${id}" not found.` },
        { status: 404 }
      );
    }

    if (opportunity.organization_id !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Opportunity belongs to a different tenant.' },
        { status: 403 }
      );
    }

    // 4. Quota Enforcement: reserve quota atomically before running matching engine
    // p_user_id and p_organization_id are strictly bound to validated session
    let reservationId: string | null = null;
    if (isServiceRoleConfigured()) {
      const { data: quotaRes, error: quotaErr } = await supabaseAdmin.rpc('reserve_analysis_quota', {
        p_organization_id: organizationId,
        p_user_id: validatedUserId,
        p_opportunity_id: id,
      });

      if (quotaErr || !quotaRes?.allowed) {
        const errorReason =
          quotaRes?.reason ||
          quotaErr?.message ||
          'Monthly analysis quota limit reached or subscription inactive';
        return NextResponse.json(
          { success: false, error: errorReason },
          { status: 402 }
        );
      }
      reservationId = quotaRes.reservation_id;
    }

    // 5. Execute matching engine with automatic compensation on failure
    let matchesResult: { matches: any[]; readiness: any };
    try {
      matchesResult = await oppService.runMatchingAsync(id, organizationId);
    } catch (engineErr: any) {
      // Automatic compensation: refund reserved quota once on engine failure
      if (reservationId && isServiceRoleConfigured()) {
        try {
          await supabaseAdmin.rpc('release_analysis_quota', {
            p_reservation_id: reservationId,
            p_organization_id: organizationId,
          });
        } catch (compErr) {
          // If compensation fails temporarily, reservation remains 'reserved' for subsequent reconciliation
          console.error('[QuotaCompensation] Temporary release error:', compErr);
        }
      }
      throw engineErr;
    }

    // 6. Mark reservation consumed on successful execution
    if (reservationId && isServiceRoleConfigured()) {
      try {
        await supabaseAdmin.rpc('consume_analysis_quota', {
          p_reservation_id: reservationId,
          p_organization_id: organizationId,
        });
      } catch (consumeErr) {
        // Confirmation failed over network: reservation is preserved for subsequent reconciliation
        console.error('[QuotaConsumption] Temporary consume error:', consumeErr);
      }
    }

    const { matches, readiness } = matchesResult;

    // Record activity in audit log
    if (oppRepo) {
      await oppRepo.createActivity({
        organization_id: organizationId,
        opportunity_id: id,
        user_id: validatedUserId,
        action: 'MATCHING_ENGINE_EXECUTED',
        description: `Executed Evidence Matching Engine: ${matches.length} requirements matched against organization evidence library. Readiness: ${readiness.readiness_stage}.`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      opportunityId: id,
      matches,
      readiness,
    });
  } catch (err: any) {
    const isSecurity = err.message?.includes('Cross-tenant');
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute matching engine' },
      { status: isSecurity ? 403 : 500 }
    );
  }
}

