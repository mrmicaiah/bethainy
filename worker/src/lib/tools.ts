// Tool definitions and handlers for Claude

export function getTools() {
  return [
    // Mode instruction tool - LOAD ON DEMAND
    {
      name: 'get_mode_instructions',
      description: 'Load full instructions for a mode when you detect a trigger. Call this FIRST when entering a mode context (gym, eating, person, project, etc.)',
      input_schema: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'Mode name: Fitness, People, Daily, Projects, Money, Journal, Learning, Maintenance, Shopping, Faith' },
        },
        required: ['mode'],
      },
    },
    
    // Track tools
    {
      name: 'get_tracks',
      description: 'Get all tracks, optionally filtered by mode',
      input_schema: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'Filter by mode name (e.g., "people", "projects")' },
        },
      },
    },
    {
      name: 'get_track',
      description: 'Get a specific track by ID with full data',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Track ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'create_track',
      description: 'Create a new track (person, project, asset, etc.)',
      input_schema: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: 'Mode name (people, projects, etc.)' },
          name: { type: 'string', description: 'Track name' },
          type: { type: 'string', description: 'Track type (person, project, asset, etc.)' },
          behavior: { type: 'string', enum: ['circuit', 'collaborative'], description: 'Behavior type' },
          plan: { type: 'object', description: 'Initial plan' },
          profile: { type: 'object', description: 'Profile data (for people, assets, etc.)' },
          situation: { type: 'object', description: 'Current situation' },
        },
        required: ['mode', 'name'],
      },
    },
    {
      name: 'update_track',
      description: 'Update a track (plan, progress, profile, situation, preferences)',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Track ID' },
          plan: { type: 'object', description: 'Updated plan' },
          progress: { type: 'object', description: 'Updated progress' },
          profile: { type: 'object', description: 'Updated profile' },
          situation: { type: 'object', description: 'Updated situation' },
          preferences: { type: 'object', description: 'Updated preferences' },
          status: { type: 'string', enum: ['active', 'paused', 'completed'] },
        },
        required: ['id'],
      },
    },
    
    // Entry tools
    {
      name: 'create_entry',
      description: 'Create an entry (workout, meal, expense, journal, timeline event, etc.)',
      input_schema: {
        type: 'object',
        properties: {
          track_id: { type: 'string', description: 'Associated track ID (optional)' },
          type: { type: 'string', description: 'Entry type (workout, meal, expense, journal, timeline, task, etc.)' },
          date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
          data: { type: 'object', description: 'Entry data (flexible)' },
          status: { type: 'string', enum: ['open', 'done', 'skipped'], description: 'Status' },
        },
        required: ['type', 'date'],
      },
    },
    {
      name: 'get_entries',
      description: 'Get entries, optionally filtered',
      input_schema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by type' },
          track_id: { type: 'string', description: 'Filter by track' },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
      },
    },
    
    // Daily tools
    {
      name: 'add_daily_note',
      description: 'Add a task to the daily notes bucket',
      input_schema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Task description' },
          context: { type: 'string', description: 'Additional context' },
        },
        required: ['task'],
      },
    },
    {
      name: 'complete_daily_note',
      description: 'Mark a daily note as complete',
      input_schema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Daily note ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_daily_plan',
      description: 'Get the daily plan for a date',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        },
        required: ['date'],
      },
    },
    {
      name: 'update_daily_plan',
      description: 'Update or create a daily plan',
      input_schema: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
          items: { type: 'array', description: 'Plan items' },
          completed: { type: 'array', description: 'Completed items' },
        },
        required: ['date'],
      },
    },
  ];
}

export async function handleToolCall(
  db: D1Database,
  userId: string,
  toolName: string,
  input: any
): Promise<any> {
  switch (toolName) {
    
    // GET MODE INSTRUCTIONS - loads mode + related docs
    case 'get_mode_instructions': {
      const modeName = input.mode;
      
      // Get mode instructions
      const mode = await db.prepare(
        'SELECT * FROM modes WHERE user_id = ? AND name = ?'
      ).bind(userId, modeName).first();
      
      if (!mode) {
        return { error: `Mode not found: ${modeName}` };
      }
      
      let result: any = {
        mode: modeName,
        instructions: (mode as any).instructions || 'No instructions set for this mode.',
      };
      
      // Load related reference docs based on mode
      if (modeName === 'Fitness') {
        const workoutPlan = await db.prepare(
          'SELECT content FROM system_docs WHERE user_id = ? AND id = ?'
        ).bind(userId, 'workout-plan').first();
        
        const dietPlan = await db.prepare(
          'SELECT content FROM system_docs WHERE user_id = ? AND id = ?'
        ).bind(userId, 'diet-plan').first();
        
        if (workoutPlan) result.workoutPlan = (workoutPlan as any).content;
        if (dietPlan) result.dietPlan = (dietPlan as any).content;
        
        // Also get the active fitness track
        const fitnessTrack = await db.prepare(
          `SELECT * FROM tracks WHERE user_id = ? AND mode_id LIKE '%_fitness' AND status = 'active' LIMIT 1`
        ).bind(userId).first();
        
        if (fitnessTrack) {
          result.track = {
            id: (fitnessTrack as any).id,
            name: (fitnessTrack as any).name,
            plan: (fitnessTrack as any).plan ? JSON.parse((fitnessTrack as any).plan) : null,
            progress: (fitnessTrack as any).progress ? JSON.parse((fitnessTrack as any).progress) : null,
            preferences: (fitnessTrack as any).preferences ? JSON.parse((fitnessTrack as any).preferences) : null,
          };
        }
      }
      
      return result;
    }
    
    // Track tools
    case 'get_tracks': {
      let query = 'SELECT * FROM tracks WHERE user_id = ?';
      const params: any[] = [userId];
      
      if (input.mode) {
        query += ' AND mode_id LIKE ?';
        params.push(`%_${input.mode.toLowerCase()}`);
      }
      
      const result = await db.prepare(query).bind(...params).all();
      return result.results;
    }
    
    case 'get_track': {
      const track = await db.prepare(
        'SELECT * FROM tracks WHERE id = ? AND user_id = ?'
      ).bind(input.id, userId).first();
      
      if (!track) return { error: 'Track not found' };
      
      // Parse JSON fields
      return {
        ...(track as any),
        plan: (track as any).plan ? JSON.parse((track as any).plan) : null,
        progress: (track as any).progress ? JSON.parse((track as any).progress) : null,
        profile: (track as any).profile ? JSON.parse((track as any).profile) : null,
        situation: (track as any).situation ? JSON.parse((track as any).situation) : null,
        preferences: (track as any).preferences ? JSON.parse((track as any).preferences) : null,
      };
    }
    
    case 'create_track': {
      const id = input.name.toLowerCase().replace(/\s+/g, '-');
      const modeId = `${userId}_${input.mode.toLowerCase()}`;
      
      await db.prepare(
        `INSERT INTO tracks (id, user_id, mode_id, name, type, behavior, plan, profile, situation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        userId,
        modeId,
        input.name,
        input.type || null,
        input.behavior || 'collaborative',
        input.plan ? JSON.stringify(input.plan) : null,
        input.profile ? JSON.stringify(input.profile) : null,
        input.situation ? JSON.stringify(input.situation) : null
      ).run();
      
      return { id, name: input.name, created: true };
    }
    
    case 'update_track': {
      const updates: string[] = [];
      const params: any[] = [];
      
      if (input.plan !== undefined) {
        updates.push('plan = ?');
        params.push(JSON.stringify(input.plan));
      }
      if (input.progress !== undefined) {
        updates.push('progress = ?');
        params.push(JSON.stringify(input.progress));
      }
      if (input.profile !== undefined) {
        updates.push('profile = ?');
        params.push(JSON.stringify(input.profile));
      }
      if (input.situation !== undefined) {
        updates.push('situation = ?');
        params.push(JSON.stringify(input.situation));
      }
      if (input.preferences !== undefined) {
        updates.push('preferences = ?');
        params.push(JSON.stringify(input.preferences));
      }
      if (input.status) {
        updates.push('status = ?');
        params.push(input.status);
      }
      
      updates.push('updated_at = datetime("now")');
      params.push(input.id, userId);
      
      await db.prepare(
        `UPDATE tracks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      ).bind(...params).run();
      
      return { id: input.id, updated: true };
    }
    
    // Entry tools
    case 'create_entry': {
      const result = await db.prepare(
        `INSERT INTO entries (user_id, track_id, type, date, data, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        userId,
        input.track_id || null,
        input.type,
        input.date,
        input.data ? JSON.stringify(input.data) : null,
        input.status || 'done'
      ).run();
      
      return { id: result.meta.last_row_id, created: true };
    }
    
    case 'get_entries': {
      let query = 'SELECT * FROM entries WHERE user_id = ?';
      const params: any[] = [userId];
      
      if (input.type) {
        query += ' AND type = ?';
        params.push(input.type);
      }
      if (input.track_id) {
        query += ' AND track_id = ?';
        params.push(input.track_id);
      }
      if (input.start_date) {
        query += ' AND date >= ?';
        params.push(input.start_date);
      }
      if (input.end_date) {
        query += ' AND date <= ?';
        params.push(input.end_date);
      }
      
      query += ' ORDER BY date DESC LIMIT ?';
      params.push(input.limit || 20);
      
      const result = await db.prepare(query).bind(...params).all();
      return result.results;
    }
    
    // Daily tools
    case 'add_daily_note': {
      const result = await db.prepare(
        'INSERT INTO daily_notes (user_id, task, context) VALUES (?, ?, ?)'
      ).bind(userId, input.task, input.context || null).run();
      
      return { id: result.meta.last_row_id, task: input.task, added: true };
    }
    
    case 'complete_daily_note': {
      await db.prepare(
        `UPDATE daily_notes SET status = 'done', completed_at = datetime('now')
         WHERE id = ? AND user_id = ?`
      ).bind(input.id, userId).run();
      
      return { id: input.id, completed: true };
    }
    
    case 'get_daily_plan': {
      const plan = await db.prepare(
        'SELECT * FROM daily_plans WHERE user_id = ? AND date = ?'
      ).bind(userId, input.date).first();
      
      const notes = await db.prepare(
        `SELECT * FROM daily_notes WHERE user_id = ? AND status = 'open'`
      ).bind(userId).all();
      
      return {
        plan: plan || null,
        openNotes: notes.results,
      };
    }
    
    case 'update_daily_plan': {
      await db.prepare(
        `INSERT INTO daily_plans (user_id, date, items, completed)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, date) DO UPDATE SET
           items = excluded.items,
           completed = excluded.completed`
      ).bind(
        userId,
        input.date,
        input.items ? JSON.stringify(input.items) : '[]',
        input.completed ? JSON.stringify(input.completed) : '[]'
      ).run();
      
      return { date: input.date, updated: true };
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
