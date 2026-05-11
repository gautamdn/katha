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
import {
  extractVoiceprint,
  compareVoiceprints,
  normalizePyannoteEmbedding,
  SAME_SPEAKER_THRESHOLD,
  VOICEPRINT_DIM,
} from '../src/voiceprint';

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

describe('normalizePyannoteEmbedding (pure logic)', () => {
  const dim512 = new Array(VOICEPRINT_DIM).fill(0).map((_, i) => i * 0.001);

  it('accepts flat number[] at root', () => {
    expect(normalizePyannoteEmbedding(dim512)).toEqual(dim512);
  });

  it('accepts number[][] at root, returns first row', () => {
    const wrapped = [dim512, dim512.map((x) => x + 1)];
    expect(normalizePyannoteEmbedding(wrapped)).toEqual(dim512);
  });

  it('accepts { embedding: number[] }', () => {
    expect(normalizePyannoteEmbedding({ embedding: dim512 })).toEqual(dim512);
  });

  it('accepts { embedding: number[][] }, returns first row', () => {
    const wrapped = [dim512, dim512.map((x) => x + 1)];
    expect(normalizePyannoteEmbedding({ embedding: wrapped })).toEqual(dim512);
  });

  it('throws on completely unexpected shape (string)', () => {
    expect(() => normalizePyannoteEmbedding('bad')).toThrow(/Unexpected pyannote response shape/);
  });

  it('throws on wrong dimension', () => {
    expect(() => normalizePyannoteEmbedding(new Array(256).fill(0.1))).toThrow(
      /Unexpected voiceprint length 256/,
    );
  });

  it('throws on empty array', () => {
    expect(() => normalizePyannoteEmbedding([])).toThrow(/Unexpected pyannote response shape/);
  });

  it('throws on array of non-numbers', () => {
    expect(() => normalizePyannoteEmbedding(['a', 'b'])).toThrow(/Unexpected pyannote response shape/);
  });
});
