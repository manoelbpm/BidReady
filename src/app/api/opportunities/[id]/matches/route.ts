import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/api-auth';

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await segmentData.params;
    const { oppService, organizationId } = await getRequestContext(request);

    const opportunity = await oppService.getOpportunityAsync(id, organizationId);
    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: `Opportunity "${id}" not found or unauthorized.` },
        { status: 404 }
      );
    }

    const requirements = await oppService.listRequirementsAsync(id, organizationId);
    const matches = await oppService.listMatchesAsync(id, organizationId);
    const readiness = await oppService.getReadinessOverviewAsync(id, organizationId);

    return NextResponse.json({
      success: true,
      opportunity,
      requirements,
      matches,
      readiness,
    });
  } catch (err: any) {
    const isSecurity = err.message?.includes('Cross-tenant');
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve opportunity matches' },
      { status: isSecurity ? 403 : 500 }
    );
  }
}
