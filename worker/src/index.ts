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
  GITHUB_TOKEN: string;
  DATA_REPO: string;
}

// Container class
export class BethainyContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '30m';
  
  envVars = {
    ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY,
    CLAUDE_MODEL: this.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    GITHUB_TOKEN: this.env.GITHUB_TOKEN,
    DATA_REPO: this.env.DATA_REPO || 'mrmicaiah/bethainy-data'
  };
  
  override onStart() {
    console.log('bethainy container waking up...');
  }
  
  override onStop() {
    console.log('bethainy container going to sleep...');
  }
}

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/*', cors({
  origin: '*',
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', app: 'bethainy' }));

// Public routes
app.route('/users', userRoutes);

// Wake check
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
app.use('/chat/*', auth);

app.post('/chat/message', async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.get('userId');
    
    const container = getContainer(c.env.BETHAINY_CONTAINER);
    
    const response = await container.fetch(
      new Request('http://container/message', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
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
