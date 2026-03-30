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
  
  // Load fitness mode with all its files
  const fitnessMode = await readFile(path.join(MODES_DIR, 'fitness', 'MODE.md'));
  const dietPlan = await readFile(path.join(MODES_DIR, 'fitness', 'diet-plan.md'));
  const workoutPlan = await readFile(path.join(MODES_DIR, 'fitness', 'workout-plan.md'));
  
  return {
    instructions,
    modeSystem,
    modes: {
      fitness: {
        instructions: fitnessMode,
        mode: 'fitness',
        dietPlan,
        workoutPlan
      }
      // Add other modes as they're built
    }
  };
}

export function detectMode(message: string, context: Context): string | null {
  const lower = message.toLowerCase();
  
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
  
  // Add more mode detection as modes are built
  
  return null;
}

export function buildSystemPrompt(mode: string | null, context: Context): string {
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
  
  // Add current date/time
  const now = new Date();
  prompt += '---\n\n';
  prompt += `Current date and time: ${now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })}\n`;
  
  return prompt;
}
