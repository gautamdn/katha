import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELDER_ID = process.env.ELDER_ID!;
const FAMILY_SUGGESTED = process.env.FAMILY_SUGGESTED;

async function main() {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/schedule-call`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      elder_id: ELDER_ID,
      family_suggested_question: FAMILY_SUGGESTED,
    }),
  });
  if (!res.ok) {
    console.error('Schedule failed:', res.status, await res.text());
    process.exit(1);
  }
  const result = await res.json();
  console.log('Call queued:', JSON.stringify(result));
  console.log('call_id=' + result.call_id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
