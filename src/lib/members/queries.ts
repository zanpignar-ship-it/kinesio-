import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';

export async function listMembers(organizationId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('organization_members', { p_org: organizationId });
  return data ?? [];
}

/** Open invitations (RLS: owners only, others get an empty list). */
export async function listInvitations(organizationId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at')
    .eq('organization_id', organizationId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  return data ?? [];
}

export type InvitationInfo = { organization: string; role: 'owner' | 'member'; email: string; email_matches: boolean; already_member: boolean };

export async function invitationInfo(token: string): Promise<InvitationInfo | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc('invitation_info', { p_token: token });
  return (data as unknown as InvitationInfo | null) ?? null;
}
