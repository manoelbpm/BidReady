import { SupabaseClient } from '@supabase/supabase-js';
import { InternalNotification, NotificationType } from '@/types/models';

export class NotificationRepository {
  constructor(private client: SupabaseClient) {}

  async listNotifications(organizationId: string): Promise<InternalNotification[]> {
    const { data, error } = await this.client
      .from('internal_notifications')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database Error [listNotifications]: ${error.message} (code ${error.code})`);
    }

    return (data || []) as InternalNotification[];
  }

  async createNotification(notification: {
    id?: string;
    organization_id: string;
    user_id?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    link_url?: string | null;
    is_read?: boolean;
  }): Promise<InternalNotification> {
    const { data, error } = await this.client
      .from('internal_notifications')
      .insert({
        ...notification,
        severity: notification.severity || 'info',
        is_read: notification.is_read || false,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [createNotification]: ${error.message} (code ${error.code})`);
    }

    return data as InternalNotification;
  }

  async markAsRead(id: string): Promise<InternalNotification> {
    const { data, error } = await this.client
      .from('internal_notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database Error [markAsRead]: ${error.message} (code ${error.code})`);
    }

    return data as InternalNotification;
  }

  async markAllAsRead(organizationId: string): Promise<void> {
    const { error } = await this.client
      .from('internal_notifications')
      .update({ is_read: true })
      .eq('organization_id', organizationId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Database Error [markAllAsRead]: ${error.message} (code ${error.code})`);
    }
  }
}
