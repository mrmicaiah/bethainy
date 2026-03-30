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
    console.log('Token present:', token ? 'yes' : 'no');
    console.log('Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    
    // Create data client for this user
    const data = new DataClient(userId, token);
    
    // Detect active mode from message
    const activeMode = detectMode(message, context);
    console.log('Detected mode:', activeMode || 'general');
    
    // Get today's date and recent dates
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('Date context:', { today, yesterday, weekAgo });
    
    // Load relevant user data for context
    let userDataContext = '';
    
    if (activeMode === 'fitness') {
      try {
        // Get today's meals
        console.log('Fetching today meals...');
        const todaysMeals = await data.getTodaysMeals(today);
        console.log('Today meals:', todaysMeals.length);
        
        if (todaysMeals.length > 0) {
          userDataContext += `\n\n## Today's Meals (${today})\n`;
          todaysMeals.forEach((meal) => {
            const m = typeof meal.data === 'string' ? JSON.parse(meal.data) : meal.data;
            const foods = m.foods ? m.foods.join(', ') : m.description || 'logged';
            userDataContext += `- Meal ${m.meal_number}: ${foods} (${m.protein_g || 0}g protein)\n`;
          });
        } else {
          userDataContext += `\n\n## Today's Meals (${today})\nNo meals logged yet today.\n`;
        }
        
        // Get yesterday's meals
        console.log('Fetching yesterday meals...');
        const yesterdaysMeals = await data.getTodaysMeals(yesterday);
        console.log('Yesterday meals:', yesterdaysMeals.length);
        
        if (yesterdaysMeals.length > 0) {
          userDataContext += `\n\n## Yesterday's Meals (${yesterday})\n`;
          let totalProtein = 0;
          yesterdaysMeals.forEach((meal) => {
            const m = typeof meal.data === 'string' ? JSON.parse(meal.data) : meal.data;
            const foods = m.foods ? m.foods.join(', ') : m.description || 'logged';
            userDataContext += `- Meal ${m.meal_number}: ${foods} (${m.protein_g || 0}g protein)\n`;
            totalProtein += m.protein_g || 0;
          });
          userDataContext += `Total protein yesterday: ${totalProtein}g\n`;
        }
        
        // Get recent workouts (last 7 days)
        console.log('Fetching recent workouts...');
        const recentWorkouts = await data.getEntries('fitness', {
          type: 'workout',
          start: weekAgo,
          end: today
        });
        console.log('Recent workouts:', recentWorkouts.length);
        
        if (recentWorkouts.length > 0) {
          userDataContext += `\n\n## Recent Workouts\n`;
          recentWorkouts.forEach((workout) => {
            const w = typeof workout.data === 'string' ? JSON.parse(workout.data) : workout.data;
            userDataContext += `- ${workout.date}: ${w.day_type} day (${w.duration_minutes || '?'} min)\n`;
          });
        }
        
        // Get recent body composition
        console.log('Fetching body composition...');
        const recentComp = await data.getEntries('fitness', {
          type: 'body_composition',
          start: weekAgo,
          end: today
        });
        console.log('Body comp entries:', recentComp.length);
        
        if (recentComp.length > 0) {
          const latest = recentComp[0];
          const comp = typeof latest.data === 'string' ? JSON.parse(latest.data) : latest.data;
          userDataContext += `\n\n## Latest Weigh-In (${latest.date})\n`;
          userDataContext += `- Weight: ${comp.weight_lb} lbs\n`;
          userDataContext += `- Body Fat: ${comp.body_fat_pct}%\n`;
          userDataContext += `- Muscle Mass: ${comp.muscle_mass_lb} lbs\n`;
          if (comp.notes) userDataContext += `- Notes: ${comp.notes}\n`;
        }
        
      } catch (err) {
        console.error('Could not load user fitness data:', err);
        userDataContext += `\n\n## User Data\nCould not load user data: ${err}\n`;
      }
    }
    
    console.log('User data context length:', userDataContext.length, 'chars');
    
    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt(activeMode, context) + userDataContext;
    console.log('Total system prompt length:', systemPrompt.length, 'chars');
    
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
