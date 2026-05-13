/**
 * Katha — Shared Types
 * Used by both the mobile app and edge functions.
 */

// ─── User Roles ──────────────────────────────────────────
export type UserRole = 'guardian' | 'writer' | 'reader';

// ─── Capsule Unlock Types ────────────────────────────────
export type UnlockType = 'immediate' | 'date' | 'age' | 'milestone';

export type MilestoneType =
  | 'first_day_of_school'
  | 'turning_13'
  | 'turning_16'
  | 'turning_18'
  | 'turning_21'
  | 'graduation'
  | 'wedding_day'
  | 'first_child'
  | 'feeling_sad'
  | 'feeling_lost'
  | 'needs_courage'
  | 'first_job'
  | 'custom';

// ─── Content Categories ──────────────────────────────────
export type CapsuleCategory =
  | 'childhood'
  | 'wisdom'
  | 'family'
  | 'festival'
  | 'recipe'
  | 'love_story'
  | 'life_lesson'
  | 'prayer'
  | 'tradition'
  | 'adventure'
  | 'funny_story'
  | 'bedtime_story'
  | 'letter'
  | 'other';

export type CapsuleMood =
  | 'nostalgic'
  | 'joyful'
  | 'reflective'
  | 'funny'
  | 'tender'
  | 'proud'
  | 'bittersweet'
  | 'hopeful'
  | 'peaceful'
  | 'celebratory';

// ─── Emoji Reactions ─────────────────────────────────────
export const REACTION_EMOJIS = ['❤️', '🤗', '😂', '🥺', '✨', '🙏'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

// ─── Core Data Types ─────────────────────────────────────

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  family_id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  relationship_label: string | null; // "Nani", "Dada", "Mom", etc.
  language_preferences: string[];
  bio: string | null;
  created_at: string;
}

export interface Child {
  id: string;
  family_id: string;
  name: string;
  date_of_birth: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Capsule {
  id: string;
  writer_id: string;
  family_id: string;
  child_id: string | null; // null = for all children

  // Content
  raw_text: string;
  polished_text: string | null;
  audio_url: string | null;
  audio_duration_seconds: number | null;

  // AI-generated metadata
  title: string | null;
  excerpt: string | null;
  category: CapsuleCategory | null;
  mood: CapsuleMood | null;
  read_time_minutes: number | null;

  // Time capsule
  unlock_type: UnlockType;
  unlock_date: string | null;
  unlock_age: number | null;
  unlock_milestone: MilestoneType | null;
  is_surprise: boolean;
  is_unlocked: boolean;

  // Meta
  is_private: boolean;
  is_draft: boolean;
  language: string | null;
  created_at: string;
  published_at: string | null;
}

export interface CapsulePhoto {
  id: string;
  capsule_id: string;
  photo_url: string;
  caption: string | null;
  display_order: number;
}

export interface Reaction {
  id: string;
  capsule_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  created_at: string;
}

// ─── Joined/Enriched Types ───────────────────────────────

export interface CapsuleWithWriter extends Capsule {
  writer: Pick<Profile, 'display_name' | 'avatar_url' | 'relationship_label'>;
  photos: CapsulePhoto[];
  reactions: Reaction[];
  recipient?: Pick<Child, 'name'>;
}

export interface WriterWithCapsules extends Profile {
  capsule_count: number;
  latest_capsule_at: string | null;
}

// ─── AI Types ────────────────────────────────────────────

export interface AIPolishResult {
  polished_text: string;
  changes_summary: string; // Brief description of what was changed
}

export interface AIMetadataResult {
  title: string;
  excerpt: string;
  category: CapsuleCategory;
  mood: CapsuleMood;
  read_time_minutes: number;
}

export interface AIPrompt {
  text: string;
  category: string;
  why: string; // Brief explanation of why this prompt was suggested
}

// ─── Calling / Susheela Domain Types ─────────────────────

export type ElderLanguage = 'kn' | 'gu' | 'en' | 'hi';
export type ElderCountry = 'IN' | 'US';

export type CallSpeaker = 'elder' | 'susheela';

export type CallStatus =
  | 'scheduled'
  | 'dialing'
  | 'in_progress'
  | 'completed'
  | 'voicemail'
  | 'no_answer'
  | 'declined'
  | 'failed';

export type CueKind = 'time_capsule' | 'advice' | 'distress' | 'cadence' | 'sharing_request';

export interface TurnCues {
  time_capsule?: { recipient?: string; condition?: string };
  advice?: { topic?: string };
  distress?: { severity: 'mild' | 'moderate' | 'severe' };
  cadence?: { request: string };
  sharing_request?: { recipient_label: string };
}

export type PersonaFactType =
  | 'memory'
  | 'opinion'
  | 'advice'
  | 'preference'
  | 'relationship'
  | 'event';

export interface PersonaFact {
  fact_type: PersonaFactType;
  text: string;
  source_turn_id: string;
  language: string;
  confidence: number;
}

export interface CallBrief {
  elder_id: string;
  elder_display_name: string;
  preferred_name?: string;
  relationship_label: string;
  language: ElderLanguage;
  is_first_call: boolean;
  family_intro_audio_url?: string;
  recent_summaries: string[];
  family_suggested_questions: string[];
  this_week_theme: string;
  voiceprint?: number[];
}
