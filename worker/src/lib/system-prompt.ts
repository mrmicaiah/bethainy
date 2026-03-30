// Builds the system prompt for Claude with user context

export async function getSystemPrompt(db: D1Database, userId: string): Promise<string> {
  // Get user info
  const user = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first();
  
  // Get core instructions only
  const instructions = await db.prepare(
    'SELECT content FROM system_docs WHERE id = ? AND user_id = ?'
  ).bind('instructions', userId).first();
  
  // Get active tracks (summary only)
  const tracks = await db.prepare(
    `SELECT id, name, mode_id, situation, progress FROM tracks WHERE user_id = ? AND status = 'active'`
  ).bind(userId).all();
  
  // Get open daily notes
  const dailyNotes = await db.prepare(
    `SELECT task FROM daily_notes WHERE user_id = ? AND status = 'open' LIMIT 5`
  ).bind(userId).all();

  const today = new Date().toISOString().split('T')[0];
  const userName = user?.name || 'friend';
  
  let prompt = `# bethainy

Today: ${today}
User: ${userName}

`;

  // Core instructions
  if (instructions?.content) {
    prompt += (instructions as any).content + '\n\n';
  } else {
    prompt += `You are a life assistant. Detect context, help naturally, save important info using tools.\n\n`;
  }

  // Active tracks summary
  if (tracks.results.length > 0) {
    prompt += `## Active Tracks\n`;
    for (const track of tracks.results as any[]) {
      const modeName = track.mode_id.split('_').pop();
      let line = `- ${track.name} (${modeName})`;
      if (track.situation) {
        const sit = JSON.parse(track.situation);
        if (sit.current) line += ` — ${sit.current}`;
      }
      prompt += line + '\n';
    }
    prompt += '\n';
  }

  // Open tasks
  if (dailyNotes.results.length > 0) {
    prompt += `## Open Tasks\n`;
    for (const note of dailyNotes.results as any[]) {
      prompt += `- ${(note as any).task}\n`;
    }
    prompt += '\n';
  }

  // Tools and mode loading instruction
  prompt += `## Tools

You have tools to read and write data:
- get_tracks, get_track, create_track, update_track
- create_entry, get_entries  
- add_daily_note, complete_daily_note
- get_daily_plan, update_daily_plan
- **get_mode_instructions** — call this to load specific mode instructions when you detect a context

When you detect a context (gym, eating, person, project, etc.), use get_mode_instructions to load that mode's full instructions, then follow them.
`;

  return prompt;
}
