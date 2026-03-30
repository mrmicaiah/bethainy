// Builds the system prompt for Claude with user context

export async function getSystemPrompt(db: D1Database, userId: string): Promise<string> {
  // Get user info
  const user = await db.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(userId).first();
  
  // Get all system docs for this user
  const systemDocs = await db.prepare(
    'SELECT * FROM system_docs WHERE user_id = ?'
  ).bind(userId).all();
  
  // Get user's modes WITH instructions
  const modes = await db.prepare(
    'SELECT * FROM modes WHERE user_id = ?'
  ).bind(userId).all();
  
  // Get active tracks with full data
  const tracks = await db.prepare(
    `SELECT * FROM tracks WHERE user_id = ? AND status = 'active'`
  ).bind(userId).all();
  
  // Get recent entries for context
  const recentEntries = await db.prepare(
    'SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(userId).all();
  
  // Get open daily notes
  const dailyNotes = await db.prepare(
    `SELECT * FROM daily_notes WHERE user_id = ? AND status = 'open'`
  ).bind(userId).all();

  const today = new Date().toISOString().split('T')[0];
  const userName = user?.name || 'friend';
  
  // Parse system docs
  const instructions = systemDocs.results.find((d: any) => d.id === 'instructions');
  const modeSystem = systemDocs.results.find((d: any) => d.id === 'mode-system');
  const creatingModes = systemDocs.results.find((d: any) => d.id === 'creating-modes');
  const workoutPlan = systemDocs.results.find((d: any) => d.id === 'workout-plan');
  const dietPlan = systemDocs.results.find((d: any) => d.id === 'diet-plan');
  
  // Build prompt
  let prompt = `# bethainy

Today: ${today}
User: ${userName}

`;

  // Core instructions
  if (instructions?.content) {
    prompt += instructions.content + '\n\n';
  }

  // Mode system architecture
  if (modeSystem?.content) {
    prompt += `---\n\n## Mode System Reference\n\n${modeSystem.content}\n\n`;
  }

  // Creating modes guide
  if (creatingModes?.content) {
    prompt += `---\n\n## Creating New Modes\n\n${creatingModes.content}\n\n`;
  }

  // All mode instructions
  prompt += `---\n\n## Mode Instructions\n\n`;
  for (const mode of modes.results as any[]) {
    if (mode.instructions) {
      prompt += `### ${mode.name}\n${mode.instructions}\n\n`;
    }
  }

  // Reference docs (workout plan, diet plan)
  if (workoutPlan?.content || dietPlan?.content) {
    prompt += `---\n\n## Reference Data\n\n`;
    if (workoutPlan?.content) {
      prompt += `### Workout Plan\n${workoutPlan.content}\n\n`;
    }
    if (dietPlan?.content) {
      prompt += `### Diet Plan\n${dietPlan.content}\n\n`;
    }
  }

  // Active tracks with their data
  prompt += `---\n\n## Active Tracks\n\n`;
  if (tracks.results.length > 0) {
    for (const track of tracks.results as any[]) {
      const modeName = track.mode_id.split('_').pop();
      prompt += `### ${track.name} (${modeName})\n`;
      
      if (track.plan) {
        prompt += `**Plan:** ${JSON.stringify(JSON.parse(track.plan))}\n`;
      }
      if (track.progress) {
        prompt += `**Progress:** ${JSON.stringify(JSON.parse(track.progress))}\n`;
      }
      if (track.preferences) {
        prompt += `**Preferences:** ${JSON.stringify(JSON.parse(track.preferences))}\n`;
      }
      if (track.situation) {
        const situation = JSON.parse(track.situation);
        prompt += `**Situation:** ${situation.current || 'none'}${situation.since ? ` (since ${situation.since})` : ''}\n`;
      }
      if (track.profile) {
        prompt += `**Profile:** ${JSON.stringify(JSON.parse(track.profile))}\n`;
      }
      prompt += '\n';
    }
  } else {
    prompt += 'No active tracks yet.\n\n';
  }

  // Open tasks
  if (dailyNotes.results.length > 0) {
    prompt += `---\n\n## Open Tasks\n\n`;
    for (const note of dailyNotes.results as any[]) {
      prompt += `- ${note.task}\n`;
    }
    prompt += '\n';
  }

  // Recent activity
  if (recentEntries.results.length > 0) {
    prompt += `---\n\n## Recent Activity\n\n`;
    for (const entry of recentEntries.results.slice(0, 5) as any[]) {
      const data = entry.data ? JSON.parse(entry.data) : {};
      prompt += `- ${entry.date}: ${entry.type}`;
      if (data.day_type) prompt += ` (${data.day_type})`;
      if (data.notes) prompt += ` — ${data.notes}`;
      prompt += '\n';
    }
    prompt += '\n';
  }

  // Tools
  prompt += `---\n\n## Tools

Use these to read and write data:
- get_tracks, get_track, create_track, update_track
- create_entry, get_entries  
- add_daily_note, complete_daily_note
- get_daily_plan, update_daily_plan

**Don't just acknowledge — use tools to save data.**
`;

  return prompt;
}
