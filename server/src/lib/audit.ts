import { supabase } from './supabase.js';

export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await supabase.from('audit_logs').insert({
    actor_id: params.actorId ?? null,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? null,
    ip_address: params.ip ?? null,
  });
}

export async function notify(params: {
  userId: string;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    channel: 'in_app',
    link: params.link ?? null,
  });
}
