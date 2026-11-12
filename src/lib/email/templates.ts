import {
  EmailEventType,
  WelcomeEmailData,
  AnalysisCompletedEmailData,
  QuotaAlertEmailData,
  PaymentReceiptEmailData,
} from './types';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(
  eventType: EmailEventType,
  data: Record<string, any>
): RenderedEmail {
  const appUrl = (data.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://bidready.com').replace(/\/$/, '');

  switch (eventType) {
    case 'welcome': {
      const d = data as WelcomeEmailData;
      const firstName = d.fullName ? d.fullName.split(' ')[0] : 'there';
      const orgName = d.organizationName || 'your team';

      const subject = `Welcome to BidReady — Your workspace is ready`;
      const text = `Hi ${firstName},

Welcome to BidReady. Your organization workspace (${orgName}) has been provisioned with your complimentary Free Trial (2 monthly tender document analyses).

To get your first compliance matrix in under 3 minutes:
1. Go to your Dashboard: ${appUrl}/dashboard
2. Click "Upload Solicitation" and select any RFP, SOW, or task order PDF.
3. Review your extracted technical requirements, page citations, and compliance matrix.

If you have questions, reply directly to this email or check our documentation at ${appUrl}/support.

Best regards,
The BidReady Team`;

      const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: bold; font-size: 20px; color: #2563eb;">BidReady</span>
    <span style="font-size: 11px; text-transform: uppercase; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px;">GovCon</span>
  </div>
  <p>Hi ${firstName},</p>
  <p>Welcome to BidReady. Your organization workspace (<strong>${orgName}</strong>) has been provisioned with your complimentary Free Trial (2 monthly tender document analyses).</p>
  <p><strong>To generate your first compliance matrix in under 3 minutes:</strong></p>
  <ol style="padding-left: 20px;">
    <li>Open your <a href="${appUrl}/dashboard" style="color: #2563eb;">BidReady Dashboard</a>.</li>
    <li>Upload any federal, state, or enterprise solicitation PDF, DOCX, or XLSX.</li>
    <li>Instantly review extracted requirements, verifiable page citations, and capability gaps.</li>
  </ol>
  <div style="margin: 28px 0;">
    <a href="${appUrl}/upload" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Upload Your First RFP →</a>
  </div>
  <p style="font-size: 13px; color: #64748b;">Questions? Reply to this email or visit our <a href="${appUrl}/support" style="color: #2563eb;">Support Center</a>.</p>
</body>
</html>`;

      return { subject, text, html };
    }

    case 'analysis_completed': {
      const d = data as AnalysisCompletedEmailData;
      const firstName = d.fullName ? d.fullName.split(' ')[0] : 'there';
      const oppTitle = d.opportunityTitle || 'Your Opportunity';
      const total = d.totalRequirements || 0;
      const matched = d.matchedRequirements || 0;
      const gaps = d.gapCount || 0;
      const reviewUrl = `${appUrl}/opportunities/${d.opportunityId || ''}`;

      const subject = `[Ready] Compliance Analysis: ${oppTitle}`;
      const text = `Hi ${firstName},

BidReady has finished analyzing your solicitation: "${oppTitle}".

Summary:
• Extracted Requirements: ${total}
• Direct Page Citations: 100% verified
• Verified Capability Matches: ${matched}
• Compliance Gaps Requiring Review: ${gaps}

Access your interactive compliance checklist and export your matrix here:
${reviewUrl}

Best regards,
The BidReady Team`;

      const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: bold; font-size: 20px; color: #2563eb;">BidReady</span>
  </div>
  <p>Hi ${firstName},</p>
  <p>BidReady has completed parsing and compliance cross-referencing for: <strong>${oppTitle}</strong>.</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Analysis Summary</div>
    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
      <li style="padding: 4px 0;"><strong>Extracted Clauses:</strong> ${total} requirements</li>
      <li style="padding: 4px 0;"><strong>Citations Provenance:</strong> 100% verified with page numbers</li>
      <li style="padding: 4px 0;"><strong>Evidence Matches:</strong> ${matched} matched</li>
      <li style="padding: 4px 0; color: #e11d48;"><strong>Unverified Gaps:</strong> ${gaps} potential gaps</li>
    </ul>
  </div>
  <div style="margin: 28px 0;">
    <a href="${reviewUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">View Compliance Checklist & Export →</a>
  </div>
  <p style="font-size: 13px; color: #64748b;">Review unverified gaps with your technical capture team prior to proposal writing.</p>
</body>
</html>`;

      return { subject, text, html };
    }

    case 'quota_alert': {
      const d = data as QuotaAlertEmailData;
      const firstName = d.fullName ? d.fullName.split(' ')[0] : 'there';
      const remaining = d.remainingAnalyses ?? 0;
      const isExhausted = remaining <= 0;

      const subject = isExhausted
        ? `[Action Required] Monthly Document Analysis Quota Reached — ${d.organizationName}`
        : `[Notice] 1 Document Analysis Remaining in Your Billing Cycle — ${d.organizationName}`;

      const text = `Hi ${firstName},

${
  isExhausted
    ? `Your organization (${d.organizationName}) has used all ${d.analysesLimit} document analyses available on the ${d.planName} plan for this monthly billing cycle.`
    : `Your organization (${d.organizationName}) has 1 document analysis remaining out of ${d.analysesLimit} for this monthly billing cycle.`
}

To continue parsing RFPs and generating compliance matrices without interruption:
Upgrade your plan: ${appUrl}/pricing

Best regards,
The BidReady Operations Team`;

      const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: bold; font-size: 20px; color: #2563eb;">BidReady</span>
  </div>
  <p>Hi ${firstName},</p>
  <div style="background-color: ${isExhausted ? '#fff1f2' : '#fefce8'}; border: 1px solid ${isExhausted ? '#fecdd3' : '#fef08a'}; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <strong style="color: ${isExhausted ? '#be123c' : '#854d0e'}; font-size: 15px;">
      ${isExhausted ? 'Monthly Analysis Quota Limit Reached' : 'Analysis Quota Nearing Limit'}
    </strong>
    <p style="font-size: 13px; margin: 8px 0 0 0; color: #334155;">
      Your organization (<strong>${d.organizationName}</strong>) has used <strong>${d.analysesUsed}/${d.analysesLimit}</strong> analyses on the <strong>${d.planName}</strong> plan.
    </p>
  </div>
  <p>To ensure your bid capture team can continue analyzing solicitations without delay, you can upgrade your plan or add capacity anytime.</p>
  <div style="margin: 28px 0;">
    <a href="${appUrl}/pricing" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Manage Plan & Quota →</a>
  </div>
</body>
</html>`;

      return { subject, text, html };
    }

    case 'payment_receipt': {
      const d = data as PaymentReceiptEmailData;
      const firstName = d.fullName ? d.fullName.split(' ')[0] : 'there';
      const planName = d.planName || 'Starter';
      const portalUrl = `${appUrl}/settings`;

      const subject = `Subscription Confirmation: BidReady ${planName} Plan`;

      const text = `Hi ${firstName},

Your subscription to the BidReady ${planName} plan has been successfully activated for ${d.organizationName}.

Your monthly document analysis quota is updated and available immediately in your dashboard.

IMPORTANT BILLING & TAX INVOICE NOTE:
As our authorized Merchant of Record, Paddle (Paddle.com Market Ltd) handles international order processing and global sales tax / VAT compliance. Paddle has separately emailed your official VAT/Sales Tax invoice and receipt directly.

You can manage your subscription payment method, view invoices, or cancel at any time via your self-service settings:
${portalUrl}

Best regards,
The BidReady Billing Team`;

      const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    <span style="font-weight: bold; font-size: 20px; color: #2563eb;">BidReady</span>
  </div>
  <p>Hi ${firstName},</p>
  <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <strong style="color: #065f46; font-size: 15px;">Subscription Activated: ${planName} Plan</strong>
    <p style="font-size: 13px; margin: 8px 0 0 0; color: #047857;">
      Your updated monthly document analysis quota is now active for <strong>${d.organizationName}</strong>.
    </p>
  </div>
  
  <!-- Merchant of Record & Tax Responsibility Notice -->
  <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 12px 16px; margin: 20px 0; font-size: 12px; color: #475569;">
    <strong>Official Tax Invoice & Receipt Notice:</strong><br/>
    Order processing and sales tax/VAT compliance are administered by our authorized Merchant of Record, <strong>Paddle (Paddle.com Market Ltd)</strong>. Paddle has emailed your official tax invoice and payment receipt directly to your billing contact.
  </div>

  <div style="margin: 28px 0;">
    <a href="${appUrl}/dashboard" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; display: inline-block;">Go to Dashboard →</a>
  </div>
  <p style="font-size: 12px; color: #64748b;">You can update your payment details or view billing history anytime in your <a href="${portalUrl}" style="color: #2563eb;">Account Settings</a>.</p>
</body>
</html>`;

      return { subject, text, html };
    }

    default:
      throw new Error(`Unsupported email event type: ${eventType}`);
  }
}
