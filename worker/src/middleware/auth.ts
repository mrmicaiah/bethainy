import { Context, Next } from 'hono';

export async function auth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // For MVP: token is just the user ID
  // TODO: Implement proper JWT or session tokens
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(token).first();
  
  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  c.set('user', user);
  c.set('userId', user.id);
  
  await next();
}
