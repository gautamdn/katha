# Susheela — Pivot Design

**Date:** 2026-05-10
**Status:** Brainstorm complete; pending plan
**Author:** Gautam (with Claude as design partner)

---

## 1. Executive summary

Katha pivots from "elder records stories in a mobile app" to **"AI Susheela calls the elder weekly on their phone, captures stories, and the family receives them in a mobile app + web dashboard."** The pivot is inspired by familycall.care's outbound-calling model, which solves the dominant friction point of the original Katha design — elderly Indian grandparents are intimidated by smartphone apps but comfortable with phone calls.

Susheela is named after the founder's grandmother. The product's north star is a **persona feature**: someday, descendants can ask "what would Ajji say about this?" and get an answer grounded in her actual stories — eventually in her own voice. MVP ships the foundations of that persona (clean voice capture, structured wisdom tagging, retrieval Q&A) without yet shipping voice cloning or persona synthesis.

**Launch market:** India domestic + USA NRI families. Architected for global expansion later. Mainstream non-Indian American families are explicitly out of MVP scope.

**MVP languages:** Kannada, Gujarati, English (+ Hindi as a free side-effect via Sarvam).

---

## 2. Context: why this exists, and how it differs from familycall.care

### What familycall.care is
- AI assistant ("Asha") calls elderly parents on regular phones in 30+ languages.
- Captures stories → transcribes → compiles **monthly printed magazines** for the family.
- Wellness check-ins as a secondary value prop.
- Subscription: $9.99/mo (1 parent) → $29.99/mo (family). NRI corridor focused.
- Founder Rohan Thakkar's personal motivation (parents in India, him in US) is central to brand.

### What Susheela is, and why
Susheela borrows the outbound-calling acquisition model — because it works for the demographic — but reorganizes the product around three loops that compound toward a long-term moat the archive-and-magazine model can't reach.

### The three loops

1. **Capture loop (weekly):** Susheela calls → warm conversation in elder's language → audio + transcript + structured story metadata.
2. **Share loop (continuous + monthly):** Stories appear in family's mobile app and web dashboard → reactions → digests on demand + auto-monthly default → some stories sealed as time-capsules.
3. **Compound loop (always-on, persona-ready from day one):** Every call enriches a per-elder persona index — voice samples (cloning-quality), wisdom fragments tagged by situation/emotion, embeddings for retrieval. Loop 3 ships **retrieval Q&A** in MVP ("what did Ajji say about her wedding?"); voice cloning and full persona synthesis ship in Phases 2 and 3.

### Differentiators vs. FamilyCall
- **Time-capsule sealing:** any story can be sealed for a future unlock (child's milestone, anniversary). FamilyCall's monthly magazine is archival; Katha's time-capsule is heirloom.
- **Persona compounding:** every captured turn is structured for retrieval today and synthesis tomorrow. Switching cost is irreplaceable — the longer a family uses Susheela, the more her stories cohere into a living relationship.
- **On-demand digests with rich filters:** themed, recipient-targeted, occasion-presets, time-capsuleable. Magazine is a special case of digest, not the unit of value.
- **Susheela as the elder's sharing interface:** elder can ask Susheela on the call to send a story to a non-app person; Susheela queues a one-tap approval for a family member to send a private link. The elder shares without ever touching an app.
- **Voice biometric verification on every call:** silent voiceprint + soft fallback. Ensures persona data is the elder's voice, not a caretaker's. Important for both retrieval accuracy and future voice cloning integrity.

### Founder story
The product is named **Susheela** after Gautam's grandmother. The narrative — *"I couldn't capture her stories before she was gone, so I built Susheela so no one else loses theirs"* — is the brand and a real product asset for marketing.

---

## 3. Architecture: the three loops

### Loop 1 — Capture (weekly)
- Outbound calls in Kannada / Gujarati / English / Hindi.
- 10-15 min target, 25 min hard cap.
- Per-call output: full archival audio (lossless, encrypted), per-turn audio + transcript, 1-N stories, persona index entries, call summary, cost record.

### Loop 2 — Share (continuous + monthly)
- Stories surfaced in family mobile app and family web dashboard.
- Reactions, comments, share actions.
- **Digests on demand:** any family member can compile a digest with filters (date range, theme, people, recipient, occasion). Soft rate-limited.
- **Auto-monthly digest:** at month end, system auto-generates "[Month] with [Elder]" digest.
- Digests can themselves be sealed as time-capsules.
- **Sharing modes:**
  - A) Add the recipient to the family unit (existing app model).
  - B) Private share link (auth-less web viewer; expires; revocable). Triggered from app *or* from elder's voice request to Susheela on the call.
  - C) Public/social media share — **explicitly deferred past MVP**; when shipped, requires double opt-in (elder + family admin) and audio-cloning hardening.

### Loop 3 — Compound (always-on; partial in MVP, full in later phases)

| Phase | Loop 3 ships |
|---|---|
| MVP | **Q&A retrieval.** "What did Ajji say about her wedding?" returns excerpts + audio + dates. Backed by transcript + embeddings + Claude for ranking and answer assembly. |
| Phase 2 | **Voice cloning.** Same Q&A answer rendered in elder's voice. Requires explicit voice-cloning consent (captured at MVP; gated until Phase 2 ships). |
| Phase 3 | **Persona synthesis.** "What would Ajji say about a situation she never directly addressed?" RAG over her voiced stories + advice corpus + tone modeling. |

**Critical MVP discipline:** the persona index must be populated from Loop 1's first call. Voice samples must be archival-quality, voice-verified, and per-utterance metadata (theme, mood, advice/memory/opinion classification, embeddings) must be captured. If we skip this, we'll have a year of data that doesn't fuel the feature that matters most.

---

## 4. The first call: onboarding flow

### Family side (mobile app, ~5 minutes, one-time)
1. Family member signs up, creates a family unit, names elders to add.
2. For each elder: relationship label, native language, phone number, country, preferred name.
3. Family member records a **20-second voice intro** in their own language and voice. Re-record allowed. Suggested script provided; free-form encouraged.
4. Family picks first call time ("right now" or schedule).
5. Family confirms a clear consent screen on the elder's behalf (with note that final consent is captured on the call from the elder directly).

### Elder side (the actual phone call, ~3-5 minutes)
1. Phone rings. Caller ID is configurable (default: "Susheela / Family"). Number is stable, family-pre-told.
2. Elder picks up. **Family voice intro plays first** (~20 seconds, recorded earlier by the grandchild). This is the trust-earner.
3. Susheela takes over: *"Namaste [Nana ji], I'm Susheela. Rohan asked me to call so the family can hear your stories. May I ask a few small things first?"*
4. **Conversational consent** for: (a) recording, (b) family sharing, (c) preserving voice and stories for grandchildren and future generations [persona consent], (d) external sharing on elder's request. Each captured as a yes/no audio clip with timestamp + language. Elder can ask "what does that mean?" — Susheela answers warmly.
5. **Voiceprint enrollment** during the consent recording (no separate enrollment step).
6. If consent on (a) and (b): proceed to a *very gentle* first conversation, 3-5 min. Goal is to earn a second call, not extract content.
7. Susheela negotiates cadence on the call: *"Would you like me to call again next week, same time?"*
8. Closes warmly.

### Failure paths
- **No answer:** voicemail (family voice intro replays). Family alerted. Retry next day at +/- 1 hour. Three attempts, then pause + family alert.
- **Hangup:** family alerted with suggested next steps.
- **Persona consent declined:** Continues with (a) and (b). Stories captured, excluded from persona index. Family informed.
- **All consent declined:** Susheela closes warmly. No further calls scheduled. Family notified.
- **Language mismatch / confusion:** Susheela apologizes, offers to switch language, falls back to English greeting if all else fails, exits. Family alerted.

---

## 5. The recurring call: Susheela's playbook

### Pre-call (system prepares the call brief)
- Elder name, relationship label, language, preferred name.
- Last 2-3 call summaries.
- Family-suggested questions ("ask her about Bhuj before partition") — both automatic theme picking and family-suggested prompts supported, with automatic as default.
- This week's theme — picked from a queue with awareness of: themes already covered, season/festival context, upcoming family events, gaps in persona index.
- Voiceprint loaded.

### Call shape (10-15 min target)
1. **Greeting + verification** (~30 sec). Silent voiceprint check during first 5-10 sec.
2. **Personal callback** (~1 min). "Last week you mentioned X."
3. **Theme exploration** (~7-10 min). Open-ended question, organic follow-ups.
4. **Always-on cue listening:**
   - **Time-capsule cue** — *"save this for [name] when [milestone]"* → tag, gently confirm.
   - **Advice-shape cue** — *"what I'd tell young people…"* → tag as advice.
   - **Distress cue** — softens, offers to end gently, low-key family alert.
   - **Cadence cue** — schedule updates.
   - **Sharing cue** — *"I want my sister Saroj to hear this"* → queue elder-shared share request.
5. **Wind-down** (~1 min). Susheela acknowledges something specific, previews next call.
6. **Close** with confirmed next call.

### Per-call output
- **Raw archival audio** (16 kHz lossless or near-lossless, encrypted at rest).
- **Per-turn audio + transcript** with verification confidence.
- **One or more stories** — Claude post-processes to: title, polished_text, theme, mood, language, people_mentioned[], advice_extracted[], time_capsule_candidate, voice_verified, source_call_id, source_turn_ids[].
- **Persona index entries** for verified utterances (memory / opinion / advice / preference / relationship / event), with embeddings.
- **Call summary** for next call's brief and family feed.
- **Cost record** — minutes, provider charges.

### Susheela's character (lock this; system prompt)
- **Curious, never interrogating.** "Tell me more" over rapid-fire questions.
- **Honors silence.** 10-15 sec of elder thinking is fine.
- **Code-switches naturally.** Follows the elder's language mixing.
- **Uses honorifics naturally.** *Ji*, *amma*, *paati*, *nana*, *dada*, language-appropriate.
- **Never rushes.** Calls end on warmth, not on a timer.
- **Validates feelings.** "That must have been hard."
- **Never moralizes or contradicts.** Unfashionable views: neither agrees nor lectures; moves forward respectfully.
- **Remembers accurately.** Cites prior calls; never invents.

### Wellness alerts: light-touch, not a top-line feature
Distress is detected as a soft signal that triggers a gentle family alert ("Nana sounded a bit tired today, you might want to call him"). Not a wellness monitoring product — explicitly differentiated from FamilyCall's positioning. Family-side notifications are calm, non-alarmist, opt-in to expand if family wants more sensitivity.

---

## 6. Sharing beyond the family unit

Three distinct modes, sized differently.

### Mode A — Add to family (existing model)
For regular recipients (sister, distant cousin who'll engage often). Standard family-member invite. App install required.

### Mode B — Private share link (MVP)
Authless web page. Recipient (e.g., Ajji's sister Saroj) opens link in WhatsApp/SMS/email → sees story (transcript + audio + photos) on a clean web page. No account required. Expires (default 14 days, configurable). Revocable.

**Triggers:**
- **From the family app:** any family member can tap *Share* on a published story, choose contact, send via their own WhatsApp/SMS/email.
- **From Susheela on the call:** elder says *"I want Saroj to hear this."* Susheela responds: *"Of course. Would you like Rohan to send it to her?"* → queues a share-request that pings the named family member in their app for one-tap approval → link goes out. **Elder shared without touching an app.**

### Mode C — Public / social media share (out of MVP)
Posting elder voice on Instagram/Facebook has serious downstream issues — voice cloning by bad actors, brand-posture conflict with privacy-first messaging, separate consent gradient. Defer to Phase 2 at earliest. When shipped: double opt-in (elder + family admin), watermarked audio, transcript-only as default, visible "public share" badge in family app.

### Cross-cutting privacy guards (MVP)
- **Tiered audio fidelity.** Archival = 16 kHz lossless (in our infra only). App playback = 32-48 kbps Opus. External share = 24 kbps Opus + inaudible watermark. Voice cloning posture: cloning-quality audio never leaves our infrastructure.
- **Share log** with revocation, view counts, expiry.
- **Per-story privacy flag.** Default: family-only. Elder/family can mark `private-elder-only` (locked even from family) or `family-extended` (eligible for external private share with consent).

---

## 7. Data model

### Existing tables (kept)
- `families`, `profiles`, `children`, `capsules` (kept as SQL name; "story" is the noun in code/UI), `capsule_photos`, `reactions`, `prompt_history` (refocused: tracks themes Susheela has explored per elder).

### New tables

```
elders
  id (uuid, PK)
  family_id (uuid → families)
  display_name (text)
  relationship_label (text)
  preferred_name (text)
  language (text)                  -- 'kn' | 'gu' | 'en' | 'hi'
  phone_number (text, encrypted)
  country (text)                   -- 'IN' | 'US'
  timezone (text)
  added_by (uuid → profiles)
  voiceprint (jsonb)               -- embedding for verification
  voiceprint_enrolled_at (timestamptz)
  status (enum: 'pending_first_call' | 'active' | 'paused' | 'opted_out')
  created_at

elder_consents
  id (uuid, PK)
  elder_id (uuid → elders)
  consent_type (enum: 'recording' | 'family_sharing' | 'persona_use' | 'voice_cloning' | 'external_share')
  granted (bool)
  granted_at (timestamptz)
  audio_url (text)
  transcript (text)
  language (text)
  call_id (uuid → calls, nullable)

calls
  id (uuid, PK)
  elder_id (uuid → elders)
  family_id (uuid → families)
  scheduled_at (timestamptz)
  started_at, ended_at (timestamptz)
  status (enum: 'scheduled' | 'dialing' | 'in_progress' | 'completed' | 'voicemail' | 'no_answer' | 'declined' | 'failed')
  provider (text)
  provider_call_id (text)
  recording_url (text)
  recording_codec (text)
  transcript_url (text)
  theme (text)
  brief_json (jsonb)
  summary (text)
  next_call_suggested_at (timestamptz)
  duration_seconds (int)
  cost_cents (int)
  voice_verification_score (numeric)

call_turns
  id (uuid, PK)
  call_id (uuid → calls)
  speaker (enum: 'elder' | 'susheela')
  audio_clip_url (text)
  transcript (text)
  language (text)
  started_at_ms (int)
  ended_at_ms (int)
  voice_verification_score (numeric)
  cues (jsonb)                     -- {time_capsule, advice, distress, cadence, sharing_request}
  embedding (vector(1536))

capsules (existing, evolved — "story" in code/UI)
  ... existing columns retained ...
  source_call_id (uuid → calls)            -- new
  source_turn_ids (uuid[])                 -- new
  voice_verified (bool)                    -- new
  external_share_eligible (bool, default false)  -- new
  privacy_flag (enum: 'family' | 'private_elder_only' | 'family_extended')  -- new
  -- existing unlock_*/is_sealed/is_draft retained for time-capsules

share_links
  id (uuid, PK)
  capsule_id (uuid → capsules, nullable)
  digest_id (uuid → digests, nullable)
  created_by (uuid → profiles)
  recipient_label (text)
  channel (enum: 'whatsapp' | 'sms' | 'email' | 'copy')
  token (text, unique)
  expires_at (timestamptz)
  view_count (int)
  revoked_at (timestamptz, nullable)
  created_at

digests
  id (uuid, PK)
  family_id (uuid → families)
  elder_id (uuid → elders)
  type (enum: 'auto_monthly' | 'on_demand')
  filter_spec (jsonb)              -- {date_range, themes[], people[], recipient, occasion}
  capsule_ids (uuid[])
  pdf_url (text)
  status (enum: 'generating' | 'ready' | 'sealed_for_future')
  is_sealed (bool)
  unlock_at (timestamptz, nullable)
  generated_at (timestamptz)
  created_by (uuid → profiles)

persona_index
  id (uuid, PK)
  elder_id (uuid → elders)
  source_turn_id (uuid → call_turns)
  fact_type (enum: 'memory' | 'opinion' | 'advice' | 'preference' | 'relationship' | 'event')
  text (text)
  audio_clip_url (text)
  embedding (vector(1536))
  confidence (numeric)
  voice_verified (bool)
  language (text)
  created_at
```

### Migrations to apply (after existing 001-011)
- `012_elders_and_consents.sql`
- `013_calls_and_turns.sql` (incl. pgvector extension)
- `014_capsules_evolution.sql`
- `015_share_links_and_digests.sql`
- `016_persona_index.sql`

### What's removed / deprecated
- Elder-side draft/recording flows (`draftStore`, `useAudioRecorder`-driven self-recording for elders) deprecated as primary capture path. Code may remain dormant as fallback for elders who want to also record themselves directly. Removed from elder-facing UI.

---

## 8. Stack architecture

### Provider abstraction

```
apps/mobile/lib/calling/
  index.ts
  types.ts                        # Provider interface (client-side, mostly types)

supabase/functions/
  call-orchestrator/              # provider webhook target
  schedule-call/                  # cron + on-demand trigger
  generate-stories/               # post-call: turns → stories
  generate-digest/                # on-demand + auto-monthly cron
  qa-retrieval/                   # Loop 3 MVP: Q&A endpoint
  share-link/                     # mint + redeem private share links
  consent-recorder/               # capture + store on-call consent

packages/calling/                 # shared provider abstraction
  Provider.ts                     # interface
  providers/sarvam.ts             # MVP impl
  providers/twilio.ts             # US telephony
  providers/exotel.ts             # India telephony fallback
```

The `Provider` interface lets us swap Sarvam → roll-own without touching call-orchestration or storage logic.

### Audio fidelity policy
- **Archival audio:** 16 kHz mono, lossless or near-lossless. Encrypted. Cloning-eligible.
- **App playback audio:** 32-48 kbps Opus. Pleasant, small, unsuitable for cloning.
- **External share audio:** 24 kbps Opus + inaudible watermark.
- **Voice verification:** runs on archival audio.

**Critical day-1 verification:** does Sarvam expose archival-quality audio? If only compressed, we route call audio through Twilio/Exotel separately for archival capture.

### Telephony
- **India:** Sarvam-bundled if outbound supported; otherwise Sarvam-on-Exotel (DLT-compliant, ~₹0.30/min vs. Twilio's ~₹2/min for India outbound).
- **US:** Twilio. Same Susheela voice; only the dialer differs.
- **Provider selected per-call** based on elder's country.

### AI components
- **In-call orchestration:** Sarvam conversational agent with our system prompt + brief + theme.
- **Post-call processing:**
  - STT clean-up if needed (Sarvam STT, already in repo).
  - Claude Sonnet for: story extraction, polish, time-capsule cue confirmation.
  - Claude Haiku for: title/excerpt/theme/mood/read_time metadata (already wired up).
  - Embeddings: TBD — OpenAI text-embedding-3-small vs. Sarvam vs. Cohere.
- **Voice biometrics:** pyannote (open source) at MVP; revisit if Sarvam exposes a voiceprint API.

---

## 9. Web scope

Three jobs at MVP, deferred dashboard parity *included* per user decision.

### MVP web surface (Next.js on Vercel)

```
apps/web/
  app/
    page.tsx                      # marketing landing
    pricing/page.tsx
    story/page.tsx                # founder/Susheela origin story
    privacy/page.tsx
    terms/page.tsx
    signup/page.tsx               # onboarding + Stripe/Razorpay checkout
    s/[token]/page.tsx            # share-link viewer (auth-less)
    capsule/[token]/page.tsx      # unlocked time-capsule viewer (auth-less)
    (app)/                        # authed family dashboard
      layout.tsx
      page.tsx                    # feed
      susheela/page.tsx           # call schedule + recent + add-elder wizard
      ask/page.tsx                # Q&A retrieval over captured stories
      digests/page.tsx
      digests/[id]/page.tsx
      time-capsules/page.tsx
      family/page.tsx
      account/page.tsx            # profile + billing + consents
      shares/page.tsx             # elder-shared link approval inbox
```

### Build sequencing (so timeline can slip safely)
1. **Recipient-facing** (share viewer, unlocked time-capsule viewer) — critical path; build first.
2. **Marketing + sign-up + checkout** — required for launch; build second.
3. **Family web dashboard** — fast-follow if scope pressure. Mobile app covers it in the meantime.

### Code-sharing approach
Two UI codebases (Expo + Next.js), shared types/API/Zod schemas via `packages/shared/`. Avoid React Native Web for now.

### Billing
- **US:** Stripe (web checkout). Avoids 30% Apple/Google IAP cut.
- **India:** Razorpay (UPI is dominant). Stripe also supports India but Razorpay is locally preferred.
- Mobile in-app purchase optional / Phase 2.

---

## 10. Family-side mobile app changes

### Repurposed screens
- `app/(tabs)/home.tsx` → **Feed.** Stories from recent calls, reactions, "Ajji had a call yesterday" highlights.
- `app/(tabs)/record.tsx` → **Susheela.** Schedule next call, see upcoming, see recent. Add elder, manage cadence, suggest themes.
- `app/(tabs)/family.tsx` → manages elders + family members + invites.
- `app/(tabs)/profile.tsx` → unchanged conceptually.
- `app/capsule/[id].tsx` → **Story view.** Polished text, audio, photos, reactions, share, seal-as-time-capsule.

### New screens
- **First-call wizard.** Add elder, record family voice intro, pick cadence/time, send.
- **Digests.** List + "Create digest" with filters.
- **Ask Ajji** (Q&A retrieval — Loop 3 MVP).
- **Time-capsules.** Sealed stories/digests with countdowns.
- **Share inbox.** Elder-requested share approval prompts.

### Removed from elder-facing surface
- The record-yourself flow as primary capture (hooks/code remains as fallback).
- Self-publish / draft-edit elder UI.

### Notification posture
- New story posted; monthly digest ready; time-capsule unlocking soon; Susheela couldn't reach the elder; elder seemed distressed (gentle); share request pending.
- Respects quiet hours. Distress alert is gentle, opt-in to expand.

---

## 11. Phase plan

### MVP (this spec)
- Outbound calls (Sarvam-first, abstracted)
- Story capture + polish + persona-index population
- Family mobile app (repurposed)
- Family web dashboard (full parity, built last in sequence)
- Marketing site + sign-up + private share viewer
- On-demand digests + auto-monthly default
- Time-capsule sealing
- Q&A retrieval (Loop 3 MVP)
- Voice biometric verification (silent + soft fallback)
- Stripe (US) + Razorpay (India) billing

### Phase 2
- Voice cloning: Q&A answers spoken in elder's voice. Vendor TBD.
- Public/social share with double opt-in + cloning hardening.
- Additional MVP languages (Tamil, Telugu, Bengali, Marathi, Punjabi).
- Custom internal admin tool (replace Supabase Studio + Retool).
- Mobile in-app purchase optional.

### Phase 3
- Persona synthesis: "what would Ajji say?" via RAG + advice corpus + tone modeling + voice.
- Physical printed magazine (the FamilyCall feature; deliberately last).
- International expansion beyond India + US.

---

## 12. Pricing posture (sketch — defer final to launch)

| Tier | India (₹/mo) | US (USD/mo) | Calls | Family seats | Digest |
|---|---|---|---|---|---|
| Free trial | 14 days, no card | 14 days, no card | Up to 4 calls | Unlimited | Sample auto-monthly |
| Starter | ₹299 | $9.99 | 1 elder, weekly | 5 | Auto-monthly + 5 on-demand/month |
| Family | ₹699 | $24.99 | Up to 4 elders, unlimited | Unlimited | Auto-monthly + unlimited on-demand |

Numbers are placeholders. Final pricing requires market research and unit-economics validation against per-call cost.

---

## 13. Open questions / TBDs

1. **Trademark + domain:** susheela.ai / susheela.app / trysusheela.com. Social handles. Verify before public commit.
2. **Sarvam capability gaps:** archival audio quality? Voiceprint API? Outbound calling, or pair with Exotel/Twilio? — verify in design phase before stack lock.
3. **Voice cloning vendor (Phase 2):** Sarvam vs. ElevenLabs Pro vs. Cartesia.
4. **Embedding provider:** OpenAI text-embedding-3-small vs. Sarvam vs. Cohere.
5. **Pricing exact numbers:** India ₹299/₹699, US $9.99/$24.99 — sketch only; validate with market research.
6. **India payments:** Razorpay (UPI primary) vs. Stripe India. Likely Razorpay, abstracted with Stripe (US/RoW).
7. **Voice biometric tooling:** pyannote at MVP vs. waiting for Sarvam.
8. **Share-link recipient privacy:** is recipient phone/email stored, or just label? Legal review.
9. **Compliance:** COPPA (children's data), CA/IL biometric laws (voiceprints), GDPR (likely out at MVP), DPDP Act (India digital data — required for India elders). Privacy lawyer review before launch.
10. **Distress detection threshold:** tune in private beta with own family before broader rollout.
11. **Internal admin / moderation:** Supabase Studio + Retool at MVP; bespoke admin app in Phase 2.
12. **Content safety playbook:** what does Susheela do with distressing content (severe grief, discriminatory remarks, abuse hints)? Soft escalation playbook in implementation.

---

## 14. Out of scope (explicit)

The following are deliberately excluded from MVP. Listed so they don't surface as scope creep:

- Mainstream non-Indian American families as a target audience (Phase 3+).
- Public/social media sharing of stories (Phase 2 with hard gating).
- Voice cloning of elder responses (Phase 2).
- Persona synthesis / "what would Ajji say?" generative answers (Phase 3).
- Physical printed magazine (Phase 3).
- Wellness monitoring as a top-line feature (kept as a soft signal only).
- Additional regional languages beyond Kannada / Gujarati / English / Hindi (Phase 2).
- Custom internal admin tool (Phase 2; Supabase Studio + Retool at MVP).
- Mobile in-app purchase (web-billing primary; IAP Phase 2 optional).
- React Native Web code-sharing (build two codebases, share types).

---

## 15. Success criteria (what "MVP shipped" looks like)

- Gautam can add his Kannada-speaking and Gujarati-speaking elders as the first families.
- Each elder gets a successful first call: family voice intro plays, Susheela introduces herself in their language, conversational consent is captured with audio, voiceprint is enrolled, a 3-5 minute initial conversation happens.
- Subsequent weekly calls run on schedule, capture stories with voice verification, and produce capsules in the family's mobile app and web dashboard.
- Family members can react to capsules, create on-demand digests with filters, seal stories as time-capsules, and ask "what did Ajji say about X?" and get audio + transcript answers.
- Elder can ask Susheela on a call to share a story with someone outside the family; the named family member gets a one-tap approval and the recipient receives a private share link.
- Auto-monthly digest generates and delivers at month end.
- A non-family person (e.g., Ajji's sister) can open a share link in WhatsApp and read/listen to the story without an account.
- Billing works in both India (Razorpay) and US (Stripe).

---

*End of spec. Next step: implementation plan via the writing-plans skill.*
