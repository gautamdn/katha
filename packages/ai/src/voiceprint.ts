// NOTE: normalizePyannoteEmbedding is mirrored inline in
// supabase/functions/call-orchestrator/handlers.ts (Deno runtime cannot import
// from @katha/ai). Keep both in sync when changing shape-handling logic.

export const SAME_SPEAKER_THRESHOLD = 0.75;
export const VOICEPRINT_DIM = 512;

export interface ExtractOptions {
  token: string;
  audio: Buffer | Blob;
  model?: string;
}

const DEFAULT_MODEL = 'pyannote/embedding';
const HF_INFERENCE_URL = 'https://api-inference.huggingface.co/models';

// Accepts any of the shapes pyannote/embedding has been observed to return:
//   { embedding: number[] }  |  { embedding: number[][] }  |  number[]  |  number[][]
export function normalizePyannoteEmbedding(parsed: unknown): number[] {
  let candidate: unknown = parsed;
  if (parsed && typeof parsed === 'object' && 'embedding' in parsed) {
    candidate = (parsed as { embedding: unknown }).embedding;
  }
  if (Array.isArray(candidate) && Array.isArray(candidate[0])) {
    candidate = (candidate as number[][])[0];
  }
  if (!Array.isArray(candidate) || candidate.length === 0 || typeof candidate[0] !== 'number') {
    throw new Error(
      `Unexpected pyannote response shape: ${JSON.stringify(parsed).slice(0, 200)}`,
    );
  }
  if (candidate.length !== VOICEPRINT_DIM) {
    throw new Error(`Unexpected voiceprint length ${candidate.length}; expected ${VOICEPRINT_DIM}`);
  }
  return candidate as number[];
}

export async function extractVoiceprint(opts: ExtractOptions): Promise<number[]> {
  const model = opts.model ?? DEFAULT_MODEL;
  const audioBlob =
    opts.audio instanceof Blob
      ? opts.audio
      : new Blob([new Uint8Array(opts.audio)], { type: 'audio/flac' });

  const res = await fetch(`${HF_INFERENCE_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'audio/flac',
    },
    body: audioBlob,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HF inference failed ${res.status}: ${text}`);
  }

  const json = (await res.json()) as unknown;
  return normalizePyannoteEmbedding(json);
}

export function compareVoiceprints(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('voiceprint length mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
