// TODO(voiceprint): verify HF v4 method name when running live.
// In @huggingface/inference v4, audioToAudio changed its parameter name from `data` to `inputs`
// and returns AudioToAudioOutput[] (audio blobs, not embeddings). pyannote/embedding requires
// a raw HTTP call to the HF Inference API since the SDK's typed tasks don't cover speaker
// embedding extraction. The live tests are skipIf-gated on HUGGINGFACE_TOKEN.

export const SAME_SPEAKER_THRESHOLD = 0.75;
export const VOICEPRINT_DIM = 512;

export interface ExtractOptions {
  token: string;
  audio: Buffer | Blob;
  model?: string;
}

const DEFAULT_MODEL = 'pyannote/embedding';
const HF_INFERENCE_URL = 'https://api-inference.huggingface.co/models';

export async function extractVoiceprint(opts: ExtractOptions): Promise<number[]> {
  const model = opts.model ?? DEFAULT_MODEL;
  const audioBlob =
    opts.audio instanceof Blob
      ? opts.audio
      : new Blob([opts.audio], { type: 'audio/flac' });

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

  // pyannote/embedding returns a nested array: [[dim0, dim1, ...]]
  // Flatten one level if wrapped in an outer array.
  let embedding: number[];
  if (Array.isArray(json) && Array.isArray((json as number[][])[0])) {
    embedding = (json as number[][])[0];
  } else if (Array.isArray(json)) {
    embedding = json as number[];
  } else {
    throw new Error(`Unexpected voiceprint response shape: ${JSON.stringify(json)}`);
  }

  if (embedding.length !== VOICEPRINT_DIM) {
    throw new Error(
      `Unexpected voiceprint dimension: got ${embedding.length}, expected ${VOICEPRINT_DIM}`,
    );
  }
  return embedding;
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
