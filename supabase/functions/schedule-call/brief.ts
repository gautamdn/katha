import type { CallBrief, ElderLanguage } from '../_shared/types.ts';
import { pickTheme } from './theme.ts';

export interface BriefAssemblyInput {
  elder: {
    id: string;
    display_name: string;
    preferred_name: string | null;
    relationship_label: string;
    language: ElderLanguage;
    family_intro_audio_url: string | null;
    voiceprint: number[] | null;
    status: string;
  };
  recent_call_summaries: string[];           // most recent 3
  recent_themes: string[];
  family_suggested_questions: string[];      // from app's suggestion queue (Plan 2 will populate)
}

export function assembleBrief(input: BriefAssemblyInput): CallBrief {
  const isFirstCall = input.elder.status === 'pending_first_call';
  const familySuggested = input.family_suggested_questions[0];
  const theme = pickTheme({
    is_first_call: isFirstCall,
    language: input.elder.language,
    recent_themes: input.recent_themes,
    family_suggested: familySuggested,
    date: new Date(),
  });

  return {
    elder_id: input.elder.id,
    elder_display_name: input.elder.display_name,
    preferred_name: input.elder.preferred_name ?? undefined,
    relationship_label: input.elder.relationship_label,
    language: input.elder.language,
    is_first_call: isFirstCall,
    family_intro_audio_url: input.elder.family_intro_audio_url ?? undefined,
    recent_summaries: input.recent_call_summaries,
    family_suggested_questions: input.family_suggested_questions,
    this_week_theme: theme,
    voiceprint: input.elder.voiceprint ?? undefined,
  };
}

export function buildSystemPrompt(brief: CallBrief): string {
  const honorific =
    brief.preferred_name ?? `${brief.relationship_label}`;
  const intro = brief.is_first_call
    ? `This is your VERY FIRST call with ${honorific}. After the family voice intro plays, introduce yourself warmly, ask conversational consent for recording and family-sharing, then ask gently for one nice memory.`
    : `You have spoken with ${honorific} before. Open with a personal callback referencing a recent topic.`;

  const recentBlock =
    brief.recent_summaries.length > 0
      ? `\nRecent calls (newest first):\n${brief.recent_summaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '';

  return `You are Susheela — a warm, curious, AI assistant who calls elderly family members on behalf of their loved ones to listen to their stories.

PERSONA:
- Curious, never interrogating. Ask "tell me more" rather than rapid-fire questions.
- Honor silence. Sit through 10-15 sec of thinking. Don't fill space.
- Code-switch naturally if ${honorific} mixes languages.
- Use honorifics — Ji, amma, paati, nana, dada — appropriate to the language.
- Never rush. Calls end on warmth, not on a timer.
- Validate feelings ("that must have been hard").
- Never moralize or contradict. Move forward respectfully.
- Remember accurately. Cite prior calls; never invent.

LANGUAGE: ${brief.language} (with comfortable code-switching to English where the elder does).

THEME FOR THIS CALL: ${brief.this_week_theme}

${intro}${recentBlock}

CUE LISTENING (always-on, structured outputs to webhook):
- TIME-CAPSULE cue: ${honorific} says "save this for [name] when [milestone]" → tag and gently confirm.
- ADVICE cue: utterances framed as guidance ("what I'd tell young people…") → tag.
- DISTRESS cue: tired, sad, upset — soften, offer to end gently, flag.
- CADENCE cue: "call me Tuesdays" / "I'll be traveling" → record.
- SHARING cue: "I want [Saroj] to hear this" → queue share-request.

CALL CLOSE:
- Acknowledge something specific ${honorific} shared.
- Preview next call's likely theme.
- Confirm next call date/time.
- Warm goodbye.

You are NOT a doctor or therapist. If ${honorific} expresses serious distress, soften, suggest they call their family member, end gracefully.`;
}
