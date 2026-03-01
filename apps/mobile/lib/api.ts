import { supabase } from './supabase';
import { debug } from './debug';
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
  debug.log('api.signUp', 'attempting signup for:', params.email, 'role:', params.role);
  const result = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        display_name: params.display_name,
        role: params.role,
      },
    },
  });
  if (result.error) {
    debug.error('api.signUp', 'FAILED:', result.error.message, result.error.status);
  } else {
    debug.log('api.signUp', 'success, user:', result.data.user?.id, 'session:', !!result.data.session);
  }
  return result;
}

export async function signIn(params: { email: string; password: string }) {
  debug.log('api.signIn', 'attempting login for:', params.email);
  const result = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (result.error) {
    debug.error('api.signIn', 'FAILED:', result.error.message, result.error.status);
  } else {
    debug.log('api.signIn', 'success, user:', result.data.user?.id);
  }
  return result;
}

export async function signOut() {
  debug.log('api.signOut', 'signing out');
  const result = await supabase.auth.signOut();
  debug.log('api.signOut', 'done, error:', result.error?.message ?? 'none');
  return result;
}

// ─── Profile ────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  debug.log('api.getProfile', 'fetching profile for userId:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    debug.warn('api.getProfile', 'error:', error.code, error.message, error.details);
    // Profile may not exist yet (trigger race condition) — retry once
    if (error.code === 'PGRST116') {
      debug.log('api.getProfile', 'PGRST116 — retrying in 500ms...');
      await new Promise((r) => setTimeout(r, 500));
      const retry = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (retry.error) {
        debug.error('api.getProfile', 'retry also failed:', retry.error.code, retry.error.message);
      } else {
        debug.log('api.getProfile', 'retry succeeded, family_id:', retry.data?.family_id);
      }
      return (retry.data as Profile) ?? null;
    }
    return null;
  }

  debug.log('api.getProfile', 'success, family_id:', data?.family_id, 'role:', data?.role);
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'family_id' | 'relationship_label' | 'display_name' | 'bio' | 'avatar_url'>>,
): Promise<Profile> {
  debug.log('api.updateProfile', 'userId:', userId, 'updates:', JSON.stringify(updates));
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    debug.error('api.updateProfile', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.updateProfile', 'success');
  return data as Profile;
}

// ─── Family ─────────────────────────────────────────────

export async function createFamily(params: {
  name: string;
  userId: string;
}): Promise<Family> {
  debug.log('api.createFamily', 'name:', params.name, 'userId:', params.userId);
  const { data: family, error } = await supabase
    .from('families')
    .insert({ name: params.name, created_by: params.userId })
    .select()
    .single();

  if (error) {
    debug.error('api.createFamily', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.createFamily', 'created familyId:', family.id, '— linking profile...');

  // Link the creator's profile to the new family
  await updateProfile(params.userId, { family_id: family.id });

  debug.log('api.createFamily', 'done');
  return family as Family;
}

export async function joinFamily(params: {
  inviteCode: string;
  userId: string;
  relationshipLabel?: string;
}): Promise<Family> {
  debug.log('api.joinFamily', 'inviteCode:', params.inviteCode, 'userId:', params.userId);
  // Use SECURITY DEFINER RPC to look up family by invite code
  const { data, error } = await supabase.rpc('lookup_family_by_invite_code', {
    code: params.inviteCode,
  });

  if (error) {
    debug.error('api.joinFamily', 'RPC error:', error.code, error.message, error.details);
    throw error;
  }
  if (!data || data.length === 0) {
    debug.error('api.joinFamily', 'no family found for invite code:', params.inviteCode);
    throw new Error('INVALID_INVITE_CODE');
  }

  const family = data[0] as { id: string; name: string };
  debug.log('api.joinFamily', 'found family:', family.id, family.name, '— linking profile...');

  // Link the user's profile to this family
  await updateProfile(params.userId, {
    family_id: family.id,
    relationship_label: params.relationshipLabel,
  });

  debug.log('api.joinFamily', 'done');
  return family as Family;
}

export async function getFamily(familyId: string): Promise<Family> {
  debug.log('api.getFamily', 'familyId:', familyId);
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('id', familyId)
    .single();

  if (error) {
    debug.error('api.getFamily', 'FAILED:', error.code, error.message, error.details);
    throw error;
  }
  debug.log('api.getFamily', 'success, name:', data?.name, 'invite_code:', data?.invite_code);
  return data as Family;
}

export async function getFamilyMembers(familyId: string): Promise<Profile[]> {
  debug.log('api.getFamilyMembers', 'familyId:', familyId);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');

  if (error) {
    debug.error('api.getFamilyMembers', 'FAILED:', error.code, error.message);
    throw error;
  }
  debug.log('api.getFamilyMembers', 'found', data?.length ?? 0, 'members');
  return data as Profile[];
}

// ─── Children ──────────────────────────────────────────

export async function getChildren(familyId: string): Promise<Child[]> {
  debug.log('api.getChildren', 'familyId:', familyId);
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at');

  if (error) {
    debug.error('api.getChildren', 'FAILED:', error.code, error.message);
    throw error;
  }
  debug.log('api.getChildren', 'found', data?.length ?? 0, 'children');
  return data as Child[];
}

export async function createChild(params: {
  familyId: string;
  name: string;
  dateOfBirth: string;
}): Promise<Child> {
  debug.log('api.createChild', 'familyId:', params.familyId, 'name:', params.name);
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: params.familyId,
      name: params.name,
      date_of_birth: params.dateOfBirth,
    })
    .select()
    .single();

  if (error) {
    debug.error('api.createChild', 'FAILED:', error.code, error.message, error.details);
    throw error;
  }
  debug.log('api.createChild', 'created childId:', data?.id);
  return data as Child;
}

// ─── Capsules ──────────────────────────────────────────

export async function getFamilyCapsules(
  familyId: string,
  options?: { limit?: number; offset?: number },
): Promise<CapsuleWithWriter[]> {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  debug.log('api.getFamilyCapsules', 'familyId:', familyId, 'limit:', limit, 'offset:', offset);

  const { data, error } = await supabase
    .from('capsules')
    .select(
      `*, writer:profiles!writer_id(display_name, avatar_url, relationship_label), recipient:children!child_id(name)`,
    )
    .eq('family_id', familyId)
    .eq('is_draft', false)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    debug.error('api.getFamilyCapsules', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.getFamilyCapsules', 'found', data?.length ?? 0, 'capsules');

  return (data ?? []).map((c: any) => ({
    ...c,
    photos: [],
    reactions: [],
  })) as CapsuleWithWriter[];
}

export async function getWriterCapsules(writerId: string): Promise<Capsule[]> {
  debug.log('api.getWriterCapsules', 'writerId:', writerId);
  const { data, error } = await supabase
    .from('capsules')
    .select('*')
    .eq('writer_id', writerId)
    .order('created_at', { ascending: false });

  if (error) {
    debug.error('api.getWriterCapsules', 'FAILED:', error.code, error.message);
    throw error;
  }
  debug.log('api.getWriterCapsules', 'found', data?.length ?? 0, 'capsules');
  return data as Capsule[];
}

export async function getCapsule(
  capsuleId: string,
): Promise<CapsuleWithWriter> {
  debug.log('api.getCapsule', 'capsuleId:', capsuleId);
  const { data, error } = await supabase
    .from('capsules')
    .select(
      `*, writer:profiles!writer_id(display_name, avatar_url, relationship_label), recipient:children!child_id(name)`,
    )
    .eq('id', capsuleId)
    .single();

  if (error) {
    debug.error('api.getCapsule', 'FAILED:', error.code, error.message, error.details);
    throw error;
  }
  debug.log('api.getCapsule', 'success, title:', data?.title, 'is_draft:', data?.is_draft);

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
  debug.log('api.createCapsule', 'writerId:', params.writerId, 'familyId:', params.familyId, 'unlockType:', params.unlockType ?? 'immediate', 'textLen:', params.rawText.length);
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

  if (error) {
    debug.error('api.createCapsule', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.createCapsule', 'created capsuleId:', data?.id);
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
  debug.log('api.updateCapsule', 'capsuleId:', capsuleId, 'fields:', Object.keys(updates).join(', '));
  const { data, error } = await supabase
    .from('capsules')
    .update(updates)
    .eq('id', capsuleId)
    .select()
    .single();

  if (error) {
    debug.error('api.updateCapsule', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.updateCapsule', 'success');
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
  debug.log('api.publishCapsule', 'capsuleId:', capsuleId, 'unlockType:', unlockType, 'title:', aiData.title, 'category:', aiData.category);
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

  if (error) {
    debug.error('api.publishCapsule', 'FAILED:', error.code, error.message, error.details, error.hint);
    throw error;
  }
  debug.log('api.publishCapsule', 'success — capsule is now published, is_unlocked:', unlockType === 'immediate');
  return data as Capsule;
}

export async function deleteCapsule(capsuleId: string): Promise<void> {
  debug.log('api.deleteCapsule', 'capsuleId:', capsuleId);
  const { error } = await supabase
    .from('capsules')
    .delete()
    .eq('id', capsuleId);

  if (error) {
    debug.error('api.deleteCapsule', 'FAILED:', error.code, error.message);
    throw error;
  }
  debug.log('api.deleteCapsule', 'success');
}

// ─── AI (Edge Functions) ───────────────────────────────

export async function polishText(params: {
  text: string;
  languagePreferences?: string[];
}): Promise<AIPolishResult> {
  debug.log('api.polishText', 'textLen:', params.text.length, 'languages:', params.languagePreferences);
  const { data, error } = await supabase.functions.invoke('ai-polish', {
    body: {
      text: params.text,
      language_preferences: params.languagePreferences,
    },
  });

  if (error) {
    await debug.edgeFunctionError('api.polishText', error);
    throw error;
  }
  debug.log('api.polishText', 'success, polished textLen:', data?.polished_text?.length ?? 0);
  return data as AIPolishResult;
}

export async function generateMetadata(params: {
  text: string;
}): Promise<AIMetadataResult> {
  debug.log('api.generateMetadata', 'textLen:', params.text.length);
  const { data, error } = await supabase.functions.invoke(
    'generate-metadata',
    { body: { text: params.text } },
  );

  if (error) {
    await debug.edgeFunctionError('api.generateMetadata', error);
    throw error;
  }
  debug.log('api.generateMetadata', 'success, title:', data?.title, 'category:', data?.category);
  return data as AIMetadataResult;
}

// ─── Audio ──────────────────────────────────────────────

export async function uploadAudio(
  userId: string,
  capsuleId: string,
  localUri: string,
): Promise<string> {
  const path = `${userId}/${capsuleId}.m4a`;
  debug.log('api.uploadAudio', 'path:', path, 'localUri:', localUri.substring(0, 80));

  const response = await fetch(localUri);
  const blob = await response.blob();
  debug.log('api.uploadAudio', 'blob size:', blob.size, 'bytes, type:', blob.type);

  const { error } = await supabase.storage
    .from('capsule-audio')
    .upload(path, blob, {
      contentType: 'audio/mp4',
      upsert: true,
    });

  if (error) {
    debug.error('api.uploadAudio', 'FAILED:', error.message, 'statusCode:', (error as any).statusCode);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from('capsule-audio')
    .getPublicUrl(path);

  debug.log('api.uploadAudio', 'success, publicUrl:', urlData.publicUrl.substring(0, 100));
  return urlData.publicUrl;
}

export async function transcribeAudio(params: {
  audioUrl: string;
  languagePreferences?: string[];
}): Promise<{ transcript: string }> {
  debug.log('api.transcribeAudio', 'audioUrl:', params.audioUrl.substring(0, 80), 'languages:', params.languagePreferences);
  const { data, error } = await supabase.functions.invoke('speech-to-text', {
    body: {
      audio_url: params.audioUrl,
      language_preferences: params.languagePreferences,
    },
  });

  if (error) {
    await debug.edgeFunctionError('api.transcribeAudio', error);
    throw error;
  }
  debug.log('api.transcribeAudio', 'success, transcript length:', data?.transcript?.length ?? 0, 'provider:', data?.provider ?? 'unknown');
  return data as { transcript: string };
}

// ─── Writing Prompts ────────────────────────────────────

export async function getWritingPrompts(params: {
  writerId: string;
  languagePreferences?: string[];
  childrenAges?: number[];
  previousCategories?: string[];
}): Promise<{ prompts: AIPrompt[] }> {
  debug.log('api.getWritingPrompts', 'writerId:', params.writerId, 'languages:', params.languagePreferences, 'childrenAges:', params.childrenAges);
  const { data, error } = await supabase.functions.invoke('smart-prompts', {
    body: {
      writer_id: params.writerId,
      language_preferences: params.languagePreferences,
      children_ages: params.childrenAges,
      previous_categories: params.previousCategories,
    },
  });

  if (error) {
    await debug.edgeFunctionError('api.getWritingPrompts', error);
    throw error;
  }
  debug.log('api.getWritingPrompts', 'success, got', data?.prompts?.length ?? 0, 'prompts');
  return data as { prompts: AIPrompt[] };
}
