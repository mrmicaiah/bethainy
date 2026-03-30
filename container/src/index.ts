import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadContext, buildSystemPrompt, detectMode, type Context } from './context.js';
import { chat } from './claude.js';
import { DataClient } from './data.js';

const app = new Hono();

// User's timezone
const USER_TIMEZONE = 'America/Chicago';

// Get date string in user's timezone
function getLocalDate(offsetDays: number = 0): string {
  const now = new Date();
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: USER_TIMEZONE }));
  localDate.setDate(localDate.getDate() + offsetDays);
  return localDate.toISOString().split('T')[0];
}

// Load all mode files at startup
console.log('\\n========================================');
console.log('bethainy container starting...');
console.log('========================================\\n');

console.log('Loading mode context...');
let context: Context;

try {
  context = await loadContext();
  console.log('✓ Context loaded successfully');
  console.log('  Modes available:', Object.keys(context.modes).join(', '));
} catch (err) {
  console.error('✗ Failed to load context:', err);
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

// Wake check
app.get('/wake', (c) => {
  return c.json({ 
    status: 'ready', 
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// Build user data context from D1
async function buildUserDataContext(data: DataClient, today: string, yesterday: string): Promise<string> {
  let ctx = '';
  
  try {
    // ===== DAILY NOTES =====
    const dailyNotes = await data.getDailyNotes('open');
    if (dailyNotes.length > 0) {
      ctx += '\\n\\n## Daily Notes (Open Tasks)\\n';
      dailyNotes.forEach((note: any) => {
        const noteData = typeof note === 'object' ? note : {};
        ctx += `- ${noteData.content || note}`;
        if (noteData.context) ctx += ` (${noteData.context})`;
        ctx += '\\n';
      });
    }
    
    // ===== TODAY'S MEALS =====
    const todaysMeals = await data.getTodaysMeals(today);
    if (todaysMeals.length > 0) {
      ctx += `\\n\\n## Today's Meals (${today})\\n`;
      todaysMeals.forEach((meal: any) => {
        const m = typeof meal.data === 'string' ? JSON.parse(meal.data) : meal.data;
        const foods = m.foods ? m.foods.join(', ') : m.description || 'logged';
        ctx += `- Meal ${m.meal_number || '?'}: ${foods} (${m.protein_g || 0}g protein)\\n`;
      });
    } else {
      ctx += `\\n\\n## Today's Meals (${today})\\nNo meals logged yet today.\\n`;
    }
    
    // ===== YESTERDAY'S MEALS =====
    const yesterdaysMeals = await data.getTodaysMeals(yesterday);
    if (yesterdaysMeals.length > 0) {
      ctx += `\\n\\n## Yesterday's Meals (${yesterday})\\n`;
      let totalProtein = 0;
      yesterdaysMeals.forEach((meal: any) => {
        const m = typeof meal.data === 'string' ? JSON.parse(meal.data) : meal.data;
        const foods = m.foods ? m.foods.join(', ') : m.description || 'logged';
        ctx += `- Meal ${m.meal_number || '?'}: ${foods} (${m.protein_g || 0}g protein)\\n`;
        totalProtein += m.protein_g || 0;
      });
      ctx += `Total protein yesterday: ${totalProtein}g\\n`;
    }
    
    // ===== RECENT WORKOUTS =====
    const weekAgo = getLocalDate(-7);
    const recentWorkouts = await data.getEntries('fitness', {
      type: 'workout',
      start: weekAgo,
      end: today
    });
    if (recentWorkouts.length > 0) {
      ctx += '\\n\\n## Recent Workouts\\n';
      recentWorkouts.forEach((workout: any) => {
        const w = typeof workout.data === 'string' ? JSON.parse(workout.data) : workout.data;
        ctx += `- ${workout.date}: ${w.day_type} day (${w.duration_minutes || '?'} min)\\n`;
      });
    }
    
    // ===== BODY COMPOSITION =====
    const recentComp = await data.getEntries('fitness', {
      type: 'body_composition',
      start: weekAgo,
      end: today
    });
    if (recentComp.length > 0) {
      const latest = recentComp[0];
      const comp = typeof latest.data === 'string' ? JSON.parse(latest.data) : latest.data;
      ctx += `\\n\\n## Latest Weigh-In (${latest.date})\\n`;
      ctx += `- Weight: ${comp.weight_lb} lbs\\n`;
      ctx += `- Body Fat: ${comp.body_fat_pct}%\\n`;
      ctx += `- Muscle Mass: ${comp.muscle_mass_lb} lbs\\n`;
    }
    
    // ===== ALL TRACKS =====
    // Load tracks from all modes
    const modes = ['fitness', 'people', 'projects', 'shopping', 'maintenance', 'money', 'learning', 'faith'];
    for (const mode of modes) {
      try {
        const tracks = await data.getTracks(mode);
        if (tracks && tracks.length > 0) {
          ctx += `\\n\\n## ${mode.charAt(0).toUpperCase() + mode.slice(1)} Tracks\\n`;
          tracks.forEach((track: any) => {
            ctx += `- ${track.name}`;
            if (track.status && track.status !== 'active') ctx += ` (${track.status})`;
            ctx += '\\n';
            
            // Include relevant track data
            if (track.current_list) {
              const list = typeof track.current_list === 'string' ? JSON.parse(track.current_list) : track.current_list;
              if (Array.isArray(list) && list.length > 0) {
                list.forEach((item: any) => {
                  const itemText = typeof item === 'string' ? item : item.item || item.content;
                  ctx += `  - ${itemText}\\n`;
                });
              }
            }
            
            if (track.tasks) {
              const tasks = typeof track.tasks === 'string' ? JSON.parse(track.tasks) : track.tasks;
              if (Array.isArray(tasks) && tasks.length > 0) {
                tasks.forEach((task: any) => {
                  const taskText = typeof task === 'string' ? task : task.task || task.content;
                  ctx += `  - ${taskText}\\n`;
                });
              }
            }
            
            if (track.situation) {
              const situation = typeof track.situation === 'string' ? JSON.parse(track.situation) : track.situation;
              if (situation && Object.keys(situation).length > 0) {
                ctx += `  Current: ${JSON.stringify(situation)}\\n`;
              }
            }
          });
        }
      } catch (err) {
        // Mode might not have tracks yet
      }
    }
    
  } catch (err) {
    console.error('Error building user data context:', err);
    ctx += `\\n\\n## User Data\\nError loading: ${err}\\n`;
  }
  
  return ctx;
}

// Chat endpoint
app.post('/message', async (c) => {
  const startTime = Date.now();
  
  try {
    const body = await c.req.json();
    const { message, conversationHistory = [] } = body;
    
    const userId = c.req.header('X-User-Id') || body.userId;
    const token = c.req.header('X-Auth-Token') || '';
    
    console.log('\\n--- New message ---');
    console.log('User:', userId || 'unknown');
    console.log('Message:', message.substring(0, 100));
    
    // Create data client
    const data = new DataClient(userId, token);
    
    // Detect mode
    const activeMode = detectMode(message, context);
    console.log('Detected mode:', activeMode || 'general');
    
    // Get dates
    const today = getLocalDate(0);
    const yesterday = getLocalDate(-1);
    
    // Load ALL user data
    const userDataContext = await buildUserDataContext(data, today, yesterday);
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(activeMode, context, USER_TIMEZONE) + userDataContext;
    console.log('System prompt length:', systemPrompt.length, 'chars');
    
    // Prepare messages
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ];
    
    // Call Claude with data client for tool execution
    console.log('Calling Claude...');
    const response = await chat(systemPrompt, messages, data, today);
    
    const duration = Date.now() - startTime;
    console.log('Response in', duration, 'ms');
    
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
  console.log(`\\nbethainy container running on port ${info.port}\\n`);
});
