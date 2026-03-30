# bethainy v2 — Status Report

**Date:** March 30, 2026

## What Changed

### Architecture Shift: Worker → Container

**Before (broken):**
```
User → Worker → Claude API (with tool calls for context)
```

**After (should work):**
```
User → Worker (gateway) → Container (AI service) → Claude API
                                    ↓
                            mode files in memory
```

### Why Containers?

The original problem: Claude wasn't following mode instructions because it had to *fetch* them via tool calls, and tool responses don't get read with the same depth as system prompt content.

The container solves this by:
1. Loading all mode files at startup
2. Building a FULL system prompt with diet plans, workout plans, mode instructions
3. Claude gets everything in context — no tool-call indirection

This is the same architecture that works in the Claude.ai project.

### Delightful Wake-Up Experience

Containers sleep after 30 minutes of inactivity. When waking:
- 15 different random wake-up sequences
- Yawning, stretching, coffee, games, meditation, workouts...
- Progress dots show how close we are
- Smooth fade transitions between states

This turns a potential UX problem (2-3 second cold start) into a charming personality feature.

## Files Created/Modified

### Container Service (`container/`)
- `Dockerfile` — Node.js 20 Alpine image
- `package.json` — Hono + Anthropic SDK
- `src/index.ts` — Express-like server with detailed logging
- `src/claude.ts` — Claude API client
- `src/context.ts` — Loads mode files, builds system prompts
- `modes/` — All mode instruction files

### Worker Gateway (`worker/`)
- `wrangler.toml` — Container binding configuration
- `src/index.ts` — BethainyContainer class, routing
- Uses `@cloudflare/containers` package

### Chat PWA (`apps/chat/`)
- `src/components/WakeUpAnimation.tsx` — 15 random sequences
- `src/components/Chat.tsx` — Container state management
- `src/lib/api.ts` — Wake endpoint, message sending
- `src/index.css` — Float animation, transitions

### Documentation
- `README.md` — Project overview
- `DEPLOY.md` — Step-by-step deployment guide
- `STATUS.md` — This file

## Next Steps

### 1. Deploy and Test
```bash
cd worker
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
```

### 2. Verify Fitness Mode
Test these interactions:
- "Ready for lunch" → Should tell you Meal 2
- "I'm at the gym" → Should start workout flow
- "What's for dinner" → Should tell you Meal 4

### 3. Add More Modes
Once fitness is working, add:
- Daily mode (`container/modes/daily/`)
- People mode (`container/modes/people/`)
- etc.

### 4. D1 Integration
Container needs to read/write:
- Workout logs
- Meal logs
- Body composition

Options:
- Container calls Worker API endpoints
- Container has direct D1 binding (if Cloudflare supports this)

## Known Limitations

1. **Single container for all users** — Currently using `getContainer()` without user-specific routing. Fine for personal use.

2. **No conversation persistence** — Frontend holds conversation history in memory. Refresh = lost.

3. **Cold start visibility** — Wake animation plays while polling, but first real message might still have a delay.

4. **Container limits** — Beta limits: 40 GiB memory, 40 vCPUs total across all instances.
