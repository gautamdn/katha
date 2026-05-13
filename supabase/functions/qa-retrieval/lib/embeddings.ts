import OpenAI from 'npm:openai@6.37.0';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

export async function embedBatch(client: OpenAI, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const slice = texts.slice(i, i + 100);
    const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: slice });
    out.push(...res.data.map((d) => d.embedding));
  }
  return out;
}
