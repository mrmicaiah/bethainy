# bethainy

Personal life assistant powered by Claude, running on Cloudflare Containers.

## Architecture

```
User → Chat PWA → Worker (gateway) → Container (AI service) → Claude API
                         ↓                      ↓
                       D1 (data)         mode files in memory
```

### Why Containers?

The container loads all mode instructions (diet plans, workout plans, mode behaviors) into memory at startup. When you send a message, Claude gets the FULL context in its system prompt — no tool-call indirection, no "I need to look that up."

This is the same architecture that works in the Claude.ai project, but now it's a standalone app.

### Wake-Up Experience

Containers sleep after 30 minutes of inactivity. When you open the app:
1. If awake: instant response
2. If sleeping: delightful wake-up animation (yawning, stretching, coffee)
3. Cold start takes 2-3 seconds

## Project Structure

```
bethainy/
├── worker/               # Cloudflare Worker (gateway)
│   ├── src/index.ts      # Routes + Container class
│   └── wrangler.toml     # Config with container binding
├── container/            # AI service container
│   ├── Dockerfile
│   ├── src/              # Express server + Claude client
│   └── modes/            # Mode instruction files
└── apps/chat/            # React PWA frontend
```

## Development

### Prerequisites

- Node.js 20+
- Docker (for container builds)
- Cloudflare account with Workers Paid plan

### Local Development

```bash
# Install dependencies
cd worker && npm install
cd ../container && npm install
cd ../apps/chat && npm install

# Start worker with container (Docker must be running)
cd worker
npx wrangler dev

# In another terminal, start frontend
cd apps/chat
npm run dev
```

### Deploy

```bash
# Set secrets
cd worker
npx wrangler secret put ANTHROPIC_API_KEY

# Deploy (builds and pushes container automatically)
npx wrangler deploy

# Deploy frontend
cd ../apps/chat
npm run build
npx wrangler pages deploy dist --project-name=bethainy-chat
```

## Modes

Modes are defined in `container/modes/`. Each mode has:
- `MODE.md` — Instructions for that mode
- Additional files like `diet-plan.md`, `workout-plan.md`

Currently active:
- **Fitness** — Workout tracking, meal guidance, body composition

Coming soon:
- Daily, People, Projects, Money, Journal, Learning, Maintenance, Shopping, Faith

## URLs

- **Worker**: https://bethainy.micaiah-tasks.workers.dev
- **Chat PWA**: https://bethainy-chat.pages.dev
