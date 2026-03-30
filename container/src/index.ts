import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadContext, buildSystemPrompt, detectMode } from './context.js';
import { chat } from './claude.js';

const app = new Hono();

// Load all mode files at startup
console.log('Loading mode context...');
const context = await loadContext();
console.log('Context loaded. Modes available:', Object.keys(context.modes));

// CORS
app.use('/*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => c.json({ status: 'awake', modes: Object.keys(context.modes) }));

// Wake check - quick endpoint to verify container is ready
app.get('/wake', (c) => c.json({ status: 'ready', timestamp: Date.now() }));

// Chat endpoint
app.post('/message', async (c) => {
  try {
    const { message, conversationHistory = [], userId } = await c.req.json();
    
    // Detect active mode from message
    const activeMode = detectMode(message, context);
    console.log(`Detected mode: ${activeMode || 'none'}`);
    
    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(activeMode, context);
    
    // Add user message to history
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ];
    
    // Call Claude
    const response = await chat(systemPrompt, messages);
    
    return c.json({
      message: response,
      mode: activeMode
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return c.json({ error: err.message }, 500);
  }
});

const port = parseInt(process.env.PORT || '8080');
console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});

console.log(`bethainy container running on port ${port}`);
