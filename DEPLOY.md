# Deployment Guide

## First-Time Setup

### 1. Create D1 Database (if not exists)

```bash
cd worker
npx wrangler d1 create bethainy
```

Update the database ID in `worker/wrangler.toml`.

### 2. Run Database Migrations

```bash
npx wrangler d1 execute bethainy --remote --file=../schema/001_initial.sql
```

### 3. Set Secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# Enter your Anthropic API key when prompted
```

### 4. Deploy Worker + Container

```bash
cd worker
npx wrangler deploy
```

This will:
- Build the container image from `../container/Dockerfile`
- Push to Cloudflare's container registry
- Deploy the worker with container binding

First deploy takes longer (image build). Subsequent deploys reuse cached layers.

### 5. Deploy Frontend

```bash
cd apps/chat
npm run build
npx wrangler pages deploy dist --project-name=bethainy-chat
```

## Updating

### Update Container Code (mode files, AI service)

```bash
cd worker
npx wrangler deploy
```

### Update Frontend Only

```bash
cd apps/chat
npm run build
npx wrangler pages deploy dist --project-name=bethainy-chat
```

### Update Worker Only (no container changes)

Currently, any `wrangler deploy` rebuilds the container. This is expected to improve in future Cloudflare updates.

## Monitoring

### View Logs

```bash
cd worker
npx wrangler tail
```

### Check Container Status

```bash
npx wrangler containers list
```

### Dashboard

Containers: https://dash.cloudflare.com/?to=/:account/workers/containers

## Troubleshooting

### Container not starting

1. Check Docker is running locally (needed for build)
2. Check logs: `npx wrangler tail`
3. Verify ANTHROPIC_API_KEY is set: `npx wrangler secret list`

### 503 errors

Container is waking up. The frontend handles this with the wake-up animation. If persistent:
1. Check container logs in dashboard
2. Verify port 8080 is exposed in Dockerfile

### Mode not working correctly

1. Check mode files in `container/modes/`
2. Redeploy: `npx wrangler deploy`
3. Container reloads files on restart
