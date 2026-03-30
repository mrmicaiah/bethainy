// Builds the system prompt for Claude with user context

export async function getSystemPrompt(db: D1Database, userId: string): Promise<string> {
  // Get user info
  const user = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first();
  
  // Get custom instructions (if any)
  const customInstructions = await db.prepare(
    'SELECT * FROM system_docs WHERE id = ? AND user_id = ?'
  ).bind('instructions', userId).first();
  
  // Get user's modes
  const modes = await db.prepare(
    'SELECT * FROM modes WHERE user_id = ?'
  ).bind(userId).all();
  
  // Get active tracks with situations
  const tracks = await db.prepare(
    `SELECT * FROM tracks WHERE user_id = ? AND status = 'active'`
  ).bind(userId).all();
  
  // Get recent entries for context
  const recentEntries = await db.prepare(
    'SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(userId).all();
  
  // Get open daily notes
  const dailyNotes = await db.prepare(
    `SELECT * FROM daily_notes WHERE user_id = ? AND status = 'open'`
  ).bind(userId).all();

  const today = new Date().toISOString().split('T')[0];
  const userName = user?.name || 'the user';
  
  // Base prompt
  let prompt = `# bethainy — Life Assistant

You are a personal life assistant helping ${userName} manage their life.

Today's date: ${today}

`;

  // Add custom instructions if they exist
  if (customInstructions?.content) {
    prompt += `## Custom Instructions

${customInstructions.content}

`;
  } else {
    // Default instructions
    prompt += `## How You Work

- **Modes are invisible** — The user just talks naturally. You manage state internally.
- **Track as you go** — Capture information in the moment using tools.
- **Take notes automatically** — When they state a preference, give context, correct something—save it.
- **Auto-generate plans** — When a situation needs a plan, create a reasonable default.
- **Daily is the catch-all** — Generic tasks go to daily notes until they have a home.

## Behavior Types

### Circuit Behavior
You lead. User executes.
- Present one step at a time
- Capture everything automatically
- Examples: Gym workout, shopping list, Bible reading, daily plan

### Collaborative Behavior
User leads. You help and capture.
- Listen, ask questions, offer ideas
- Capture only on signal ("write that down", "that's the plan", conversation wrap-up)
- Examples: Project work, journaling, talking about people

## Tone & Style

- Be direct and practical
- Don't over-explain
- Keep responses concise
- Push when slacking, celebrate real progress

`;
  }

  // Add context
  prompt += `## User's Modes
${modes.results.map((m: any) => `- ${m.name} (${m.behavior})`).join('\n')}

## Active Tracks
${tracks.results.length > 0 ? tracks.results.map((t: any) => {
  const situation = t.situation ? JSON.parse(t.situation) : null;
  return `- ${t.name} (${t.mode_id.split('_').pop()})${situation?.current ? ` — ${situation.current}` : ''}`;
}).join('\n') : 'No active tracks yet.'}

## Open Tasks
${dailyNotes.results.length > 0 ? dailyNotes.results.map((n: any) => `- ${n.task}`).join('\n') : 'No open tasks.'}

## Recent Activity
${recentEntries.results.length > 0 ? recentEntries.results.slice(0, 5).map((e: any) => {
  const data = e.data ? JSON.parse(e.data) : {};
  return `- ${e.date}: ${e.type}${data.note ? ` — ${data.note}` : ''}`;
}).join('\n') : 'No recent activity.'}

## Tools Available

You have tools to read and write user data:
- get_tracks, create_track, update_track
- create_entry, get_entries
- add_daily_note, complete_daily_note
- get_daily_plan, update_daily_plan

Use these tools to persist information. Don't just acknowledge—actually save it.
`;

  return prompt;
}
