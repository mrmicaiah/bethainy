# bethainy

Personal life assistant powered by Claude, running on Cloudflare Containers.

## Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │         Container (AI)              │
                                    │  ┌─────────────────────────────┐    │
User ──► Chat PWA ──► Worker ──────►│  │  Mode files in memory       │    │
                        │           │  │  (CLAUDE-INSTRUCTIONS.md,   │    │
                        │           │  │   diet-plan.md, etc.)        │    │
                        │           │  └─────────────────────────────┘    │
                        │           │              │                      │
                        │           │              ▼                      │
                        │           │  ┌─────────────────────────────┐    │
                        │           │  │  Claude API                  │    │
                        │           │  │  (Full context in prompt)    │    │
                        │           │  └─────────────────────────────┘    │
                        │           │              │                      │
                        │           │              ▼                      │
                        │  ◄────────┼──  Data Client (callbacks)          │
                        │           └─────────────────────────────────────┘
                        │
                        ▼
                   D1 Database
                   (tracks, entries, daily, settings)
```

### Data Flow

1. **User sends message** → Chat PWA → Worker
2. **Worker authenticates** → Forwards to Container with user token
3. **Container detects mode** → Loads relevant user data from D1 (via Worker callback)
4. **Container builds system prompt** → Mode instructions + plans + user data
5. **Container calls Claude** → Full context in prompt, no tool indirection
6. **Claude responds** → Container returns to user
7. **Container logs data** → Writes to D1 via Worker callback

### Why Containers?

Claude gets the FULL context in its system prompt:
- Mode instructions (how to behave)
- Plans (diet plan, workout plan)
- User data (today's meals, recent workouts)

No tool-call indirection. Claude reads everything directly.

### Wake-Up Experience

Containers sleep after 30 minutes of inactivity. When waking:
- 15 different random wake-up animations
- Yawning, stretching, coffee, games, meditation...
- 2-3 second cold start feels charming, not annoying

## Data Structure

Mirrors the `my-life` repo file structure:

```
D1 Tables                    ↔  my-life Repo
─────────────────────────────────────────────
tracks                       ↔  */tracks/*.json
entries                      ↔  */YYYY-MM-DD.json
daily_notes                  ↔  daily/notes.json
daily_plans                  ↔  daily/plans/YYYY-MM-DD.json
user_settings                ↔  (custom plans, preferences)
```

### Tracks

The core unit. Each track is like a file in `my-life/*/tracks/*.json`:
- People: Sarah, Mom, Jim
- Projects: Raimpage, Client Work
- Shopping: Lowe's, Walmart
- Learning: Python Course, Machine Learning
- Fitness: PPL Strength, Nutrition

### Entries

Dated logs. Like files in `my-life/*/YYYY-MM-DD.json`:
- `workout` — Gym session
- `meal` — What was eaten
- `journal` — Journal entry
- `expense` — Money spent
- `body_composition` — Weigh-in

## Development

```bash
# Install
cd worker && npm install
cd ../container && npm install
cd ../apps/chat && npm install

# Run migrations
cd worker
npx wrangler d1 execute bethainy --local --file=../schema/001_initial.sql
npx wrangler d1 execute bethainy --local --file=../schema/002_mode_system.sql

# Start (Docker must be running)
npx wrangler dev

# Frontend (separate terminal)
cd apps/chat && npm run dev
```

## Deploy

```bash
# Set secrets
cd worker
npx wrangler secret put ANTHROPIC_API_KEY

# Run migrations on production
npx wrangler d1 execute bethainy --remote --file=../schema/001_initial.sql
npx wrangler d1 execute bethainy --remote --file=../schema/002_mode_system.sql

# Deploy worker + container
npx wrangler deploy

# Deploy frontend
cd ../apps/chat
npm run build
npx wrangler pages deploy dist --project-name=bethainy-chat
```

## URLs

- **Worker**: https://bethainy.micaiah-tasks.workers.dev
- **Chat PWA**: https://bethainy-chat.pages.dev
