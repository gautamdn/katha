# Katha: Family Stories, Forever

## What is this?

Katha is a voice-first, time-capsule family legacy app. Grandparents and elders record stories, memories, and wisdom — preserved as "capsules" for children to unlock as they grow up. Think: audio diary meets time capsule meets family scrapbook.

**App Store positioning:** "Record your family's stories today. Your children will unwrap them tomorrow."

## Tech Stack

- **Mobile:** React Native + Expo (SDK 54), Expo Router v6 (file-based routing)
- **State:** Zustand (global state) + TanStack React Query (server state)
- **UI:** Custom design system — NO generic UI kits. Warm heritage-modern aesthetic.
- **Animations:** React Native Reanimated 4 (Moti deferred to Phase 4)
- **Audio:** expo-av for recording & playback
- **Images:** expo-image-picker
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI:** Anthropic Claude API (Sonnet for polish/prompts, Haiku for metadata)
- **Speech-to-Text:** OpenAI Whisper API or Deepgram
- **Push:** expo-notifications + Expo Push Service
- **Language:** TypeScript everywhere, strict mode

## Key Commands

```bash
# Install dependencies
cd apps/mobile && npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run Supabase locally (if using local dev)
npx supabase start

# Push DB migrations
npx supabase db push

# Generate Supabase types
npx supabase gen types typescript --local > packages/shared/database.types.ts

# Build for App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

## Project Structure

```
katha/
├── CLAUDE.md                 # THIS FILE - project context for Claude Code
├── apps/
│   └── mobile/               # Expo React Native app
│       ├── app/              # Expo Router file-based routes
│       │   ├── _layout.tsx   # Root layout (providers, fonts, theme)
│       │   ├── index.tsx     # Splash/redirect
│       │   ├── (auth)/       # Auth screens (welcome, sign-in, sign-up)
│       │   ├── (tabs)/       # Main tab navigator
│       │   │   ├── _layout.tsx
│       │   │   ├── home.tsx        # Family feed / writer home
│       │   │   ├── record.tsx      # Voice recording / writing screen
│       │   │   ├── capsules.tsx    # My capsules (writer) / unlocked capsules (child)
│       │   │   ├── family.tsx      # Family tree / members
│       │   │   └── profile.tsx     # User profile & settings
│       │   ├── capsule/[id].tsx    # Single capsule view
│       │   ├── writer/[id].tsx     # Writer profile page
│       │   └── child/[id].tsx      # Child's capsule collection
│       ├── components/
│       │   ├── ui/           # Design system primitives (Button, Text, Card, Input, etc.)
│       │   ├── capsule/      # CapsuleCard, CapsuleView, LockedCapsule, TimeCapsulePicker
│       │   ├── writer/       # WriterProfile, WriterCard
│       │   ├── family/       # FamilyTree, ChildCard, InviteWriter
│       │   └── audio/        # AudioRecorder, AudioPlayer, Waveform
│       ├── lib/
│       │   ├── supabase.ts   # Supabase client init
│       │   ├── api.ts        # API helper functions
│       │   ├── ai.ts         # Claude API calls (polish, metadata, prompts)
│       │   ├── audio.ts      # Audio recording/playback utilities
│       │   └── constants.ts  # App constants
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useCapsules.ts
│       │   ├── useAudioRecorder.ts
│       │   ├── useFamily.ts
│       │   └── useTimeCapsule.ts
│       ├── stores/
│       │   ├── authStore.ts
│       │   ├── draftStore.ts    # Auto-save drafts
│       │   └── recordingStore.ts
│       ├── theme/
│       │   ├── colors.ts
│       │   ├── typography.ts
│       │   ├── spacing.ts
│       │   └── index.ts
│       └── assets/
├── packages/
│   └── shared/
│       ├── types.ts          # Shared TypeScript types
│       ├── schema.ts         # Zod validation schemas
│       └── database.types.ts # Auto-generated Supabase types
├── supabase/
│   ├── config.toml
│   ├── migrations/           # SQL migration files
│   └── functions/            # Supabase Edge Functions
│       ├── ai-polish/        # Claude API: polish writing
│       ├── generate-metadata/# Claude API: title, category, mood
│       └── smart-prompts/    # Claude API: generate prompts for writers
└── docs/
    └── katha-spec.md         # Full product specification
```

## Database Schema

The database uses Supabase (PostgreSQL) with Row Level Security (RLS).

### Core Tables

**families** — A family unit
- id (uuid, PK), name (text), invite_code (text, unique), created_by (uuid → auth.users), created_at

**profiles** — Extended user info (linked to auth.users)
- id (uuid, PK, → auth.users), family_id (uuid → families), display_name (text), avatar_url (text), role (enum: 'guardian', 'writer', 'reader'), relationship_label (text, e.g. "Nani", "Dada", "Mom"), language_preferences (text[]), bio (text), created_at

**children** — Recipients of capsules
- id (uuid, PK), family_id (uuid → families), name (text), date_of_birth (date), avatar_url (text), created_at

**capsules** — The core content unit
- id (uuid, PK), writer_id (uuid → profiles), family_id (uuid → families), child_id (uuid → children, nullable = for all children)
- raw_text (text), polished_text (text), audio_url (text), audio_duration_seconds (int)
- title (text), excerpt (text), category (text), mood (text), read_time_minutes (int)
- unlock_type (enum: 'immediate', 'date', 'age', 'milestone'), unlock_date (timestamptz), unlock_age (int), unlock_milestone (text), is_surprise (bool), is_unlocked (bool, default false)
- is_private (bool, default false), is_draft (bool, default true), language (text)
- created_at, published_at

**capsule_photos** — Photos attached to capsules
- id (uuid, PK), capsule_id (uuid → capsules), photo_url (text), caption (text), display_order (int)

**reactions** — Child emoji reactions
- id (uuid, PK), capsule_id (uuid → capsules), user_id (uuid → profiles), emoji (text), created_at

**prompt_history** — Track AI prompts shown to writers
- id (uuid, PK), writer_id (uuid → profiles), prompt_text (text), category (text), was_used (bool), shown_at, used_at

## Design System — "Warm Heritage Modern"

### Philosophy
> "This should feel like opening a hand-written letter, not using an app."

### Colors
```typescript
const colors = {
  // Primary — warm amber/gold
  amber: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
  // Secondary — deep teal
  teal: { 50: '#F0FDFA', 100: '#CCFBF1', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59', 900: '#134E4A' },
  // Warm neutrals — cream to deep brown
  cream: '#FFF8F0',
  parchment: '#F5ECD7',
  warm: { 100: '#F5F0EB', 200: '#E8DFD5', 300: '#D4C5B5', 700: '#6B5B4E', 800: '#4A3F35', 900: '#2D2420' },
  // Accent — terracotta
  terracotta: { 400: '#E07A5F', 500: '#CD5C45', 600: '#B84A35' },
  // Functional
  success: '#059669',
  error: '#DC2626',
  locked: '#8B7355',    // sealed envelope brown
}
```

### Typography
- **Display/Headings:** Serif with character — Playfair Display or similar
- **Body:** Clean readable — Source Sans 3 or similar
- **Must support:** Devanagari, Arabic/Nastaliq, Tamil, Telugu, Bengali scripts
- **Writer quotes/excerpts:** Italic serif, slightly larger, warm color

### Key UI Metaphors
- **Capsules:** Appear as warm cards with subtle paper texture
- **Locked capsules:** Sealed envelope with wax seal, countdown timer
- **Unlocking animation:** Envelope opens, light spills out, content reveals
- **Audio player:** Prominent, warm, with voice waveform visualization
- **Writer profiles:** Like a personal journal cover — their photo, name, relationship label
- **Timeline:** Horizontal river of memories with year markers

### Animations (React Native Reanimated)
- Page transitions: Gentle fade + slide
- Capsule cards: Staggered entrance on scroll
- Record button: Pulsing glow while recording
- Unlock: Multi-step envelope-opening celebration
- Audio waveform: Real-time visualization during playback

## AI Integration

### 1. Writing Polish (claude-sonnet-4-20250514)
Called via Supabase Edge Function when writer publishes.

System prompt principles:
- Fix grammar, improve flow
- PRESERVE cultural expressions, proverbs, code-switching
- Keep Hindi/Urdu/Telugu/Tamil/Punjabi/Bengali words intact
- Maintain natural voice and warmth — don't make it "professional"
- Preserve humor, dialect, colloquialisms
- If they mix languages (Hinglish, Tenglish), keep the mix

### 2. Metadata Generation (claude-haiku-4-5-20251001)
Auto-generate: title, category, excerpt, mood, read_time.
Run on every publish. Fast and cheap.

### 3. Smart Prompts (claude-sonnet-4-20250514)
Generate culturally relevant writing prompts. Consider:
- Writer's language preferences and cultural background
- Previous entries (don't repeat topics)
- Time of year (festivals, seasons)
- Children's ages and upcoming milestones
- Categories not yet covered

### 4. Translation (optional, claude-sonnet-4-20250514)
Translate capsules while preserving emotional tone and cultural context.

## Environment Variables

```
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Anthropic (used in Edge Functions only, NOT in client)
ANTHROPIC_API_KEY=

# Whisper/Deepgram (used in Edge Functions)
OPENAI_API_KEY=        # for Whisper
# or DEEPGRAM_API_KEY=

# Expo
EXPO_PUBLIC_APP_NAME=Katha
```

## Development Phases

### Phase 1: MVP (Current — mostly complete)
Focus: Core writing and reading experience
- [x] Project scaffold
- [x] Supabase setup (auth, database, storage, RLS policies)
- [x] Auth flow (sign up as Guardian/Writer, sign in, sign out)
- [x] Family creation (invite codes) & join family flow
- [x] Text capsule creation (write → AI polish → publish pipeline)
- [x] Capsule feed (home screen, FlatList of published capsules)
- [x] Single capsule view (capsule/[id].tsx)
- [x] Writer profile page (writer/[id].tsx)
- [x] Auto-save drafts (Zustand + AsyncStorage, 2s debounce)
- [x] Child profiles (add children, child selector on write screen)
- [x] "My Stories" tab (drafts + published)
- [x] Family screen (members, children, invite code)
- [x] Profile screen (view/edit, sign out)
- [x] generate-metadata Edge Function (Claude Haiku)
- [ ] End-to-end testing of publish pipeline (needs AI keys configured)
- [ ] Profile/family screens polish (e.g. avatar images)

### Phase 2: Voice & Time Capsules
- [ ] Voice recording (expo-av)
- [ ] Speech-to-text (Whisper API via Edge Function)
- [ ] Audio preservation & custom player
- [ ] Time capsule system (date-based unlock)
- [ ] Locked capsule UI (sealed envelope)
- [ ] Unlock cron job / trigger
- [ ] AI-generated writing prompts

### Phase 3: Rich Media & Family Features
- [ ] Photo attachment & scrapbook layout
- [ ] Family tree visualization
- [ ] Timeline view
- [ ] Kid-friendly reading mode
- [ ] Emoji reactions
- [ ] Push notifications
- [ ] Age-gated & milestone unlocks
- [ ] Invite writers flow

### Phase 4: App Store Launch
- [ ] Design polish & animations
- [ ] Onboarding flow (3 warm slides)
- [ ] App Store assets
- [ ] TestFlight beta
- [ ] Privacy policy (COPPA compliance — app involves children)
- [ ] App Store submission

## Important Notes

1. **COPPA compliance:** This app handles children's data. No direct messaging. All content moderated by Guardian. Audio stored encrypted. Thorough privacy policy required.
2. **API keys in Edge Functions ONLY:** Never expose ANTHROPIC_API_KEY or OPENAI_API_KEY in the React Native client. All AI calls go through Supabase Edge Functions.
3. **Offline-first thinking:** Writers (grandparents) may have spotty internet. Drafts save locally. Audio records locally. Sync when connected.
4. **Accessibility:** Large tap targets, large fonts by default, high contrast. These users may be elderly with vision/motor challenges.
5. **Multi-language support:** The app UI should support LTR and RTL. Content can be in any language. AI preserves all languages.

## RLS Architecture Notes

Supabase RLS policies use a `SECURITY DEFINER` helper function to avoid infinite recursion:

```sql
-- profiles policies reference profiles → infinite recursion.
-- Solution: bypass-RLS helper function.
CREATE FUNCTION get_my_family_id() RETURNS UUID AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

All family-scoped SELECT policies use `get_my_family_id()` instead of subquerying `profiles`.

The `handle_new_user()` trigger requires `SET search_path = public` to resolve the `profiles` table and `user_role` enum.

Migrations applied (in order):
1. `001_initial_schema.sql` — tables, indexes, RLS, trigger
2. `002_join_family_rpc.sql` — SECURITY DEFINER RPC for invite code lookup
3. `003_fix_profile_select_rls.sql` — "Users can view own profile" policy
4. `004_fix_rls_recursion.sql` — Replace recursive policies with `get_my_family_id()`
5. `005_fix_trigger_function.sql` — Fix trigger search_path + error handling
6. `006_fix_family_creator_select.sql` — Allow family creator to SELECT their family
