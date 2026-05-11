import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPersonaFacts } from '../src/extract-persona-facts';

const turns = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/sample-call-turns.json'), 'utf8'),
);

describe('extractPersonaFacts', () => {
  it('produces typed atomic facts with source turn ids', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              facts: [
                {
                  fact_type: 'event',
                  text: 'Married in 1957 in Bhuj.',
                  source_turn_id: 't2',
                  confidence: 0.95,
                  language: 'kn',
                },
                {
                  fact_type: 'memory',
                  text: 'Mother-in-law gave her a pearl necklace at the wedding.',
                  source_turn_id: 't2',
                  confidence: 0.9,
                  language: 'kn',
                },
                {
                  fact_type: 'relationship',
                  text: 'Favorite teacher Mrs. Joshi taught poetry in Marathi-medium school.',
                  source_turn_id: 't4',
                  confidence: 0.85,
                  language: 'kn',
                },
              ],
            }),
          }],
        }),
      },
    };

    const facts = await extractPersonaFacts({
      client: fakeClient as unknown as import('@anthropic-ai/sdk').default,
      turns,
      elderName: 'Ajji',
    });

    expect(facts).toHaveLength(3);
    expect(facts[0].fact_type).toBe('event');
    expect(facts[1].fact_type).toBe('memory');
    expect(facts[2].fact_type).toBe('relationship');
    expect(facts.every((f) => f.confidence > 0)).toBe(true);
  });
});
