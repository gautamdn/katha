import { z } from 'zod';

// ─── Auth / Profile ──────────────────────────────────────
export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
  role: z.enum(['guardian', 'writer']),
});

export const createFamilySchema = z.object({
  name: z.string().min(1).max(100),
});

export const joinFamilySchema = z.object({
  invite_code: z.string().length(8),
  relationship_label: z.string().min(1).max(50).optional(),
});

// ─── Children ────────────────────────────────────────────
export const createChildSchema = z.object({
  name: z.string().min(1).max(100),
  date_of_birth: z.string().date(),
});

// ─── Capsules ────────────────────────────────────────────
export const createCapsuleSchema = z.object({
  raw_text: z.string().min(1),
  child_id: z.string().uuid().nullable().optional(),
  unlock_type: z.enum(['immediate', 'date', 'age', 'milestone']).default('immediate'),
  unlock_date: z.string().datetime().optional(),
  unlock_age: z.number().int().min(1).max(100).optional(),
  unlock_milestone: z.string().optional(),
  is_surprise: z.boolean().default(false),
  is_private: z.boolean().default(false),
  language: z.string().optional(),
});

export const updateCapsuleSchema = createCapsuleSchema.partial();

// ─── AI ──────────────────────────────────────────────────
export const polishRequestSchema = z.object({
  text: z.string().min(1),
  language_preferences: z.array(z.string()).optional(),
});

export const metadataRequestSchema = z.object({
  text: z.string().min(1),
});

export const promptRequestSchema = z.object({
  writer_id: z.string().uuid(),
  language_preferences: z.array(z.string()).optional(),
  previous_categories: z.array(z.string()).optional(),
  children_ages: z.array(z.number()).optional(),
});
