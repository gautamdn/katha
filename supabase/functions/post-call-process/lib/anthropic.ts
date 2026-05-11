import Anthropic from 'npm:@anthropic-ai/sdk@0.95.1';

export interface GenerateJSONOptions {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: object;
  maxTokens?: number;
  temperature?: number;
}

const FENCED = /```(?:json)?\n([\s\S]*?)\n```/;

export async function generateJSON<T = unknown>(opts: GenerateJSONOptions): Promise<T> {
  const res = await opts.client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
  });
  const block = res.content.find((b: { type: string }) => b.type === 'text') as
    | { type: 'text'; text: string } | undefined;
  if (!block) throw new Error('No text block');
  const text = block.text.trim();
  const fenced = FENCED.exec(text);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate) as T;
}

export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
} as const;
