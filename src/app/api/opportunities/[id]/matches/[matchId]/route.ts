import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/supabase/api-auth';
import { MatchOutcome } from '@/types/models';

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string; matchId: string }> }
) {
  try {
    const { id, matchId } = await segmentData.params;
    const body = await request.json();
    const { verified, matchOutcome, notes } = body;

    const { oppService, organizationId, userId, oppRepo } = await getRequestContext(request);

    const updated = await oppService.updateMatchVerificationAsync(
      matchId,
      organizationId,
      userId,
      {
        verified: Boolean(verified),
        matchOutcome: matchOutcome as MatchOutcome | undefined,
        notes: typeof notes === 'string' ? notes : undefined,
      }
    );

    // Record activity in opportunity audit log
    if (oppRepo) {
      await oppRepo.createActivity({
        organization_id: organizationId,
        opportunity_id: id,
        user_id: userId,
        action: 'HUMAN_VERIFICATION_RECORDED',
        description: `Human verification ${verified ? 'APPROVED' : 'REJECTED/FLAGGED'} for match ${matchId}. Status: ${updated.match_outcome}.`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      match: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update match verification' },
      { status: 500 }
    );
  }
}
