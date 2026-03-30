import { Hono } from 'hono';
import { Env } from '../index';

export const dataRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ============ TRACKS ============

// Get all tracks for a mode
dataRoutes.get('/tracks/:mode', async (c) => {
  const userId = c.get('userId');
  const mode = c.req.param('mode');
  
  const tracks = await c.env.DB.prepare(
    'SELECT * FROM tracks WHERE user_id = ? AND mode = ? AND status != ?'
  ).bind(userId, mode, 'deleted').all();
  
  return c.json(tracks.results);
});

// Get a specific track
dataRoutes.get('/tracks/:mode/:trackId', async (c) => {
  const userId = c.get('userId');
  const trackId = c.req.param('trackId');
  
  const track = await c.env.DB.prepare(
    'SELECT * FROM tracks WHERE id = ? AND user_id = ?'
  ).bind(trackId, userId).first();
  
  if (!track) {
    return c.json({ error: 'Track not found' }, 404);
  }
  
  return c.json(track);
});

// Create or update a track
dataRoutes.put('/tracks/:mode/:trackId', async (c) => {
  const userId = c.get('userId');
  const mode = c.req.param('mode');
  const trackId = c.req.param('trackId');
  const data = await c.req.json();
  
  // Check if exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM tracks WHERE id = ? AND user_id = ?'
  ).bind(trackId, userId).first();
  
  if (existing) {
    // Update
    await c.env.DB.prepare(`
      UPDATE tracks SET
        name = ?, type = ?, behavior = ?, status = ?,
        plan = ?, progress = ?, profile = ?, situation = ?,
        preferences = ?, current_list = ?, tasks = ?, schedule = ?,
        insights = ?, resources = ?, timeline = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(
      data.name, data.type, data.behavior, data.status || 'active',
      JSON.stringify(data.plan), JSON.stringify(data.progress),
      JSON.stringify(data.profile), JSON.stringify(data.situation),
      JSON.stringify(data.preferences), JSON.stringify(data.current_list),
      JSON.stringify(data.tasks), JSON.stringify(data.schedule),
      JSON.stringify(data.insights), JSON.stringify(data.resources),
      JSON.stringify(data.timeline), JSON.stringify(data.notes),
      trackId, userId
    ).run();
  } else {
    // Insert
    await c.env.DB.prepare(`
      INSERT INTO tracks (
        id, user_id, mode, name, type, behavior, status,
        plan, progress, profile, situation, preferences,
        current_list, tasks, schedule, insights, resources, timeline, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      trackId, userId, mode,
      data.name, data.type, data.behavior || 'collaborative', data.status || 'active',
      JSON.stringify(data.plan), JSON.stringify(data.progress),
      JSON.stringify(data.profile), JSON.stringify(data.situation),
      JSON.stringify(data.preferences), JSON.stringify(data.current_list),
      JSON.stringify(data.tasks), JSON.stringify(data.schedule),
      JSON.stringify(data.insights), JSON.stringify(data.resources),
      JSON.stringify(data.timeline), JSON.stringify(data.notes)
    ).run();
  }
  
  return c.json({ success: true, id: trackId });
});

// ============ ENTRIES ============

// Get entries for a date range
dataRoutes.get('/entries/:mode', async (c) => {
  const userId = c.get('userId');
  const mode = c.req.param('mode');
  const type = c.req.query('type');
  const startDate = c.req.query('start') || '2000-01-01';
  const endDate = c.req.query('end') || '2100-01-01';
  
  let query = 'SELECT * FROM entries WHERE user_id = ? AND mode = ? AND date BETWEEN ? AND ?';
  const params: any[] = [userId, mode, startDate, endDate];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY date DESC, created_at DESC';
  
  const entries = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json(entries.results);
});

// Get entries for a specific date
dataRoutes.get('/entries/:mode/:date', async (c) => {
  const userId = c.get('userId');
  const mode = c.req.param('mode');
  const date = c.req.param('date');
  const type = c.req.query('type');
  
  let query = 'SELECT * FROM entries WHERE user_id = ? AND mode = ? AND date = ?';
  const params: any[] = [userId, mode, date];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY created_at ASC';
  
  const entries = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json(entries.results);
});

// Create an entry
dataRoutes.post('/entries/:mode', async (c) => {
  const userId = c.get('userId');
  const mode = c.req.param('mode');
  const { type, date, data, track_id } = await c.req.json();
  
  const result = await c.env.DB.prepare(`
    INSERT INTO entries (user_id, mode, type, track_id, date, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(userId, mode, type, track_id || null, date, JSON.stringify(data)).run();
  
  return c.json({ success: true, id: result.meta.last_row_id });
});

// Update an entry
dataRoutes.put('/entries/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { data } = await c.req.json();
  
  await c.env.DB.prepare(`
    UPDATE entries SET data = ? WHERE id = ? AND user_id = ?
  `).bind(JSON.stringify(data), id, userId).run();
  
  return c.json({ success: true });
});

// ============ DAILY NOTES ============

// Get daily notes
dataRoutes.get('/daily/notes', async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status') || 'open';
  
  const notes = await c.env.DB.prepare(
    'SELECT * FROM daily_notes WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
  ).bind(userId, status).all();
  
  return c.json(notes.results);
});

// Add a daily note
dataRoutes.post('/daily/notes', async (c) => {
  const userId = c.get('userId');
  const { type, content, context } = await c.req.json();
  
  const result = await c.env.DB.prepare(`
    INSERT INTO daily_notes (user_id, type, content, context)
    VALUES (?, ?, ?, ?)
  `).bind(userId, type || 'task', content, context || null).run();
  
  return c.json({ success: true, id: result.meta.last_row_id });
});

// Update a daily note
dataRoutes.put('/daily/notes/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { status, moved_to } = await c.req.json();
  
  await c.env.DB.prepare(`
    UPDATE daily_notes SET 
      status = ?,
      moved_to = ?,
      completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE completed_at END
    WHERE id = ? AND user_id = ?
  `).bind(status, moved_to || null, status, id, userId).run();
  
  return c.json({ success: true });
});

// ============ DAILY PLANS ============

// Get today's plan (or a specific date)
dataRoutes.get('/daily/plan/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');
  
  const plan = await c.env.DB.prepare(
    'SELECT * FROM daily_plans WHERE user_id = ? AND date = ?'
  ).bind(userId, date).first();
  
  return c.json(plan || { date, items: [], completed: [] });
});

// Create/update daily plan
dataRoutes.put('/daily/plan/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');
  const { items, completed, reflection } = await c.req.json();
  
  await c.env.DB.prepare(`
    INSERT INTO daily_plans (user_id, date, items, completed, reflection)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id, date) DO UPDATE SET
      items = excluded.items,
      completed = excluded.completed,
      reflection = excluded.reflection
  `).bind(
    userId, date,
    JSON.stringify(items),
    JSON.stringify(completed),
    reflection || null
  ).run();
  
  return c.json({ success: true });
});

// ============ USER SETTINGS ============

// Get a setting
dataRoutes.get('/settings/:key', async (c) => {
  const userId = c.get('userId');
  const key = c.req.param('key');
  
  const setting = await c.env.DB.prepare(
    'SELECT value FROM user_settings WHERE user_id = ? AND key = ?'
  ).bind(userId, key).first();
  
  return c.json(setting ? JSON.parse(setting.value as string) : null);
});

// Set a setting
dataRoutes.put('/settings/:key', async (c) => {
  const userId = c.get('userId');
  const key = c.req.param('key');
  const value = await c.req.json();
  
  await c.env.DB.prepare(`
    INSERT INTO user_settings (user_id, key, value)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now')
  `).bind(userId, key, JSON.stringify(value)).run();
  
  return c.json({ success: true });
});
