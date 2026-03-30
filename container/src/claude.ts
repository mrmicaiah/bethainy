import Anthropic from '@anthropic-ai/sdk';
import { DataClient } from './data.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Tools bethainy can use
const tools: Anthropic.Tool[] = [
  {
    name: 'add_daily_note',
    description: 'Add a task or note to the daily notes bucket. Use for generic tasks that don\\'t belong to a specific track.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The task or note content' },
        type: { type: 'string', enum: ['task', 'note'], description: 'Whether this is a task or a note' },
        context: { type: 'string', description: 'Optional context about why this was added' }
      },
      required: ['content']
    }
  },
  {
    name: 'log_meal',
    description: 'Log a meal that was eaten',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        meal_number: { type: 'number', description: 'Meal number (1-5)' },
        foods: { type: 'array', items: { type: 'string' }, description: 'List of foods eaten' },
        protein_g: { type: 'number', description: 'Estimated protein in grams' },
        on_plan: { type: 'boolean', description: 'Whether this matches the diet plan' },
        notes: { type: 'string', description: 'Optional notes' }
      },
      required: ['date', 'meal_number', 'foods']
    }
  },
  {
    name: 'log_workout',
    description: 'Log a completed workout',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        day_type: { type: 'string', description: 'Push, Pull, or Legs' },
        duration_minutes: { type: 'number', description: 'Workout duration in minutes' },
        exercises: { 
          type: 'array', 
          items: { 
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'array', items: { type: 'object' } },
              notes: { type: 'string' }
            }
          },
          description: 'Exercises performed'
        },
        notes: { type: 'string', description: 'Overall workout notes' }
      },
      required: ['date', 'day_type']
    }
  },
  {
    name: 'add_maintenance_task',
    description: 'Add a maintenance task for car, house, or appliance',
    input_schema: {
      type: 'object',
      properties: {
        asset: { type: 'string', description: 'The asset (e.g., \"car\", \"house\", \"hvac\")' },
        task: { type: 'string', description: 'The maintenance task' },
        due_date: { type: 'string', description: 'When it\\'s due (YYYY-MM-DD or description like \"tomorrow\")' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['asset', 'task']
    }
  },
  {
    name: 'update_person',
    description: 'Update information about a person',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Person\\'s name' },
        update_type: { type: 'string', enum: ['profile', 'situation', 'timeline', 'note'], description: 'What to update' },
        content: { type: 'string', description: 'The information to add' }
      },
      required: ['name', 'update_type', 'content']
    }
  },
  {
    name: 'add_shopping_item',
    description: 'Add an item to a shopping list',
    input_schema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'Store name (e.g., \"Lowe\\'s\", \"Walmart\")' },
        item: { type: 'string', description: 'Item to buy' }
      },
      required: ['store', 'item']
    }
  },
  {
    name: 'log_expense',
    description: 'Log an expense',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount spent' },
        category: { type: 'string', description: 'Category or tracking bucket' },
        description: { type: 'string', description: 'What it was for' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' }
      },
      required: ['amount', 'description']
    }
  }
];

// Execute a tool call
async function executeTool(
  toolName: string,
  toolInput: any,
  dataClient: DataClient,
  today: string
): Promise<string> {
  console.log(`Executing tool: ${toolName}`, toolInput);
  
  try {
    switch (toolName) {
      case 'add_daily_note': {
        await dataClient.addDailyNote({
          type: toolInput.type || 'task',
          content: toolInput.content,
          context: toolInput.context
        });
        return `Added to daily notes: "${toolInput.content}"`;
      }
      
      case 'log_meal': {
        await dataClient.logMeal(toolInput.date || today, {
          meal_number: toolInput.meal_number,
          foods: toolInput.foods,
          protein_g: toolInput.protein_g || 0,
          on_plan: toolInput.on_plan ? 1 : 0,
          notes: toolInput.notes
        });
        return `Logged meal ${toolInput.meal_number}: ${toolInput.foods.join(', ')}`;
      }
      
      case 'log_workout': {
        await dataClient.logWorkout(toolInput.date || today, {
          day_type: toolInput.day_type,
          duration_minutes: toolInput.duration_minutes,
          exercises: toolInput.exercises || [],
          notes: toolInput.notes
        });
        return `Logged ${toolInput.day_type} day workout`;
      }
      
      case 'add_maintenance_task': {
        // For now, add to daily notes with context
        await dataClient.addDailyNote({
          type: 'task',
          content: `${toolInput.asset}: ${toolInput.task}${toolInput.due_date ? ` (due: ${toolInput.due_date})` : ''}`,
          context: 'maintenance'
        });
        return `Added maintenance task: ${toolInput.task} for ${toolInput.asset}`;
      }
      
      case 'update_person': {
        // For now, add to daily notes - full people tracking later
        await dataClient.addDailyNote({
          type: 'note',
          content: `${toolInput.name}: ${toolInput.content}`,
          context: `people:${toolInput.update_type}`
        });
        return `Noted about ${toolInput.name}: ${toolInput.content}`;
      }
      
      case 'add_shopping_item': {
        await dataClient.addDailyNote({
          type: 'task',
          content: `Buy ${toolInput.item} from ${toolInput.store}`,
          context: `shopping:${toolInput.store.toLowerCase()}`
        });
        return `Added to ${toolInput.store} list: ${toolInput.item}`;
      }
      
      case 'log_expense': {
        await dataClient.createEntry('money', {
          type: 'expense',
          date: toolInput.date || today,
          data: {
            amount: toolInput.amount,
            category: toolInput.category,
            description: toolInput.description
          }
        });
        return `Logged expense: $${toolInput.amount} for ${toolInput.description}`;
      }
      
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err: any) {
    console.error(`Tool error (${toolName}):`, err);
    return `Failed to ${toolName}: ${err.message}`;
  }
}

export async function chat(
  systemPrompt: string,
  messages: Message[],
  dataClient?: DataClient,
  today?: string
): Promise<string> {
  // First API call
  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    tools: tools,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  });
  
  // Handle tool use loop
  let currentMessages: any[] = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  
  while (response.stop_reason === 'tool_use') {
    // Find all tool use blocks
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
    
    // Add assistant's response to messages
    currentMessages.push({
      role: 'assistant',
      content: response.content
    });
    
    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    
    for (const toolUse of toolUseBlocks) {
      let result: string;
      
      if (dataClient && today) {
        result = await executeTool(toolUse.name, toolUse.input, dataClient, today);
      } else {
        result = `Cannot execute ${toolUse.name}: data client not available`;
      }
      
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result
      });
    }
    
    // Add tool results
    currentMessages.push({
      role: 'user',
      content: toolResults
    });
    
    // Continue conversation
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools,
      messages: currentMessages
    });
  }
  
  // Extract final text response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  
  return textBlock?.text || 'I had trouble responding. Try again?';
}
