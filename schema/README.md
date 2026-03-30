# bethainy D1 Schema

Mirrors the `my-life` repo file structure for multi-user support.

## Tables

### `users`
User accounts (from 001_initial.sql)

### `tracks`
The core unit. Each track is like a file in `my-life/*/tracks/*.json`.

Examples:
- People: Sarah, Mom, Jim
- Projects: Raimpage, Client Work
- Shopping: Lowe's, Walmart, Amazon
- Learning: Python Course, Machine Learning
- Maintenance: 2020 Toyota Camry, House
- Fitness: PPL Strength, Nutrition, Morning Cardio
- Faith: Exodus Reading, Romans Study
- Money: Clean Eating Costs, Backyard Project

### `entries`
Dated logs. Like files in `my-life/*/YYYY-MM-DD.json`.

Types:
- `workout` — Gym session with exercises
- `meal` — What was eaten
- `journal` — Journal entry
- `expense` — Money spent
- `session` — Faith/learning session
- `trip` — Shopping trip
- `body_composition` — Weigh-in data

### `daily_notes`
Persistent task bucket. Like `my-life/daily/notes.json`.

### `daily_plans`
The day's plan. Like `my-life/daily/plans/YYYY-MM-DD.json`.

### `user_settings`
User-specific settings and plans. Like:
- `fitness.diet_plan` — Custom diet plan
- `fitness.workout_plan` — Custom workout plan  
- `journal.purpose` — Why they journal

## Migrations

```bash
# Run all migrations
cd worker
npx wrangler d1 execute bethainy --remote --file=../schema/001_initial.sql
npx wrangler d1 execute bethainy --remote --file=../schema/002_mode_system.sql
```
