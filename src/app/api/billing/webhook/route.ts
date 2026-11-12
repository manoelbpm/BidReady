import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPaddleWebhook,
  parsePaddleEvent,
  parseToleranceSeconds,
} from '@/lib/billing/paddle-sandbox';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { emailService } from '@/lib/email';


export async function POST(req: NextRequest) {
  // 1. Maintenance Mode
  if (process.env.BILLING_MAINTENANCE_MODE === 'true') {
    return NextResponse.json(
      { error: 'Billing service is currently undergoing scheduled maintenance' },
      { status: 503, headers: { 'Retry-After': '60' } }
    );
  }

  // 2. Secret Verification
  const secretKey = process.env.PADDLE_WEBHOOK_SECRET || process.env.PADDLE_WEBHOOK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { success: false, error: 'PADDLE_WEBHOOK_SECRET is not configured on the server' },
      { status: 500 }
    );
  }

  // 3. Signature Extraction & Header Check
  const signature = req.headers.get('Paddle-Signature') || req.headers.get('paddle-signature');
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing Paddle-Signature header' }, { status: 400 });
  }

  const rawBody = await req.text();

  // Validate tolerance configuration strictly
  const toleranceCheck = parseToleranceSeconds(process.env.PADDLE_WEBHOOK_TOLERANCE_SECONDS);
  if (!toleranceCheck.valid) {
    return NextResponse.json(
      { success: false, error: `Server misconfigured: invalid PADDLE_WEBHOOK_TOLERANCE_SECONDS (${toleranceCheck.reason})` },
      { status: 500 }
    );
  }

  const verification = verifyPaddleWebhook(rawBody, signature, secretKey, toleranceCheck.seconds);
  if (!verification.valid) {
    if (verification.reason === 'missing_secret' || verification.reason === 'invalid_configuration') {
      return NextResponse.json(
        { success: false, error: `Server configuration error: ${verification.reason}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid webhook signature' },
      { status: 401 }
    );
  }

  // 4. Payload Parsing
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Malformed JSON payload' }, { status: 400 });
  }

  // 5. Acknowledge Generic Test Notifications Safely
  const customData = payload.data?.custom_data || payload.custom_data;
  const isCommercial = customData?.organization_id || customData?.organizationId;
  if (!isCommercial && (!payload.data?.id || payload.data?.id === 'test_sub_no_org' || !payload.occurred_at)) {
    return NextResponse.json(
      {
        received: true,
        isGenericTestEvent: true,
        ignored: true,
        eventId: payload.event_id || 'generic_test_event',
        notes: 'Generic Paddle notification acknowledged without commercial context.',
      },
      { status: 200 }
    );
  }

  const event = parsePaddleEvent(payload);
  if (!event) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook payload: missing required fields, occurred_at timestamp, or unknown price/status' },
      { status: 400 }
    );
  }

  // 6. Atomic PostgreSQL Transactional Execution via Consolidated RPC
  const isScheduledCancel = payload.data?.scheduled_change?.action === 'cancel';
  const gracePeriod = event.status === 'past_due' ? new Date(Date.now() + 86400000 * 7).toISOString() : null;

  const { data: result, error: rpcErr } = await supabaseAdmin.rpc('process_paddle_webhook_transaction', {
    p_provider: 'paddle',
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_payload: payload,
    p_organization_id: event.organizationId || null,
    p_plan: event.plan || null,
    p_status: event.status || null,
    p_provider_sub_id: event.subscriptionId || null,
    p_provider_cust_id: event.customerId || null,
    p_cancel_at_period_end: isScheduledCancel,
    p_analyses_limit: event.monthlyLimit || null,
    p_grace_period_ends_at: gracePeriod,
  });

  if (rpcErr) {
    const errorMsg = rpcErr.message || 'Database error processing webhook transaction';
    await supabaseAdmin.rpc('mark_paddle_webhook_processed', {
      p_event_id: event.eventId,
      p_success: false,
      p_error_message: errorMsg,
    });

    if (errorMsg.includes('CROSS-TENANT COLLISION') || errorMsg.includes('Conflict:')) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }

  if (!result?.success) {
    const errorMsg = result?.error || 'Unknown webhook processing failure';
    await supabaseAdmin.rpc('mark_paddle_webhook_processed', {
      p_event_id: event.eventId,
      p_success: false,
      p_error_message: errorMsg,
    });

    if (
      errorMsg.includes('Conflict:') ||
      errorMsg.includes('CROSS-TENANT COLLISION') ||
      errorMsg.includes('already consumed') ||
      errorMsg.includes('expired') ||
      errorMsg.includes('Unauthorized replacement')
    ) {
      return NextResponse.json({ success: false, error: errorMsg }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
  }

  // 7. Non-Blocking Transactional Confirmation Email (Never blocks webhook acknowledgment)
  if (
    !result.duplicate &&
    ['subscription.created', 'subscription.activated', 'transaction.completed'].includes(event.eventType)
  ) {
    const customerEmail =
      payload.data?.customer?.email ||
      customData?.user_email ||
      customData?.userEmail ||
      'billing-contact@customer.bidready.ai';

    try {
      await emailService.sendTransactionalEmail({
        to: customerEmail,
        eventType: 'payment_receipt',
        idempotencyKey: `payment_receipt:${event.eventId}`,
        organizationId: result.organization_id || event.organizationId || undefined,
        data: {
          organizationName: customData?.organization_name || 'Your Organization',
          planName: (event.plan || 'Starter').toUpperCase(),
          providerSubscriptionId: event.subscriptionId || undefined,
          paddleTransactionId: event.eventId,
        },
      });
    } catch (emailErr) {
      // Safe non-blocking execution: webhook must still return HTTP 200
      console.warn('[Webhook] Non-blocking payment confirmation email failed or skipped:', emailErr);
    }
  }

  // 8. Successful or Duplicate Result
  return NextResponse.json(
    {
      received: true,
      duplicate: Boolean(result.duplicate),
      eventId: event.eventId,
      organizationId: result.organization_id || event.organizationId,
    },
    { status: 200 }
  );
}
