import { describe, it, expect, vi } from 'vitest';
import { generateJSON } from '../src/anthropic';

describe('generateJSON', () => {
  it('parses fenced JSON from Claude response', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '```json\n{"x":1}\n```' }],
        }),
      },
    };
    const out = await generateJSON({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      model: 'claude-haiku-4-5-20251001',
      systemPrompt: 'sys',
      userPrompt: 'user',
      schema: { type: 'object' },
    });
    expect(out).toEqual({ x: 1 });
  });

  it('parses plain JSON without fences', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"y":2}' }],
        }),
      },
    };
    const out = await generateJSON({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      model: 'claude-haiku-4-5-20251001',
      systemPrompt: 'sys',
      userPrompt: 'user',
      schema: { type: 'object' },
    });
    expect(out).toEqual({ y: 2 });
  });

  it('throws on invalid JSON', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json' }],
        }),
      },
    };
    await expect(
      generateJSON({
        client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
        model: 'claude-haiku-4-5-20251001',
        systemPrompt: 'sys',
        userPrompt: 'user',
        schema: { type: 'object' },
      }),
    ).rejects.toThrow(/JSON/);
  });
});
