# Katha: Family Stories, Forever

## Project Specification & Architecture

---

## 1. Vision

**Katha** is a voice-first, time-capsule family legacy app where grandparents, parents, and elders record stories, memories, and wisdom — preserved for children to unlock as they grow. Think of it as a living heirloom: part diary, part audio archive, part scrapbook, part time machine.

**App Store Positioning:** "Record your family's stories today. Your children will unwrap them tomorrow."

**Tagline:** Family Stories, Forever

---

## 2. Core Concept: Time Capsules

Every entry in Katha is a **capsule** — a rich memory unit that can contain:
- Written text (typed or voice-transcribed)
- Audio recording (the original voice)
- Photos (scrapbook-style)
- AI-generated metadata (title, tags, mood)

Capsules have an **unlock date** — they can be:
- 🔓 **Open now** — visible to family immediately
- 🔒 **Time-locked** — unlock on a specific date (child's 10th birthday, wedding day, etc.)
- 🎂 **Age-gated** — unlock when the child reaches a certain age
- 💌 **Event-triggered** — "Open when you're feeling sad", "Open on your first day of college"

---

## 3. User Roles & Multi-Writer Architecture

### Roles
| Role | Description | Permissions |
|------|-------------|-------------|
| **Elder/Writer** | Grandparent, parent, aunt/uncle | Create capsules, record audio, upload photos, set unlock dates |
| **Guardian** | Parent who manages the family | Invite writers, manage children profiles, moderate content, set notifications |
| **Child/Reader** | The recipient | Read unlocked capsules, listen to audio, react with emoji (age-appropriate UI) |

### Family Structure
```
Family (e.g., "The Sharma Family")
├── Guardian: Mom (manages everything)
├── Writers:
│   ├── Nani (maternal grandmother)
│   ├── Nana (maternal grandfather)
│   ├── Dadi (paternal grandmother)
│   └── Dada (paternal grandfather)
├── Children:
│   ├── Arya (age 7)
│   └── Veer (age 3)
```

Each writer gets their **own profile page** — a beautiful, personalized blog/diary view with their name, photo, relationship label, and all their capsules.

---

## 4. Feature Breakdown

### 4.1 Voice-First Recording
- **Tap-and-speak**: Big, friendly record button. Grandparents speak naturally.
- **Live transcription**: Whisper API or Deepgram for real-time speech-to-text.
- **AI polish**: Claude API cleans up transcription — fixes grammar, improves flow, but **preserves cultural expressions, code-switching, and multilingual phrases** (Hindi, Urdu, Telugu, Tamil, Punjabi, Bengali, etc.)
- **Original audio preserved**: The raw voice recording is saved alongside the polished text. The child can read AND hear their grandparent's actual voice.

### 4.2 AI-Powered Features
- **Writing polish**: Claude cleans grammar and flow while preserving voice, dialect, and cultural expressions
- **Smart prompts**: AI-generated conversation starters based on the writer's history and cultural context:
  - "Tell us about your wedding day"
  - "What was your favorite festival memory?"
  - "What did your mother teach you about cooking?"
  - "What was school like when you were young?"
  - Prompts rotate and adapt — never repeat, get deeper over time
- **Auto-metadata**: Title, category, excerpt, reading time, mood — all generated
- **Translation**: Optional — translate capsules so grandkids who don't speak the language can still read them

### 4.3 Time Capsule System
- **Unlock date picker**: Calendar-based or milestone-based
- **Milestone presets**: "First day of school", "Turning 13", "Turning 18", "Wedding day", "First child", "When they need encouragement"
- **Countdown display**: Locked capsules show a beautiful sealed envelope with countdown
- **Unlock notifications**: Push notification when a capsule unlocks — "Dadi wrote this for you 8 years ago 💛"
- **Surprise mode**: Writer can choose to hide that a capsule even exists until it unlocks

### 4.4 Photo/Scrapbook Integration
- Attach multiple photos per capsule
- Simple in-app annotation (captions, dates, who's in the photo)
- Photos displayed in a scrapbook-style layout within the capsule
- Support for scanning old physical photos (camera integration)

### 4.5 Family Tree / Timeline
- Visual family tree showing all writers and children
- Timeline view: a river of memories flowing from past to present
- Filter by writer, child, category, date range
- Beautiful visual — think horizontal scroll with year markers

### 4.6 Kid-Friendly Reading Mode
- Age-appropriate typography and colors
- Audio playback front and center (hear grandma's voice)
- Emoji reactions (❤️ 🤗 😂 🥺 ✨) instead of comments
- "Read to me" — text-to-speech for younger children who can't read yet
- Gentle animations, warm illustrations

### 4.7 Push Notifications
- "Nani just recorded a new story for you!"
- "A time capsule from Dada unlocks tomorrow! 🎁"
- "It's been 2 weeks — want to record a memory?" (gentle nudge for writers)
- Weekly digest for guardians

---

## 5. Tech Stack

### Mobile App (Primary)
| Layer | Technology |
|-------|-----------|
| Framework | **React Native + Expo** (SDK 52+) |
| Navigation | Expo Router (file-based routing) |
| State | Zustand + React Query (TanStack Query) |
| UI Components | Custom design system (no generic UI kit) |
| Animations | React Native Reanimated + Moshi |
| Audio Recording | expo-av |
| Image Picker | expo-image-picker |
| Push Notifications | expo-notifications + Expo Push Service |
| Auth | Supabase Auth (email/password + magic link) |

### Backend
| Layer | Technology |
|-------|-----------|
| Database | **Supabase** (PostgreSQL) — hosted, free tier generous |
| Auth | Supabase Auth |
| File Storage | Supabase Storage (audio files, photos) |
| API | Supabase Edge Functions (Deno) OR Express.js on Replit |
| AI | **Anthropic Claude API** (Sonnet for polish, Haiku for metadata) |
| Speech-to-Text | **Whisper API** (OpenAI) or **Deepgram** |
| Push | Expo Push Notifications |

### Why Supabase over raw PostgreSQL?
- Built-in auth, storage, real-time subscriptions
- Row-level security (each family sees only their data)
- Free tier handles a family app easily
- Great React Native SDK

---

## 6. Database Schema (Simplified)

```sql
-- Families
families (id, name, created_at, invite_code)

-- Users (all roles)
users (id, email, name, avatar_url, role, family_id, relationship_label, language_preferences)

-- Children (recipients of capsules)
children (id, name, date_of_birth, avatar_url, family_id)

-- Capsules (the core content)
capsules (
  id, 
  writer_id,          -- who wrote it
  child_id,           -- who it's for (nullable = for all children)
  
  -- Content
  raw_text,           -- original transcription or typed text
  polished_text,      -- AI-enhanced version  
  audio_url,          -- original voice recording
  
  -- AI-generated metadata
  title,
  excerpt,
  category,           -- e.g., "childhood", "wisdom", "festival", "recipe"
  mood,               -- e.g., "nostalgic", "joyful", "reflective"
  read_time_minutes,
  
  -- Time capsule
  unlock_type,        -- 'immediate', 'date', 'age', 'milestone'
  unlock_date,        -- specific date
  unlock_age,         -- child's age to unlock
  unlock_milestone,   -- e.g., "wedding", "first_child", "feeling_sad"
  is_surprise,        -- hide existence until unlock
  is_unlocked,        -- computed/updated by cron
  
  -- Meta
  is_private,
  language,
  created_at,
  published_at
)

-- Capsule Photos
capsule_photos (id, capsule_id, photo_url, caption, order)

-- Reactions (from children)
reactions (id, capsule_id, child_id, emoji, created_at)

-- AI Prompts (tracking which prompts have been shown)
prompt_history (id, writer_id, prompt_text, shown_at, used)

-- Family Tree Relationships
family_relationships (id, family_id, person_id, related_to_id, relationship_type)
```

---

## 7. App Screen Map

```
Auth
├── Welcome / Onboarding (3 warm slides)
├── Sign Up (as Guardian, Writer, or join via invite)
└── Sign In

Guardian Flow
├── Home (family feed — latest capsules across all writers)
├── Family Setup
│   ├── Add Children (name, DOB, photo)
│   ├── Invite Writers (share invite code/link)
│   └── Family Tree Editor
├── Child Profile (capsules for this child, timeline)
├── Writer Profiles (see each grandparent's page)
├── Settings
│   ├── Notifications
│   ├── Family Management
│   └── Privacy

Writer Flow
├── Home (their capsules + AI prompt of the day)
├── Record / Write
│   ├── Voice Recording (big mic button)
│   ├── Text Editor (simple, large fonts)
│   ├── Photo Attachment
│   ├── Choose Recipient (which child, or all)
│   ├── Set Unlock (time capsule options)
│   └── Preview & Publish (AI polish shown as diff)
├── My Stories (all their capsules)
├── Prompts Library (browse prompt categories)
└── Profile (their page as others see it)

Child/Reader Flow
├── Home (unlocked capsules, beautifully displayed)
├── New Unlock! (celebration animation)
├── Capsule View
│   ├── Read text
│   ├── Play audio (grandparent's voice)
│   ├── Photo gallery
│   └── React with emoji
├── Timeline (visual river of memories)
├── By Writer (Nani's stories, Dada's stories, etc.)
└── Locked Capsules (sealed envelopes with countdowns)
```

---

## 8. Design Direction

### Aesthetic: "Warm Heritage Modern"
A blend of warmth and cultural richness with clean modern UI.

- **Color palette**: Warm ambers, terracotta, cream, deep teal, gold accents — like aged paper and silk
- **Typography**: 
  - Display: A serif with character (e.g., Playfair Display, or a Devanagari-friendly display font)
  - Body: Clean, highly readable sans (e.g., Source Sans 3)
  - Cultural: Support for Devanagari, Arabic, Tamil, Telugu scripts
- **Imagery**: Soft watercolor textures, hand-drawn flourishes, sealed envelope metaphor for locked capsules
- **Animations**: Gentle — envelope opening, ink flowing, pages turning. Nothing jarring.
- **Audio player**: Custom — prominent, warm, with waveform visualization of grandparent's voice
- **Locked capsules**: Beautiful sealed envelopes with wax seal aesthetic, countdown timer

### Key Design Principle
> "This should feel like opening a hand-written letter, not using an app."

---

## 9. AI Integration Details

### Claude API Usage

**1. Writing Polish (claude-sonnet-4-20250514)**
```
System: You are a gentle editor for a family legacy journal. 
The writer is an elder recording memories for their grandchildren.

Rules:
- Fix grammar and improve flow
- PRESERVE all cultural expressions, proverbs, and code-switching
- Keep Hindi/Urdu/Telugu/Tamil/Punjabi words and phrases intact
- Maintain the writer's natural voice and warmth
- Don't make it sound "professional" — keep it personal
- Preserve humor, dialect, and colloquialisms
- If they mix languages (e.g., Hinglish), keep the mix
```

**2. Metadata Generation (claude-haiku-4-5-20251001)**
- Title, category, excerpt, mood, read time
- Fast and cheap — runs on every publish

**3. Smart Prompts (claude-sonnet-4-20250514)**
- Generate culturally relevant prompts based on:
  - Writer's language preferences
  - Previous entries (avoid repetition)
  - Time of year (festivals, seasons)
  - Children's ages and milestones
  - Family context

**4. Optional Translation**
- Translate capsules for grandkids who don't speak the language
- Preserve the soul of the original — not a literal translation

---

## 10. Development Phases

### Phase 1: MVP (Weeks 1-4)
Core writing and reading experience:
- [ ] Expo project setup with Expo Router
- [ ] Supabase integration (auth, database, storage)
- [ ] Writer auth (email + password)
- [ ] Simple text capsule creation
- [ ] AI polish via Claude API
- [ ] Basic capsule feed (list view)
- [ ] Writer profile pages
- [ ] Family & children setup

### Phase 2: Voice & Time Capsules (Weeks 5-8)
The differentiators:
- [ ] Voice recording with expo-av
- [ ] Speech-to-text integration
- [ ] Audio preservation & playback
- [ ] Time capsule unlock system (date-based)
- [ ] Locked capsule UI (sealed envelopes)
- [ ] Unlock notifications
- [ ] AI-generated prompts

### Phase 3: Rich Media & Family (Weeks 9-12)
Polish and delight:
- [ ] Photo attachment & scrapbook layout
- [ ] Family tree visualization
- [ ] Timeline view
- [ ] Kid-friendly reading mode
- [ ] Emoji reactions
- [ ] Push notifications
- [ ] Age-gated & milestone unlocks

### Phase 4: App Store Launch (Weeks 13-16)
Ship it:
- [ ] Design polish & animations
- [ ] Onboarding flow
- [ ] App Store assets (screenshots, description, preview video)
- [ ] TestFlight beta with family
- [ ] Privacy policy & terms
- [ ] App Store submission
- [ ] Landing page / website

---

## 11. Monetization (Future)

| Model | Details |
|-------|---------|
| **Free tier** | 1 family, 3 writers, 50 capsules, 10 audio minutes/month |
| **Katha Plus** ($4.99/mo) | Unlimited capsules, unlimited audio, translation, priority AI |
| **Katha Forever** ($49.99 one-time) | Lifetime access, family data export, printed book generation |
| **Gift model** | "Gift Katha to your parents" — pay for their subscription |

---

## 12. Replit Development Setup

```
katha/
├── apps/
│   └── mobile/              # Expo React Native app
│       ├── app/             # Expo Router pages
│       ├── components/      # Shared components
│       ├── lib/             # API clients, utils, AI
│       ├── hooks/           # Custom hooks
│       ├── stores/          # Zustand stores
│       ├── theme/           # Design tokens, colors, fonts
│       └── assets/          # Images, sounds
├── packages/
│   └── shared/              # Shared types, schemas
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── functions/           # Edge functions (AI endpoints)
└── docs/                    # This spec, API docs
```

---

## 13. Privacy & Safety

This app handles **children's data** — extra care required:
- COPPA compliance (if targeting US)
- No direct messaging between users
- All content moderated by Guardian role
- Audio stored encrypted
- Family data isolated via Supabase RLS
- Data export & deletion available
- Privacy policy must be thorough

---

*This is a living document. Update as the project evolves.*
