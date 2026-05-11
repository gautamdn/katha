// Live tests (describe.skipIf(!HF_TOKEN)) require:
//   - fixtures at test/fixtures/voice-clip-elder-1.flac
//   - fixtures at test/fixtures/voice-clip-elder-1-followup.flac
//   - fixtures at test/fixtures/voice-clip-different-speaker.flac
//   - HUGGINGFACE_TOKEN env var set to a valid HF access token
//
// These are skipped in CI. The pure-logic compareVoiceprints tests always run.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractVoiceprint, compareVoiceprints, SAME_SPEAKER_THRESHOLD } from '../src/voiceprint';

const fixturesDir = resolve(__dirname, 'fixtures');
function load(name: string): Buffer {
  return readFileSync(resolve(fixturesDir, name));
}

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

describe.skipIf(!HF_TOKEN)('voiceprint (live HF API)', () => {
  it('same speaker matches above threshold', async () => {
    const a = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1.flac') });
    const b = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1-followup.flac') });
    const sim = compareVoiceprints(a, b);
    expect(sim).toBeGreaterThan(SAME_SPEAKER_THRESHOLD);
  }, 30_000);

  it('different speakers fall below threshold', async () => {
    const a = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-elder-1.flac') });
    const c = await extractVoiceprint({ token: HF_TOKEN!, audio: load('voice-clip-different-speaker.flac') });
    const sim = compareVoiceprints(a, c);
    expect(sim).toBeLessThan(SAME_SPEAKER_THRESHOLD);
  }, 30_000);
});

describe('compareVoiceprints (pure logic)', () => {
  it('returns 1 for identical vectors', () => {
    const v = new Array(512).fill(0).map((_, i) => Math.sin(i));
    expect(compareVoiceprints(v, v)).toBeCloseTo(1, 5);
  });
  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(compareVoiceprints(a, b)).toBeCloseTo(0, 5);
  });
});
