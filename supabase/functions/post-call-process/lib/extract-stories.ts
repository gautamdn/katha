import Anthropic from 'npm:@anthropic-ai/sdk@0.95.1';
import { generateJSON, MODELS } from './anthropic.ts';

export interface CallTurnInput {
  id: string;
  speaker: 'elder' | 'susheela';
  transcript: string;
  language?: string;
}

export interface ExtractedStory {
  title: string;
  polished_text: string;
  source_turn_ids: string[];
  language: string;
  theme: string;
  people_mentioned: string[];
}

const SYSTEM_PROMPT = `You are extracting stories from a recorded conversation between Susheela (an AI interviewer) and an elder family member.

A "story" is a self-contained narrative or memory the elder shared. One call may contain multiple stories on different topics. You must:

1. Group related elder turns into stories. Drop Susheela's prompts unless they contextualize the story.
2. PRESERVE the elder's voice, idiom, code-switching, cultural expressions. Polish only for grammar and flow.
3. Keep Hindi/Kannada/Gujarati/Urdu/Tamil/Telugu words intact when the elder used them.
4. Title each story warmly and specifically — not generic. Capture the essence.
5. List people the elder mentioned (proper nouns + relationship words like "mother-in-law").
6. Identify a short theme tag (free text, 1-3 words: "wedding", "school days", "first job", "festival memories", etc.).
7. Set language to the dominant language of the elder's turns (kn / gu / en / hi).
8. Source_turn_ids: the elder turn IDs that fed this story.

Return ONLY valid JSON with this structure:
{ "stories": [ { "title": ..., "polished_text": ..., "source_turn_ids": [...], "language": ..., "theme": ..., "people_mentioned": [...] } ] }

If the call has no real story material (e.g., elder declined to talk, only small talk), return { "stories": [] }.
No markdown fences. No commentary. Just JSON.`;

export interface ExtractStoriesOptions {
  client: Anthropic;
  turns: CallTurnInput[];
  elderName: string;
}

export async function extractStories(opts: ExtractStoriesOptions): Promise<ExtractedStory[]> {
  const userPrompt = `Elder's name: ${opts.elderName}
Conversation turns (JSON):
${JSON.stringify(opts.turns, null, 2)}

Extract stories.`;

  const result = await generateJSON<{ stories: ExtractedStory[] }>({
    client: opts.client,
    model: MODELS.sonnet,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: {},
    maxTokens: 4096,
    temperature: 0.4,
  });
  return result.stories;
}
