import { SupabaseClient } from '@supabase/supabase-js';

export interface DocumentEntity {
  id: string;
  organization_id: string;
  opportunity_id?: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  checksum_sha256?: string | null;
  status: string;
  uploaded_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisRunEntity {
  id: string;
  organization_id: string;
  opportunity_id: string;
  document_id: string;
  status: string;
  model_provider: string;
  model_version: string;
  confidence_score?: number | null;
  executive_summary?: string | null;
  human_review_notes?: string | null;
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
}

function normalizeDocumentStatus(status?: string): string {
  if (!status) return 'uploaded';
  const s = status.toLowerCase();
  if (['validating', 'parsing', 'extracting', 'processing'].includes(s)) return 'processing';
  if (['completed', 'review_required', 'ready'].includes(s)) return 'ready';
  if (s === 'failed') return 'failed';
  return 'uploaded';
}

function normalizeAnalysisStatus(status?: string): string {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (['pending', 'extracting', 'analyzing', 'completed', 'failed'].includes(s)) return s;
  if (['review_required', 'ready'].includes(s)) return 'completed';
  return 'analyzing';
}

export class DocumentRepository {
  private bucketName = 'tender-documents';

  constructor(private client: SupabaseClient) {}

  async listDocuments(organizationId: string): Promise<DocumentEntity[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listDocuments]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as DocumentEntity[];
  }

  async getDocument(id: string): Promise<DocumentEntity | null> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database Error [getDocument]: ${error.message} (code ${error.code})`);
    }

    return data as DocumentEntity | null;
  }

  async createDocument(doc: {
    id?: string;
    organization_id: string;
    opportunity_id?: string | null;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    storage_path: string;
    checksum_sha256?: string | null;
    status?: string;
    uploaded_by_user_id: string;
  }): Promise<DocumentEntity> {
    const normalizedStatus = normalizeDocumentStatus(doc.status);
    const { data, error } = await this.client
      .from('documents')
      .insert({
        ...doc,
        status: normalizedStatus,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createDocument]: ${error.message} (code ${error.code})`);
    }

    return data as DocumentEntity;
  }

  async updateDocument(
    id: string,
    updates: Partial<DocumentEntity>
  ): Promise<DocumentEntity> {
    const payload = { ...updates };
    if (payload.status) {
      payload.status = normalizeDocumentStatus(payload.status);
    }
    const { data, error } = await this.client
      .from('documents')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [updateDocument]: ${error.message} (code ${error.code})`);
    }

    return data as DocumentEntity;
  }

  async createAnalysisRun(run: {
    id?: string;
    organization_id: string;
    opportunity_id: string;
    document_id: string;
    status?: string;
    model_provider: string;
    model_version: string;
    confidence_score?: number | null;
    executive_summary?: string | null;
    started_at?: string;
  }): Promise<AnalysisRunEntity> {
    const normalizedStatus = normalizeAnalysisStatus(run.status);
    const { data, error } = await this.client
      .from('analysis_runs')
      .insert({
        ...run,
        status: normalizedStatus,
        started_at: run.started_at || new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createAnalysisRun]: ${error.message} (code ${error.code})`);
    }

    return data as AnalysisRunEntity;
  }

  async updateAnalysisRun(
    id: string,
    updates: Partial<AnalysisRunEntity>
  ): Promise<AnalysisRunEntity> {
    const payload = { ...updates };
    if (payload.status) {
      payload.status = normalizeAnalysisStatus(payload.status);
    }
    const { data, error } = await this.client
      .from('analysis_runs')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [updateAnalysisRun]: ${error.message} (code ${error.code})`);
    }

    return data as AnalysisRunEntity;
  }

  async getAnalysisRun(id: string): Promise<AnalysisRunEntity | null> {
    const { data, error } = await this.client
      .from('analysis_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database Error [getAnalysisRun]: ${error.message} (code ${error.code})`);
    }

    return data as AnalysisRunEntity | null;
  }

  async listAnalysisRuns(opportunityId: string): Promise<AnalysisRunEntity[]> {
    const { data, error } = await this.client
      .from('analysis_runs')
      .select('*')
      .eq('opportunity_id', opportunityId)
      .order('started_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listAnalysisRuns]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as AnalysisRunEntity[];
  }

  // --- Supabase Private Storage Methods ---

  async uploadFile(
    storagePath: string,
    fileBuffer: Buffer | Uint8Array,
    contentType: string
  ): Promise<{ path: string }> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Storage Error [uploadFile]: ${error.message}`);
    }

    return { path: data.path };
  }

  async downloadFile(storagePath: string): Promise<Blob> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .download(storagePath);

    if (error) {
      throw new Error(`Storage Error [downloadFile]: ${error.message}`);
    }

    return data;
  }

  async createSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      throw new Error(`Storage Error [createSignedUrl]: ${error.message}`);
    }

    return data.signedUrl;
  }
}
