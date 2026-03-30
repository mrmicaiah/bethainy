import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadContext, buildSystemPrompt, detectMode, type Context } from './context.js';
import { chat } from './claude.js';

const app = new Hono();

// Load all mode files at startup
console.log('\n========================================');
console.log('bethainy container starting...');
console.log('========================================\n');

console.log('Loading mode context...');
let context: Context;

try {
  context = await loadContext();
  console.log('\u2713 Context loaded successfully');
  console.log('  Modes available:', Object.keys(context.modes).join(', '));
  console.log('  Instructions length:', context.instructions.length, 'chars');
  if (context.modes.fitness) {
    console.log('  Fitness mode:');
    console.log('    - Diet plan:', context.modes.fitness.dietPlan ? `${context.modes.fitness.dietPlan.length} chars` : 'not loaded');
    console.log('    - Workout plan:', context.modes.fitness.workoutPlan ? `${context.modes.fitness.workoutPlan.length} chars` : 'not loaded');
  }
} catch (err) {
  console.error('\u2717 Failed to load context:', err);
  process.exit(1);
}

// CORS
app.use('/*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => {
  return c.json({ 
    status: 'awake', 
    modes: Object.keys(context.modes),
    uptime: process.uptime()
  });
});

// Wake check - quick endpoint to verify container is ready
app.get('/wake', (c) => {
  return c.json({ 
    status: 'ready', 
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Chat endpoint
app.post('/message', async (c) => {
  const startTime = Date.now();
  
  try {
    const body = await c.req.json();
    const { message, conversationHistory = [], userId } = body;
    
    console.log('\n--- New message ---');
    console.log('User:', userId || 'unknown');
    console.log('Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    
    // Detect active mode from message
    const activeMode = detectMode(message, context);
    console.log('Detected mode:', activeMode || 'general');
    
    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(activeMode, context);
    console.log('System prompt length:', systemPrompt.length, 'chars');
    
    // Add user message to history
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ];
    
    // Call Claude
    console.log('Calling Claude...');
    const response = await chat(systemPrompt, messages);
    
    const duration = Date.now() - startTime;
    console.log('Response received in', duration, 'ms');
    console.log('Response preview:', response.substring(0, 100) + (response.length > 100 ? '...' : ''));
    
    return c.json({
      message: response,
      mode: activeMode,
      timing: { duration }
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return c.json({ error: err.message }, 500);
  }
});

const port = parseInt(process.env.PORT || '8080');

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log('\n========================================');
  console.log(`bethainy container running on port ${info.port}`);
  console.log('========================================\n');
});
