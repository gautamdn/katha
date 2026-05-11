import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export interface EmbedTextOptions {
  client: OpenAI;
  text: string;
  model?: string;
}

export async function embedText(opts: EmbedTextOptions): Promise<number[]> {
  const res = await opts.client.embeddings.create({
    model: opts.model ?? EMBEDDING_MODEL,
    input: opts.text,
  });
  return res.data[0].embedding;
}

export interface EmbedBatchOptions {
  client: OpenAI;
  texts: string[];
  model?: string;
  chunkSize?: number;
}

export async function embedBatch(opts: EmbedBatchOptions): Promise<number[][]> {
  const chunkSize = opts.chunkSize ?? 100;
  const out: number[][] = [];
  for (let i = 0; i < opts.texts.length; i += chunkSize) {
    const slice = opts.texts.slice(i, i + chunkSize);
    const res = await opts.client.embeddings.create({
      model: opts.model ?? EMBEDDING_MODEL,
      input: slice,
    });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
