import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadContext, buildSystemPrompt, detectMode, type Context } from './context.js';
import { chat } from './claude.js';
import { DataClient } from './data.js';

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
    const { message, conversationHistory = [] } = body;
    
    // Get user context from headers
    const userId = c.req.header('X-User-Id') || body.userId;
    const token = c.req.header('X-Auth-Token') || '';
    
    console.log('\n--- New message ---');
    console.log('User:', userId || 'unknown');
    console.log('Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    
    // Create data client for this user
    const data = new DataClient(userId, token);
    
    // Detect active mode from message
    const activeMode = detectMode(message, context);
    console.log('Detected mode:', activeMode || 'general');
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Load relevant user data for context
    let userDataContext = '';
    
    if (activeMode === 'fitness') {
      try {
        // Get today's meals
        const todaysMeals = await data.getTodaysMeals(today);
        if (todaysMeals.length > 0) {
          userDataContext += `\n\n## Today's Meals So Far\n`;
          todaysMeals.forEach((meal, i) => {
            const m = meal.data;
            userDataContext += `- Meal ${m.meal_number || i + 1}: ${m.description || 'logged'}\n`;
          });
        }
        
        // Get today's workout if any
        const todaysWorkout = await data.getTodaysWorkout(today);
        if (todaysWorkout) {
          userDataContext += `\n\n## Today's Workout\n`;
          userDataContext += `Type: ${todaysWorkout.data.type || 'completed'}\n`;
        }
        
        // Get recent body composition
        const recentComp = await data.getEntries('fitness', {
          type: 'body_composition',
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: today
        });
        if (recentComp.length > 0) {
          const latest = recentComp[0].data;
          userDataContext += `\n\n## Latest Weigh-In (${recentComp[0].date})\n`;
          userDataContext += `Weight: ${latest.weight_lbs || latest.weight_lb} lbs\n`;
          if (latest.body_fat_pct) userDataContext += `Body Fat: ${latest.body_fat_pct}%\n`;
        }
      } catch (err) {
        console.log('Could not load user fitness data:', err);
      }
    }
    
    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(activeMode, context) + userDataContext;
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
