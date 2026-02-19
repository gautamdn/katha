import { supabase } from './supabase';
import type { Profile, Family } from '@shared/types';
import type { UserRole } from '@shared/types';

// ─── Auth ───────────────────────────────────────────────

export async function signUp(params: {
  email: string;
  password: string;
  display_name: string;
  role: 'guardian' | 'writer';
}) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        display_name: params.display_name,
        role: params.role,
      },
    },
  });
}

export async function signIn(params: { email: string; password: string }) {
  return supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// ─── Profile ────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    // Profile may not exist yet (trigger race condition) — retry once
    if (error.code === 'PGRST116') {
      await new Promise((r) => setTimeout(r, 500));
      const retry = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return (retry.data as Profile) ?? null;
    }
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'family_id' | 'relationship_label' | 'display_name' | 'bio' | 'avatar_url'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

// ─── Family ─────────────────────────────────────────────

export async function createFamily(params: {
  name: string;
  userId: string;
}): Promise<Family> {
  const { data: family, error } = await supabase
    .from('families')
    .insert({ name: params.name, created_by: params.userId })
    .select()
    .single();

  if (error) throw error;

  // Link the creator's profile to the new family
  await updateProfile(params.userId, { family_id: family.id });

  return family as Family;
}

export async function joinFamily(params: {
  inviteCode: string;
  userId: string;
  relationshipLabel?: string;
}): Promise<Family> {
  // Use SECURITY DEFINER RPC to look up family by invite code
  const { data, error } = await supabase.rpc('lookup_family_by_invite_code', {
    code: params.inviteCode,
  });

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('INVALID_INVITE_CODE');
  }

  const family = data[0] as { id: string; name: string };

  // Link the user's profile to this family
  await updateProfile(params.userId, {
    family_id: family.id,
    relationship_label: params.relationshipLabel,
  });

  return family as Family;
}
