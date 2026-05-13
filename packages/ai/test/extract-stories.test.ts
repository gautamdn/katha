import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractStories } from '../src/extract-stories';

const turns = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/sample-call-turns.json'), 'utf8'),
);

describe('extractStories', () => {
  it('produces stories with required fields from a multi-theme call', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              stories: [
                {
                  title: 'Wedding day in Bhuj',
                  polished_text: 'It was 1957 in Bhuj...',
                  source_turn_ids: ['t2'],
                  language: 'kn',
                  theme: 'wedding',
                  people_mentioned: ['mother-in-law'],
                },
                {
                  title: 'Mrs. Joshi and the poetry',
                  polished_text: 'A Marathi-medium school...',
                  source_turn_ids: ['t4'],
                  language: 'kn',
                  theme: 'school days',
                  people_mentioned: ['Mrs. Joshi'],
                },
              ],
            }),
          }],
        }),
      },
    };

    const stories = await extractStories({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns,
      elderName: 'Ajji',
    });

    expect(stories).toHaveLength(2);
    expect(stories[0].title).toBe('Wedding day in Bhuj');
    expect(stories[0].source_turn_ids).toEqual(['t2']);
    expect(stories[1].people_mentioned).toContain('Mrs. Joshi');
  });

  it('returns empty array when call has no extractable content', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ stories: [] }) }],
        }),
      },
    };
    const stories = await extractStories({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns: [],
      elderName: 'Ajji',
    });
    expect(stories).toHaveLength(0);
  });
});
