import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Container, getContainer } from '@cloudflare/containers';
import { auth } from './middleware/auth';
import { userRoutes } from './routes/users';
import { oauthRoutes } from './routes/oauth';
import { GoogleCalendar } from './lib/google-calendar';

export interface Env {
  DB: D1Database;
  BETHAINY_CONTAINER: DurableObjectNamespace<BethainyContainer>;
  ANTHROPIC_API_KEY: string;
  CLAUDE_MODEL: string;
  GITHUB_TOKEN: string;
  DATA_REPO: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_REDIRECT_URI: string;
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
app.route('/oauth', oauthRoutes);

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
    
    // Check for Google Calendar connection and get today's events
    let calendarContext = null;
    try {
      const calendar = new GoogleCalendar(c.env as any, userId);
      const connected = await calendar.loadTokens();
      
      if (connected) {
        const today = new Date().toISOString().split('T')[0];
        const events = await calendar.getEventsForDay(today);
        const upcoming = await calendar.getUpcomingEvents(5);
        
        calendarContext = {
          connected: true,
          todayEvents: events,
          upcomingEvents: upcoming
        };
      } else {
        calendarContext = { connected: false };
      }
    } catch (err) {
      console.error('Calendar fetch error:', err);
      calendarContext = { connected: false, error: 'Failed to fetch calendar' };
    }
    
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
          userId,
          calendarContext
        })
      })
    );
    
    const data = await response.json() as any;
    
    // If BethAiny wants to perform calendar actions, handle them here
    if (data.calendarActions && Array.isArray(data.calendarActions)) {
      const calendar = new GoogleCalendar(c.env as any, userId);
      const connected = await calendar.loadTokens();
      
      if (connected) {
        for (const action of data.calendarActions) {
          try {
            if (action.type === 'create') {
              await calendar.createEvent(action.event);
            } else if (action.type === 'update') {
              await calendar.updateEvent(action.eventId, action.updates);
            } else if (action.type === 'delete') {
              await calendar.deleteEvent(action.eventId);
            }
          } catch (err) {
            console.error('Calendar action failed:', action, err);
          }
        }
      }
    }
    
    return c.json(data);
  } catch (err: any) {
    console.error('Chat error:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Calendar connection status (protected)
app.get('/chat/calendar/status', async (c) => {
  const userId = c.get('userId');
  
  const calendar = new GoogleCalendar(c.env as any, userId);
  const connected = await calendar.loadTokens();
  
  return c.json({ connected });
});

// Generate OAuth URL (protected)
app.get('/chat/calendar/connect', async (c) => {
  const userId = c.get('userId');
  
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: btoa(JSON.stringify({ userId }))
  });
  
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  
  return c.json({ url });
});

export default app;
