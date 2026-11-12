import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DocumentProcessingService } from '@/lib/documents/service';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { DocumentRepository } from '@/lib/supabase/repositories/document-repository';
import { SubscriptionRepository } from '@/lib/supabase/repositories/subscription-repository';
import { OpportunityRepository } from '@/lib/supabase/repositories/opportunity-repository';
import { getAIProvider } from '@/lib/ai/factory';

let fallbackService: DocumentProcessingService | null = null;

async function getService(
  request: NextRequest,
  providerName?: string
): Promise<DocumentProcessingService> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authHeader = request.headers.get('authorization');
  const aiProvider = getAIProvider(providerName);

  if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
    // 1. If explicit Authorization header with bearer token is supplied
    if (authHeader) {
      const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
      const docRepo = new DocumentRepository(client);
      const subRepo = new SubscriptionRepository(client);
      const oppRepo = new OpportunityRepository(client);
      return new DocumentProcessingService(aiProvider, undefined, docRepo, subRepo, oppRepo);
    }

    // 2. Try server client from cookies if in Next.js browser context
    try {
      const serverClient = await createServerClient();
      const {
        data: { session },
      } = await serverClient.auth.getSession();
      if (session?.access_token) {
        const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${session.access_token}` } },
        });
        const docRepo = new DocumentRepository(client);
        const subRepo = new SubscriptionRepository(client);
        const oppRepo = new OpportunityRepository(client);
        return new DocumentProcessingService(aiProvider, undefined, docRepo, subRepo, oppRepo);
      }
    } catch {
      // not in browser context
    }
  }

  // 3. Fallback to in-memory DocumentProcessingService
  if (!fallbackService) {
    fallbackService = new DocumentProcessingService(aiProvider);
  }
  return fallbackService;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';
    const referenceCode = (formData.get('referenceCode') as string) || '';
    const buyerName = (formData.get('buyerName') as string) || '';
    const organizationId = (formData.get('organizationId') as string) || 'org-1';
    const userId = (formData.get('userId') as string) || 'user-1';
    const providerParam =
      request.headers.get('x-ai-provider') ||
      (formData.get('aiProvider') as string) ||
      undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded. Please attach a PDF, DOCX, or XLSX document.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const documentId = crypto.randomUUID();

    const service = await getService(request, providerParam);

    const record = await service.ingestAndProcessDocument({
      documentId,
      organizationId,
      userId,
      fileName: file.name,
      fileBuffer: buffer,
      opportunityTitle: title || file.name,
      referenceCode,
      buyerName,
    });

    if (record.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          status: record.status,
          error: record.failureReason,
          requiresOcr: record.requiresOcr,
          record,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      status: record.status,
      documentId: record.id,
      opportunityId: record.opportunityId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      checksumSha256: record.checksumSha256,
      parsedSummary: record.parsedSummary,
      extractionResult: record.extractionResult,
    });
  } catch (err: any) {
    const isBillingError =
      err?.message?.includes('Billing Quota Exceeded') ||
      err?.message?.includes('Analysis quota limit reached');

    return NextResponse.json(
      {
        success: false,
        isQuotaExceeded: isBillingError,
        error: isBillingError ? err.message : `Upload Processing Error: ${err?.message || 'Server error'}`,
      },
      { status: isBillingError ? 403 : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const organizationId = searchParams.get('organizationId');
    const providerParam = request.headers.get('x-ai-provider') || undefined;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Query parameter "organizationId" is required.' },
        { status: 400 }
      );
    }

    const service = await getService(request, providerParam);

    // 1. Single Document Retrieval with Traceability and Multi-tenant Verification
    if (documentId) {
      try {
        const doc = await service.getDocumentAsync(documentId, organizationId);
        if (!doc) {
          return NextResponse.json(
            { success: false, error: `Document "${documentId}" not found.` },
            { status: 404 }
          );
        }

        const isDbEntity = 'file_name' in doc;
        const normalizedDoc = {
          id: doc.id,
          organizationId: isDbEntity ? (doc as any).organization_id : (doc as any).organizationId,
          opportunityId: isDbEntity ? (doc as any).opportunity_id : (doc as any).opportunityId,
          fileName: isDbEntity ? (doc as any).file_name : (doc as any).fileName,
          fileSizeBytes: isDbEntity ? (doc as any).file_size_bytes : (doc as any).fileSizeBytes,
          mimeType: isDbEntity ? (doc as any).mime_type : (doc as any).mimeType,
          status: doc.status,
          checksumSha256: isDbEntity ? (doc as any).checksum_sha256 : (doc as any).checksumSha256,
          createdAt: isDbEntity ? (doc as any).created_at : (doc as any).createdAt,
          updatedAt: isDbEntity ? (doc as any).updated_at : (doc as any).updatedAt,
          parsedSummary: (doc as any).parsedSummary,
          extractionResult: (doc as any).extractionResult,
        };

        let requirements: any[] = [];
        let analysisRun: any = null;
        let opportunity: any = null;

        if (normalizedDoc.opportunityId) {
          try {
            const oppRepo = (service as any).opportunityRepository;
            const docRepo = (service as any).documentRepository;
            if (oppRepo) {
              requirements = await oppRepo.listRequirements(normalizedDoc.opportunityId);
              opportunity = await oppRepo.getOpportunity(normalizedDoc.opportunityId);
            }
            if (docRepo) {
              const runs = await docRepo.listAnalysisRuns(normalizedDoc.opportunityId);
              analysisRun = runs && runs.length > 0 ? runs[0] : null;
            }
          } catch {
            // Non-blocking enrichment
          }
        }

        return NextResponse.json({
          success: true,
          document: normalizedDoc,
          opportunity,
          analysisRun,
          requirements,
          extractionResult: normalizedDoc.extractionResult || null,
        });
      } catch (secErr: any) {
        if (secErr.message?.includes('Security Violation: Cross-tenant access denied')) {
          return NextResponse.json(
            { success: false, error: secErr.message },
            { status: 403 }
          );
        }
        throw secErr;
      }
    }

    // 2. Organization Document Listing
    const docs = await service.listDocumentsAsync(organizationId);
    return NextResponse.json({
      success: true,
      organizationId,
      documents: docs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error while retrieving documents.' },
      { status: 500 }
    );
  }
}
