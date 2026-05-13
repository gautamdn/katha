export type ElderLanguage = 'kn' | 'gu' | 'en' | 'hi';
export type ElderCountry = 'IN' | 'US';

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

export interface ProviderTurnEvent {
  provider_call_id: string;
  speaker: 'elder' | 'susheela';
  transcript: string;
  language: string;
  audio_clip_url: string;
  started_at_ms: number;
  ended_at_ms: number;
}

export interface ProviderCallEndEvent {
  provider_call_id: string;
  status: 'completed' | 'voicemail' | 'no_answer' | 'declined' | 'failed';
  duration_seconds?: number;
  recording_url?: string;
  cost_cents?: number;
}
