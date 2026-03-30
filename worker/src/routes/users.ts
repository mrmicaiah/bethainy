import { Hono } from 'hono';
import { Env } from '../index';

export const userRoutes = new Hono<{ Bindings: Env }>();

// Simple signup
userRoutes.post('/signup', async (c) => {
  try {
    const { email, name, pin } = await c.req.json();
    
    if (!email || !pin) {
      return c.json({ error: 'Email and PIN required' }, 400);
    }
    
    const id = crypto.randomUUID();
    const pinHash = await hashPin(pin);
    
    await c.env.DB.prepare(
      'INSERT INTO users (id, email, name, pin_hash) VALUES (?, ?, ?, ?)'
    ).bind(id, email, name || null, pinHash).run();
    
    // Create default modes for new user
    await createDefaultModes(c.env.DB, id);
    
    return c.json({ id, email, name });
  } catch (e: any) {
    console.error('Signup error:', e);
    if (e.message?.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 400);
    }
    return c.json({ error: e.message || 'Signup failed' }, 500);
  }
});

// Simple login
userRoutes.post('/login', async (c) => {
  try {
    const { email, pin } = await c.req.json();
    
    if (!email || !pin) {
      return c.json({ error: 'Email and PIN required' }, 400);
    }
    
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const pinHash = await hashPin(pin);
    if (pinHash !== user.pin_hash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    return c.json({ 
      token: user.id,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (e: any) {
    console.error('Login error:', e);
    return c.json({ error: e.message || 'Login failed' }, 500);
  }
});

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function createDefaultModes(db: D1Database, userId: string) {
  const defaultModes = [
    { id: `${userId}_daily`, name: 'Daily', behavior: 'circuit' },
    { id: `${userId}_fitness`, name: 'Fitness', behavior: 'circuit' },
    { id: `${userId}_people`, name: 'People', behavior: 'collaborative' },
    { id: `${userId}_projects`, name: 'Projects', behavior: 'collaborative' },
    { id: `${userId}_money`, name: 'Money', behavior: 'mixed' },
    { id: `${userId}_journal`, name: 'Journal', behavior: 'collaborative' },
    { id: `${userId}_learning`, name: 'Learning', behavior: 'mixed' },
    { id: `${userId}_maintenance`, name: 'Maintenance', behavior: 'mixed' },
    { id: `${userId}_shopping`, name: 'Shopping', behavior: 'circuit' },
    { id: `${userId}_faith`, name: 'Faith', behavior: 'mixed' },
  ];
  
  for (const mode of defaultModes) {
    await db.prepare(
      'INSERT INTO modes (id, user_id, name, behavior) VALUES (?, ?, ?, ?)'
    ).bind(mode.id, userId, mode.name, mode.behavior).run();
  }
}
