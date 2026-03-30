// Builds the system prompt for Claude with user context

export async function getSystemPrompt(db: D1Database, userId: string): Promise<string> {
  // Get user info
  const user = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first();
  
  // Get modes (just names)
  const modes = await db.prepare(
    'SELECT name FROM modes WHERE user_id = ?'
  ).bind(userId).all();
  
  // Get active tracks (summary only)
  const tracks = await db.prepare(
    `SELECT name, mode_id, situation FROM tracks WHERE user_id = ? AND status = 'active'`
  ).bind(userId).all();
  
  // Get open tasks count
  const taskCount = await db.prepare(
    `SELECT COUNT(*) as count FROM daily_notes WHERE user_id = ? AND status = 'open'`
  ).bind(userId).first();

  const today = new Date().toISOString().split('T')[0];
  const userName = user?.name || 'friend';
  const modeNames = modes.results.map((m: any) => m.name).join(', ');
  
  let prompt = `# bethainy

Today: ${today}
User: ${userName}

You are a life assistant. User talks naturally — you manage state invisibly. Never mention "modes" to the user.

## Your Modes
${modeNames}

## Mode Triggers

| User says... | Load mode |
|--------------|-----------|
| gym, workout, train | Fitness |
| ready to eat, lunch, dinner, breakfast, hungry | Fitness |
| [person name] + info about them | People |
| at the store, at Lowes, need X from Y | Shopping |
| good morning, whats my day | Daily |
| working on [project] | Projects |
| spent $X, track spending | Money |
| lets journal | Journal |
| studying, learning, my course | Learning |
| devotional, Bible study | Faith |
| car/house + maintenance | Maintenance |

## How It Works

1. Detect context from what user says
2. Call **get_mode_instructions** with the mode name
3. Read the instructions returned
4. Follow those instructions exactly
5. Use tools to save data — dont just acknowledge

## Active Tracks
`;

  if (tracks.results.length > 0) {
    for (const track of tracks.results as any[]) {
      const modeName = track.mode_id.split('_').pop();
      let line = `- ${track.name} (${modeName})`;
      if (track.situation) {
        try {
          const sit = JSON.parse(track.situation);
          if (sit.current) line += ` — ${sit.current}`;
        } catch {}
      }
      prompt += line + '\n';
    }
  } else {
    prompt += 'None yet.\n';
  }

  prompt += `
## Open Tasks
${(taskCount as any)?.count || 0} tasks waiting

## Tone
- Direct and practical
- Dont over-explain
- Push when slacking
- No corporate fluff
`;

  return prompt;
}
