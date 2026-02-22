import { supabase } from './supabase';
import type {
  Profile,
  Family,
  Child,
  Capsule,
  CapsuleWithWriter,
  AIPolishResult,
  AIMetadataResult,
  AIPrompt,
  UnlockType,
} from '@shared/types';

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

export async function getFamily(familyId: string): Promise<Family> {
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('id', familyId)
    .single();

  if (error) throw error;
  return data as Family;
}

export async function getFamilyMembers(familyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');

  if (error) throw error;
  return data as Profile[];
}

// ─── Children ──────────────────────────────────────────

export async function getChildren(familyId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');

  if (error) throw error;
  return data as Child[];
}

export async function createChild(params: {
  familyId: string;
  name: string;
  dateOfBirth: string;
}): Promise<Child> {
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: params.familyId,
      name: params.name,
      date_of_birth: params.dateOfBirth,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Child;
}

// ─── Capsules ──────────────────────────────────────────

export async function getFamilyCapsules(
  familyId: string,
  options?: { limit?: number; offset?: number },
): Promise<CapsuleWithWriter[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase
    .from('capsules')
    .select(
      `*, writer:profiles!writer_id(display_name, avatar_url, relationship_label), recipient:children!child_id(name)`,
    )
    .eq('family_id', familyId)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data ?? []).map((c: any) => ({
    ...c,
    photos: [],
    reactions: [],
  })) as CapsuleWithWriter[];
}

export async function getWriterCapsules(writerId: string): Promise<Capsule[]> {
  const { data, error } = await supabase
    .from('capsules')
    .select('*')
    .eq('writer_id', writerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Capsule[];
}

export async function getCapsule(
  capsuleId: string,
): Promise<CapsuleWithWriter> {
  const { data, error } = await supabase
    .from('capsules')
    .select(
      `*, writer:profiles!writer_id(display_name, avatar_url, relationship_label), recipient:children!child_id(name)`,
    )
    .eq('id', capsuleId)
    .single();

  if (error) throw error;

  return { ...data, photos: [], reactions: [] } as CapsuleWithWriter;
}

export async function createCapsule(params: {
  writerId: string;
  familyId: string;
  rawText: string;
  childId?: string | null;
  unlockType?: UnlockType;
  unlockDate?: string | null;
  unlockAge?: number | null;
  unlockMilestone?: string | null;
  isSurprise?: boolean;
}): Promise<Capsule> {
  const { data, error } = await supabase
    .from('capsules')
    .insert({
      writer_id: params.writerId,
      family_id: params.familyId,
      raw_text: params.rawText,
      child_id: params.childId ?? null,
      is_draft: true,
      unlock_type: params.unlockType ?? 'immediate',
      unlock_date: params.unlockDate ?? null,
      unlock_age: params.unlockAge ?? null,
      unlock_milestone: params.unlockMilestone ?? null,
      is_surprise: params.isSurprise ?? false,
      is_unlocked: false,
      is_private: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Capsule;
}

export async function updateCapsule(
  capsuleId: string,
  updates: Partial<
    Pick<
      Capsule,
      | 'raw_text'
      | 'polished_text'
      | 'audio_url'
      | 'audio_duration_seconds'
      | 'title'
      | 'excerpt'
      | 'category'
      | 'mood'
      | 'read_time_minutes'
      | 'child_id'
      | 'unlock_type'
      | 'unlock_date'
      | 'unlock_age'
      | 'unlock_milestone'
      | 'is_surprise'
      | 'is_unlocked'
      | 'is_draft'
      | 'published_at'
    >
  >,
): Promise<Capsule> {
  const { data, error } = await supabase
    .from('capsules')
    .update(updates)
    .eq('id', capsuleId)
    .select()
    .single();

  if (error) throw error;
  return data as Capsule;
}

export async function publishCapsule(
  capsuleId: string,
  aiData: {
    polishedText: string;
    title: string;
    excerpt: string;
    category: string;
    mood: string;
    readTimeMinutes: number;
  },
  unlockType: UnlockType = 'immediate',
): Promise<Capsule> {
  const { data, error } = await supabase
    .from('capsules')
    .update({
      polished_text: aiData.polishedText,
      title: aiData.title,
      excerpt: aiData.excerpt,
      category: aiData.category,
      mood: aiData.mood,
      read_time_minutes: aiData.readTimeMinutes,
      is_draft: false,
      is_unlocked: unlockType === 'immediate',
      published_at: new Date().toISOString(),
    })
    .eq('id', capsuleId)
    .select()
    .single();

  if (error) throw error;
  return data as Capsule;
}

export async function deleteCapsule(capsuleId: string): Promise<void> {
  const { error } = await supabase
    .from('capsules')
    .delete()
    .eq('id', capsuleId);

  if (error) throw error;
}

// ─── AI (Edge Functions) ───────────────────────────────

export async function polishText(params: {
  text: string;
  languagePreferences?: string[];
}): Promise<AIPolishResult> {
  const { data, error } = await supabase.functions.invoke('ai-polish', {
    body: {
      text: params.text,
      language_preferences: params.languagePreferences,
    },
  });

  if (error) throw error;
  return data as AIPolishResult;
}

export async function generateMetadata(params: {
  text: string;
}): Promise<AIMetadataResult> {
  const { data, error } = await supabase.functions.invoke(
    'generate-metadata',
    { body: { text: params.text } },
  );

  if (error) throw error;
  return data as AIMetadataResult;
}

// ─── Audio ──────────────────────────────────────────────

export async function uploadAudio(
  userId: string,
  capsuleId: string,
  localUri: string,
): Promise<string> {
  const path = `${userId}/${capsuleId}.m4a`;

  const response = await fetch(localUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from('capsule-audio')
    .upload(path, blob, {
      contentType: 'audio/mp4',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('capsule-audio')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function transcribeAudio(params: {
  audioUrl: string;
  languagePreferences?: string[];
}): Promise<{ transcript: string }> {
  const { data, error } = await supabase.functions.invoke('speech-to-text', {
    body: {
      audio_url: params.audioUrl,
      language_preferences: params.languagePreferences,
    },
  });

  if (error) throw error;
  return data as { transcript: string };
}

// ─── Writing Prompts ────────────────────────────────────

export async function getWritingPrompts(params: {
  writerId: string;
  languagePreferences?: string[];
  childrenAges?: number[];
  previousCategories?: string[];
}): Promise<{ prompts: AIPrompt[] }> {
  const { data, error } = await supabase.functions.invoke('smart-prompts', {
    body: {
      writer_id: params.writerId,
      language_preferences: params.languagePreferences,
      children_ages: params.childrenAges,
      previous_categories: params.previousCategories,
    },
  });

  if (error) throw error;
  return data as { prompts: AIPrompt[] };
}
