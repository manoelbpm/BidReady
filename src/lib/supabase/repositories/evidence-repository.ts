import { SupabaseClient } from '@supabase/supabase-js';
import { Evidence, EvidenceVerificationStatus } from '@/types/models';

export class EvidenceRepository {
  constructor(private client: SupabaseClient) {}

  async listEvidence(
    organizationId: string,
    filters?: {
      category?: string;
      status?: EvidenceVerificationStatus;
    }
  ): Promise<Evidence[]> {
    let query = this.client
      .from('evidences')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (filters?.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters?.status) {
      query = query.eq('verification_status', filters.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Database Error [listEvidence]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as Evidence[];
  }

  async getEvidence(id: string): Promise<Evidence | null> {
    const { data, error } = await this.client
      .from('evidences')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database Error [getEvidence]: ${error.message} (code ${error.code})`);
    }

    return data as Evidence | null;
  }

  async createEvidence(evidence: {
    id?: string;
    organization_id: string;
    title: string;
    category: string;
    description?: string | null;
    issuing_organization?: string | null;
    issue_date?: string | null;
    valid_until?: string | null;
    file_name?: string | null;
    file_storage_path?: string | null;
    verification_status?: EvidenceVerificationStatus;
    tags?: string[];
  }): Promise<Evidence> {
    const { data, error } = await this.client
      .from('evidences')
      .insert({
        ...evidence,
        tags: evidence.tags || [],
        verification_status: evidence.verification_status || 'pending_verification',
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createEvidence]: ${error.message} (code ${error.code})`);
    }

    return data as Evidence;
  }

  async updateEvidence(
    id: string,
    updates: Partial<Evidence>
  ): Promise<Evidence> {
    const { data, error } = await this.client
      .from('evidences')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [updateEvidence]: ${error.message} (code ${error.code})`);
    }

    return data as Evidence;
  }

  async deleteEvidence(id: string): Promise<void> {
    const { error } = await this.client
      .from('evidences')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Database Error [deleteEvidence]: ${error.message} (code ${error.code})`);
    }
  }

  async verifyEvidence(
    id: string,
    verifiedByUserId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<Evidence> {
    return this.updateEvidence(id, {
      verification_status: approved ? 'verified' : 'rejected',
      verified_by_user_id: verifiedByUserId,
      verified_at: new Date().toISOString(),
      rejection_reason: approved ? null : (rejectionReason || 'Rejected by reviewer'),
    });
  }
}
