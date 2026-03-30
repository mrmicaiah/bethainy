import Anthropic from '@anthropic-ai/sdk';
import { GitHubClient } from './github.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// GitHub-based tools - Claude can read/write any file
const tools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read a file from the user\'s data folder. Returns file content or null if not found.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { 
          type: 'string', 
          description: 'File path relative to user folder (e.g., "daily/notes.json", "fitness/meals/2026-03-30.json")' 
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write/create a file in the user\'s data folder. Creates directories as needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { 
          type: 'string', 
          description: 'File path relative to user folder' 
        },
        content: { 
          type: 'string', 
          description: 'File content (JSON should be stringified)' 
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory in the user\'s data folder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { 
          type: 'string', 
          description: 'Directory path relative to user folder (e.g., "fitness/workouts", "people/tracks")' 
        }
      },
      required: ['path']
    }
  }
];

// Execute a tool call
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  github: GitHubClient
): Promise<string> {
  console.log('Executing tool:', toolName, JSON.stringify(toolInput).substring(0, 200));
  
  try {
    switch (toolName) {
      case 'read_file': {
        const file = await github.getFile(toolInput.path as string);
        if (file) {
          return file.content;
        } else {
          return 'File not found: ' + toolInput.path;
        }
      }
      
      case 'write_file': {
        await github.putFile(toolInput.path as string, toolInput.content as string);
        return 'Saved: ' + toolInput.path;
      }
      
      case 'list_files': {
        const files = await github.listDir(toolInput.path as string);
        if (files.length === 0) {
          return 'No files in: ' + toolInput.path;
        }
        return files.join('\n');
      }
      
      default:
        return 'Unknown tool: ' + toolName;
    }
  } catch (err) {
    const error = err as Error;
    console.error('Tool error (' + toolName + '):', error);
    return 'Error: ' + error.message;
  }
}

export async function chat(
  systemPrompt: string,
  messages: Message[],
  github: GitHubClient
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
  let currentMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content
  }));
  
  let iterations = 0;
  const maxIterations = 10;
  
  while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
    iterations++;
    
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
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>, github);
      
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
