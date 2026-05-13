import { describe, it, expect, vi } from 'vitest';
import { embedText, embedBatch } from '../src/embeddings';

describe('embeddings', () => {
  it('embedText returns a 1536-dim vector for text-embedding-3-small', async () => {
    const fakeClient = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      },
    };
    const v = await embedText({
      client: fakeClient as unknown as import('openai').default,
      text: 'hello',
    });
    expect(v).toHaveLength(1536);
  });

  it('embedBatch chunks calls', async () => {
    const fakeClient = {
      embeddings: {
        create: vi.fn().mockImplementation(async ({ input }: { input: string[] }) => ({
          data: input.map(() => ({ embedding: new Array(1536).fill(0) })),
        })),
      },
    };
    const result = await embedBatch({
      client: fakeClient as unknown as import('openai').default,
      texts: new Array(150).fill('x'),
      chunkSize: 100,
    });
    expect(result).toHaveLength(150);
    expect(fakeClient.embeddings.create).toHaveBeenCalledTimes(2);
  });
});
