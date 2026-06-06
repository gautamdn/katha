import { config } from 'dotenv';
config();

type Lang = 'kn' | 'gu';

interface Args {
  to: string;
  lang: Lang;
  record: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let to: string | undefined;
  let lang: string | undefined;
  let record = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--to') to = argv[++i];
    else if (arg === '--lang') lang = argv[++i];
    else if (arg === '--record') record = argv[++i] === 'true';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    throw new Error('--to must be an E.164 phone number (e.g. +91XXXXXXXXXX)');
  }
  if (lang !== 'kn' && lang !== 'gu') {
    throw new Error('--lang must be "kn" or "gu"');
  }
  return { to, lang, record };
}

async function main() {
  const { to, lang, record } = parseArgs();

  const PLIVO_AUTH_ID = process.env.PLIVO_AUTH_ID;
  const PLIVO_AUTH_TOKEN = process.env.PLIVO_AUTH_TOKEN;
  const PLIVO_SANDBOX_FROM = process.env.PLIVO_SANDBOX_FROM;
  const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
  if (!PLIVO_AUTH_ID) throw new Error('PLIVO_AUTH_ID not set');
  if (!PLIVO_AUTH_TOKEN) throw new Error('PLIVO_AUTH_TOKEN not set');
  if (!PLIVO_SANDBOX_FROM) throw new Error('PLIVO_SANDBOX_FROM not set');
  if (!PROJECT_REF) throw new Error('SUPABASE_PROJECT_REF not set');

  const answerUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/plivo-answer?lang=${lang}`;
  const basic = Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64');

  const res = await fetch(
    `https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Call/`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: PLIVO_SANDBOX_FROM,
        to,
        answer_url: answerUrl,
        answer_method: 'GET',
        record,
      }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error(`Plivo dial failed (${res.status}): ${text}`);
    process.exit(1);
  }

  console.log(`status=${res.status}`);
  console.log(`to=${to}`);
  console.log(`lang=${lang}`);
  console.log(`record=${record}`);
  console.log(`answer_url=${answerUrl}`);
  console.log(`response=${text}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
