import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PHONE_KEY = process.env.PHONE_ENCRYPTION_KEY!;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'gautam@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'changeme';
const TEST_ELDER_PHONE = process.env.TEST_ELDER_PHONE!;     // your real test phone, E.164
const TEST_ELDER_NAME = process.env.TEST_ELDER_NAME ?? 'Susheela';
const TEST_ELDER_LANG = process.env.TEST_ELDER_LANG ?? 'kn';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Create test user (or fetch existing)
  let userId: string;
  const { data: signUp, error: signUpErr } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });
  if (signUpErr && !signUpErr.message.includes('already registered')) {
    throw signUpErr;
  }
  if (signUp?.user) {
    userId = signUp.user.id;
  } else {
    const { data: list } = await supabase.auth.admin.listUsers();
    const u = list.users.find((u) => u.email === TEST_USER_EMAIL);
    if (!u) throw new Error('User not found after create attempt');
    userId = u.id;
  }
  console.log('User:', userId);

  // 2. Create family
  const { data: family, error: famErr } = await supabase
    .from('families')
    .insert({ name: 'Test Family', invite_code: `TEST-${Date.now()}`, created_by: userId })
    .select('id')
    .single();
  if (famErr) throw famErr;
  console.log('Family:', family!.id);

  // 3. Create profile
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      family_id: family!.id,
      display_name: 'Gautam',
      role: 'guardian',
      relationship_label: 'Grandson',
    });
  if (profErr) throw profErr;

  // 4. Encrypt phone via SQL (using the PHONE_ENCRYPTION_KEY)
  const phoneHash = await hashPhone(TEST_ELDER_PHONE);
  const { data: encrypted, error: encErr } = await supabase.rpc('encrypt_phone', {
    plaintext_phone: TEST_ELDER_PHONE,
  });
  if (encErr) throw encErr;

  // 5. Create elder
  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .insert({
      family_id: family!.id,
      display_name: TEST_ELDER_NAME,
      relationship_label: 'Grandmother',
      preferred_name: TEST_ELDER_NAME,
      language: TEST_ELDER_LANG,
      phone_number_encrypted: encrypted as string,
      phone_number_hash: phoneHash,
      country: 'IN',
      timezone: 'Asia/Kolkata',
      added_by: userId,
      status: 'pending_first_call',
    })
    .select('id')
    .single();
  if (elderErr) throw elderErr;
  console.log('Elder:', elder!.id);
  console.log('\nSeed complete. Set ELDER_ID env to:', elder!.id);
}

async function hashPhone(phone: string): Promise<string> {
  const enc = new TextEncoder().encode(phone);
  const hashBuf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
