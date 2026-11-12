import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { oppService, organizationId } = await getRequestContext(request);
    const opportunities = await oppService.listOpportunitiesAsync(organizationId);

    return NextResponse.json({
      success: true,
      organizationId,
      opportunities,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list opportunities' },
      { status: 500 }
    );
  }
}
