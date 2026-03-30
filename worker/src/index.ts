import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Container, getContainer } from '@cloudflare/containers';
import { auth } from './middleware/auth';
import { userRoutes } from './routes/users';

export interface Env {
  DB: D1Database;
  BETHAINY_CONTAINER: DurableObjectNamespace<BethainyContainer>;
  ANTHROPIC_API_KEY: string;
  CLAUDE_MODEL: string;
}

// Container class - extends Cloudflare's Container
export class BethainyContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '30m';  // Sleep after 30 min of inactivity
  
  envVars = {
    ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY,
    CLAUDE_MODEL: this.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'
  };
  
  override onStart() {
    console.log('bethainy container waking up...');
  }
  
  override onStop() {
    console.log('bethainy container going to sleep...');
  }
}

const app = new Hono<{ Bindings: Env }>();

// CORS for frontend
app.use('/*', cors({
  origin: '*',
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', app: 'bethainy-gateway' }));

// Public routes
app.route('/users', userRoutes);

// Wake check - allows frontend to ping and see if container is ready
app.get('/wake', async (c) => {
  try {
    const container = getContainer(c.env.BETHAINY_CONTAINER);
    const response = await container.fetch(new Request('http://container/wake'));
    const data = await response.json();
    return c.json({ status: 'awake', container: data });
  } catch (err: any) {
    return c.json({ status: 'waking', message: err.message }, 503);
  }
});

// Protected chat route
app.post('/chat/message', auth, async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.get('userId');
    
    // Get the container (same instance for all users for now)
    const container = getContainer(c.env.BETHAINY_CONTAINER);
    
    // Forward request to container
    const response = await container.fetch(
      new Request('http://container/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          userId
        })
      })
    );
    
    const data = await response.json();
    return c.json(data);
  } catch (err: any) {
    console.error('Chat error:', err);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
