import Anthropic from 'npm:@anthropic-ai/sdk@0.95.1';
import { generateJSON, MODELS } from './anthropic.ts';
import type { CallTurnInput } from './extract-stories.ts';

export type PersonaFactType =
  | 'memory'
  | 'opinion'
  | 'advice'
  | 'preference'
  | 'relationship'
  | 'event';

export interface ExtractedPersonaFact {
  fact_type: PersonaFactType;
  text: string;
  source_turn_id: string;
  confidence: number;
  language: string;
}

const SYSTEM_PROMPT = `You are building a per-elder persona index from a recorded conversation.

Your job is to distill the elder's turns into atomic, retrievable FACTS — short, self-contained statements suitable for embedding-based retrieval and for later persona synthesis.

For each fact, classify into one of:
- memory: A specific past experience the elder lived. ("My wedding was in 1957 in Bhuj.")
- opinion: A view, belief, or aesthetic preference the elder expressed. ("I think arranged marriages can work if both families are honest.")
- advice: Guidance the elder offered. ("If you marry, marry someone whose family you can sit with for a meal.")
- preference: A liked/disliked thing. ("I love rasam and bhindi together.")
- relationship: A claim about another person and the elder's relationship to them. ("Mrs. Joshi was my favorite teacher in 5th standard.")
- event: A datable real-world event from the elder's life. ("I joined my husband in Mumbai in 1962.")

Rules:
1. One fact per JSON entry. Atomic.
2. Preserve language and style — don't translate or sanitize.
3. Drop facts you're not at least 60% sure of (set confidence appropriately if you keep them).
4. Source turn must be an elder turn (not Susheela's).
5. If a turn yields multiple facts, emit multiple entries — same source_turn_id.
6. Don't invent facts not stated.

Return ONLY valid JSON: { "facts": [ { "fact_type": ..., "text": ..., "source_turn_id": ..., "confidence": ..., "language": ... } ] }
No markdown fences. No commentary.`;

export interface ExtractPersonaFactsOptions {
  client: Anthropic;
  turns: CallTurnInput[];
  elderName: string;
}

export async function extractPersonaFacts(
  opts: ExtractPersonaFactsOptions,
): Promise<ExtractedPersonaFact[]> {
  const elderTurns = opts.turns.filter((t) => t.speaker === 'elder');
  if (elderTurns.length === 0) return [];

  const userPrompt = `Elder's name: ${opts.elderName}
Elder turns (JSON):
${JSON.stringify(elderTurns, null, 2)}

Extract atomic persona facts.`;

  const result = await generateJSON<{ facts: ExtractedPersonaFact[] }>({
    client: opts.client,
    model: MODELS.sonnet,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: {},
    maxTokens: 4096,
    temperature: 0.3,
  });
  return result.facts;
}
