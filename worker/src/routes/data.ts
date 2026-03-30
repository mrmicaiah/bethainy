import { Hono } from 'hono';
import { Env } from '../index';

export const dataRoutes = new Hono<{ Bindings: Env }>();

// Get all modes for user
dataRoutes.get('/modes', async (c) => {
  const userId = c.get('userId');
  
  const modes = await c.env.DB.prepare(
    'SELECT * FROM modes WHERE user_id = ?'
  ).bind(userId).all();
  
  return c.json(modes.results);
});

// Get all tracks for user (optionally filtered by mode)
dataRoutes.get('/tracks', async (c) => {
  const userId = c.get('userId');
  const modeId = c.req.query('mode');
  
  let query = 'SELECT * FROM tracks WHERE user_id = ?';
  const params: any[] = [userId];
  
  if (modeId) {
    query += ' AND mode_id = ?';
    params.push(modeId);
  }
  
  const tracks = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json(tracks.results);
});

// Get single track
dataRoutes.get('/tracks/:id', async (c) => {
  const userId = c.get('userId');
  const trackId = c.req.param('id');
  
  const track = await c.env.DB.prepare(
    'SELECT * FROM tracks WHERE id = ? AND user_id = ?'
  ).bind(trackId, userId).first();
  
  if (!track) {
    return c.json({ error: 'Track not found' }, 404);
  }
  
  return c.json(track);
});

// Get entries (filtered by type, track, date range)
dataRoutes.get('/entries', async (c) => {
  const userId = c.get('userId');
  const type = c.req.query('type');
  const trackId = c.req.query('track');
  const startDate = c.req.query('start');
  const endDate = c.req.query('end');
  const limit = parseInt(c.req.query('limit') || '50');
  
  let query = 'SELECT * FROM entries WHERE user_id = ?';
  const params: any[] = [userId];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (trackId) {
    query += ' AND track_id = ?';
    params.push(trackId);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY date DESC, created_at DESC LIMIT ?';
  params.push(limit);
  
  const entries = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json(entries.results);
});

// Get daily plan
dataRoutes.get('/daily/:date', async (c) => {
  const userId = c.get('userId');
  const date = c.req.param('date');
  
  const plan = await c.env.DB.prepare(
    'SELECT * FROM daily_plans WHERE user_id = ? AND date = ?'
  ).bind(userId, date).first();
  
  const notes = await c.env.DB.prepare(
    'SELECT * FROM daily_notes WHERE user_id = ? AND status = "open" ORDER BY added_at DESC'
  ).bind(userId).all();
  
  return c.json({
    plan: plan || null,
    notes: notes.results,
  });
});

// News feed - what needs attention
dataRoutes.get('/feed', async (c) => {
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  
  // Open tasks
  const tasks = await c.env.DB.prepare(
    'SELECT * FROM daily_notes WHERE user_id = ? AND status = "open" ORDER BY added_at DESC LIMIT 10'
  ).bind(userId).all();
  
  // People needing check-in (situation is active)
  const people = await c.env.DB.prepare(
    `SELECT * FROM tracks WHERE user_id = ? AND mode_id LIKE '%_people' 
     AND json_extract(situation, '$.current') IS NOT NULL`
  ).bind(userId).all();
  
  // Recent entries
  const recent = await c.env.DB.prepare(
    'SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(userId).all();
  
  return c.json({
    tasks: tasks.results,
    people: people.results,
    recent: recent.results,
  });
});

// ============ INSTRUCTIONS ENDPOINTS ============

// Get current instructions
dataRoutes.get('/instructions', async (c) => {
  const userId = c.get('userId');
  
  const doc = await c.env.DB.prepare(
    'SELECT * FROM system_docs WHERE id = ? AND user_id = ?'
  ).bind('instructions', userId).first();
  
  return c.json({
    content: doc?.content || null,
    updated_at: doc?.updated_at || null,
  });
});

// Update instructions
dataRoutes.put('/instructions', async (c) => {
  const userId = c.get('userId');
  const { content } = await c.req.json();
  
  if (typeof content !== 'string') {
    return c.json({ error: 'Content must be a string' }, 400);
  }
  
  // Upsert instructions
  await c.env.DB.prepare(
    `INSERT INTO system_docs (id, user_id, content, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       updated_at = excluded.updated_at`
  ).bind('instructions', userId, content).run();
  
  return c.json({ success: true, updated: true });
});

// Delete instructions (revert to defaults)
dataRoutes.delete('/instructions', async (c) => {
  const userId = c.get('userId');
  
  await c.env.DB.prepare(
    'DELETE FROM system_docs WHERE id = ? AND user_id = ?'
  ).bind('instructions', userId).run();
  
  return c.json({ success: true, deleted: true });
});
