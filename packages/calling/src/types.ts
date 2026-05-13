// @katha/shared main is types.ts — import from the package root resolves correctly
import type { ElderLanguage, ElderCountry, CallStatus } from '@katha/shared';

export interface ProviderInitResult {
  ok: boolean;
  message?: string;
}

export interface ProviderCallConfig {
  call_id: string;
  elder_phone_e164: string;
  elder_name: string;
  preferred_name?: string;
  language: ElderLanguage;
  country: ElderCountry;
  is_first_call: boolean;
  family_intro_audio_url?: string;
  system_prompt: string;
  webhook_url: string;
  archival_audio_target_url?: string;
}

export interface ProviderCallHandle {
  provider_call_id: string;
  started_at: Date;
}

export interface ProviderCallStatusResult {
  status: CallStatus;
  duration_seconds?: number;
  recording_url?: string;
  cost_cents?: number;
}

export interface ProviderHealthResult {
  ok: boolean;
  detail?: string;
}
