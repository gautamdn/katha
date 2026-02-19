# कथा Katha

**Family Stories, Forever**

A voice-first, time-capsule family legacy app where grandparents and elders record stories, memories, and wisdom — preserved for children to unlock as they grow.

## Quick Start

### Prerequisites
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- iOS Simulator (Xcode) or Expo Go app

### Setup

1. **Clone and install**
   ```bash
   git clone <your-repo-url> katha
   cd katha/apps/mobile
   npm install
   ```

2. **Set up Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run the migration: `npx supabase db push`
   - Copy your project URL and anon key

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Fill in your Supabase URL, anon key, and API keys
   ```

4. **Start developing**
   ```bash
   npx expo start
   ```

### Using Claude Code

This project is designed to be built with [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview). The `CLAUDE.md` file contains comprehensive project context including architecture, database schema, design system, and development phases.

```bash
# From the project root:
claude
```

Claude Code will read CLAUDE.md automatically and understand the full project context.

## Tech Stack

- **Mobile:** React Native + Expo (SDK 52), Expo Router
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI:** Anthropic Claude API (writing polish, metadata, prompts)
- **Speech:** OpenAI Whisper (voice-to-text)

## License

MIT
