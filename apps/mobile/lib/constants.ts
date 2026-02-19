/**
 * Katha App Constants
 */

export const APP_NAME = 'Katha';
export const APP_TAGLINE = 'Family Stories, Forever';

// Auto-save interval for drafts (ms)
export const DRAFT_AUTOSAVE_INTERVAL = 2000;

// Audio recording limits
export const MAX_AUDIO_DURATION_SECONDS = 600; // 10 minutes
export const AUDIO_SAMPLE_RATE = 44100;

// Image limits
export const MAX_PHOTOS_PER_CAPSULE = 10;
export const MAX_IMAGE_SIZE_MB = 10;

// AI
export const AI_MODELS = {
  polish: 'claude-sonnet-4-20250514',
  metadata: 'claude-haiku-4-5-20251001',
  prompts: 'claude-sonnet-4-20250514',
  translate: 'claude-sonnet-4-20250514',
} as const;

// Milestone options for time capsules
export const MILESTONE_OPTIONS = [
  { value: 'first_day_of_school', label: 'First day of school', emoji: '🎒' },
  { value: 'turning_13', label: 'Turning 13', emoji: '🎂' },
  { value: 'turning_16', label: 'Turning 16', emoji: '🎉' },
  { value: 'turning_18', label: 'Turning 18', emoji: '🎓' },
  { value: 'turning_21', label: 'Turning 21', emoji: '✨' },
  { value: 'graduation', label: 'Graduation', emoji: '🎓' },
  { value: 'wedding_day', label: 'Wedding day', emoji: '💍' },
  { value: 'first_child', label: 'When they have their first child', emoji: '👶' },
  { value: 'feeling_sad', label: 'Open when feeling sad', emoji: '💛' },
  { value: 'feeling_lost', label: 'Open when feeling lost', emoji: '🧭' },
  { value: 'needs_courage', label: 'Open when they need courage', emoji: '💪' },
  { value: 'first_job', label: 'First job', emoji: '💼' },
  { value: 'custom', label: 'Custom milestone...', emoji: '📝' },
] as const;

// Capsule categories for display
export const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  childhood: { label: 'Childhood', emoji: '🧒' },
  wisdom: { label: 'Wisdom', emoji: '🌿' },
  family: { label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  festival: { label: 'Festival', emoji: '🪔' },
  recipe: { label: 'Recipe', emoji: '🍲' },
  love_story: { label: 'Love Story', emoji: '💕' },
  life_lesson: { label: 'Life Lesson', emoji: '📖' },
  prayer: { label: 'Prayer', emoji: '🙏' },
  tradition: { label: 'Tradition', emoji: '🎭' },
  adventure: { label: 'Adventure', emoji: '🌍' },
  funny_story: { label: 'Funny Story', emoji: '😄' },
  bedtime_story: { label: 'Bedtime Story', emoji: '🌙' },
  letter: { label: 'Letter', emoji: '💌' },
  other: { label: 'Other', emoji: '📝' },
};
