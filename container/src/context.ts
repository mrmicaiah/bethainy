import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODES_DIR = path.join(__dirname, '..', 'modes');

export interface ModeContext {
  instructions: string;
  mode: string;
  dietPlan?: string;
  workoutPlan?: string;
}

export interface Context {
  instructions: string;
  modeSystem: string;
  modes: Record<string, ModeContext>;
}

async function readFile(filepath: string): Promise<string> {
  try {
    return await fs.readFile(filepath, 'utf-8');
  } catch {
    return '';
  }
}

export async function loadContext(): Promise<Context> {
  const instructions = await readFile(path.join(MODES_DIR, 'CLAUDE-INSTRUCTIONS.md'));
  const modeSystem = await readFile(path.join(MODES_DIR, 'MODE-SYSTEM.md'));
  
  // Load all modes
  const modes: Record<string, ModeContext> = {};
  
  // Fitness mode (with extra files)
  modes.fitness = {
    instructions: await readFile(path.join(MODES_DIR, 'fitness', 'MODE.md')),
    mode: 'fitness',
    dietPlan: await readFile(path.join(MODES_DIR, 'fitness', 'diet-plan.md')),
    workoutPlan: await readFile(path.join(MODES_DIR, 'fitness', 'workout-plan.md'))
  };
  
  // All other modes
  const modeNames = ['daily', 'maintenance', 'people', 'projects', 'shopping', 'money', 'journal', 'faith', 'learning'];
  
  for (const modeName of modeNames) {
    modes[modeName] = {
      instructions: await readFile(path.join(MODES_DIR, modeName, 'MODE.md')),
      mode: modeName
    };
  }
  
  return {
    instructions,
    modeSystem,
    modes
  };
}

export function detectMode(message: string, context: Context): string | null {
  const lower = message.toLowerCase();
  
  // Maintenance triggers (check first - specific)
  const maintenanceTriggers = [
    'tire', 'tires', 'oil change', 'car', 'maintenance', 'repair',
    'filter', 'brake', 'battery', 'mechanic', 'service', 'rotate',
    'house', 'hvac', 'plumbing', 'appliance', 'fix'
  ];
  if (maintenanceTriggers.some(t => lower.includes(t))) {
    return 'maintenance';
  }
  
  // Fitness triggers
  const fitnessTriggers = [
    'gym', 'workout', 'train', 'exercise',
    'eat', 'lunch', 'dinner', 'breakfast', 'meal',
    'protein', 'calories', 'macros',
    'push day', 'pull day', 'leg day'
  ];
  if (fitnessTriggers.some(t => lower.includes(t))) {
    return 'fitness';
  }
  
  // Daily triggers
  const dailyTriggers = [
    'good morning', 'what\'s my day', 'my day', 'today', 'tomorrow',
    'what do i need to do', 'what\'s on the agenda'
  ];
  if (dailyTriggers.some(t => lower.includes(t))) {
    return 'daily';
  }
  
  // Shopping triggers
  const shoppingTriggers = [
    'at the store', 'at lowe\'s', 'at lowes', 'at walmart', 'at target',
    'at costco', 'at amazon', 'need to buy', 'shopping', 'grocery'
  ];
  if (shoppingTriggers.some(t => lower.includes(t))) {
    return 'shopping';
  }
  
  // Money triggers
  const moneyTriggers = [
    'spent $', 'spent money', 'how much have i spent', 'track spending',
    'budget', 'expense', 'cost'
  ];
  if (moneyTriggers.some(t => lower.includes(t))) {
    return 'money';
  }
  
  // Journal triggers
  const journalTriggers = [
    'journal', 'journaling', 'reflect', 'write down my thoughts'
  ];
  if (journalTriggers.some(t => lower.includes(t))) {
    return 'journal';
  }
  
  // Faith triggers
  const faithTriggers = [
    'devotional', 'bible', 'prayer', 'quiet time', 'scripture',
    'spiritual', 'faith'
  ];
  if (faithTriggers.some(t => lower.includes(t))) {
    return 'faith';
  }
  
  // Learning triggers
  const learningTriggers = [
    'course', 'learning', 'studying', 'lesson', 'module',
    'certification', 'tutorial'
  ];
  if (learningTriggers.some(t => lower.includes(t))) {
    return 'learning';
  }
  
  // Projects triggers (check for "working on" pattern)
  if (lower.includes('working on') || lower.includes('project')) {
    return 'projects';
  }
  
  // People triggers - harder to detect, usually name + info
  // This is collaborative, so default to null and let context handle it
  
  return null;
}

export function buildSystemPrompt(mode: string | null, context: Context, timezone?: string): string {
  let prompt = context.instructions + '\n\n';
  prompt += '---\n\n';
  prompt += context.modeSystem + '\n\n';
  
  if (mode && context.modes[mode]) {
    const modeCtx = context.modes[mode];
    prompt += '---\n\n';
    prompt += `# ACTIVE MODE: ${mode.toUpperCase()}\n\n`;
    prompt += modeCtx.instructions + '\n\n';
    
    if (modeCtx.dietPlan) {
      prompt += '---\n\n';
      prompt += modeCtx.dietPlan + '\n\n';
    }
    
    if (modeCtx.workoutPlan) {
      prompt += '---\n\n';
      prompt += modeCtx.workoutPlan + '\n\n';
    }
  }
  
  // Add current date/time in user's timezone
  const tz = timezone || 'America/Chicago';
  const now = new Date();
  
  const dateStr = now.toLocaleDateString('en-US', { 
    timeZone: tz,
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  prompt += '---\n\n';
  prompt += `Current date and time: ${dateStr} at ${timeStr} (${tz})\n`;
  
  return prompt;
}
