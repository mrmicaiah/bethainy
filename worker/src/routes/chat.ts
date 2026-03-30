import { Hono } from 'hono';
import { Env } from '../index';
import { getSystemPrompt } from '../lib/system-prompt';
import { getTools, handleToolCall } from '../lib/tools';

export const chatRoutes = new Hono<{ Bindings: Env }>();

// Send message
chatRoutes.post('/message', async (c) => {
  const userId = c.get('userId');
  const { message, conversationId } = await c.req.json();
  
  if (!message) {
    return c.json({ error: 'Message required' }, 400);
  }
  
  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    convId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO conversations (id, user_id) VALUES (?, ?)'
    ).bind(convId, userId).run();
  }
  
  // Save user message
  await c.env.DB.prepare(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
  ).bind(convId, 'user', message).run();
  
  // Get conversation history
  const history = await c.env.DB.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at'
  ).bind(convId).all();
  
  // Build messages for Claude
  const messages = history.results.map((m: any) => ({
    role: m.role,
    content: m.content,
  }));
  
  // Get system prompt with user context
  const systemPrompt = await getSystemPrompt(c.env.DB, userId);
  
  // Call Claude
  let response = await callClaude(c.env, systemPrompt, messages);
  
  // Handle tool calls in a loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
    const toolResults = [];
    
    for (const toolUse of toolUseBlocks) {
      const result = await handleToolCall(c.env.DB, userId, toolUse.name, toolUse.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }
    
    // Add assistant response and tool results to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
    
    // Call Claude again
    response = await callClaude(c.env, systemPrompt, messages);
  }
  
  // Extract text response
  const textContent = response.content.find((b: any) => b.type === 'text');
  const assistantMessage = textContent?.text || '';
  
  // Save assistant message
  await c.env.DB.prepare(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
  ).bind(convId, 'assistant', assistantMessage).run();
  
  // Update conversation timestamp
  await c.env.DB.prepare(
    'UPDATE conversations SET last_message_at = datetime("now") WHERE id = ?'
  ).bind(convId).run();
  
  return c.json({
    conversationId: convId,
    message: assistantMessage,
  });
});

// Get conversation history
chatRoutes.get('/conversations', async (c) => {
  const userId = c.get('userId');
  
  const conversations = await c.env.DB.prepare(
    'SELECT * FROM conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT 20'
  ).bind(userId).all();
  
  return c.json(conversations.results);
});

chatRoutes.get('/conversations/:id', async (c) => {
  const userId = c.get('userId');
  const convId = c.req.param('id');
  
  const messages = await c.env.DB.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? 
     AND conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)
     ORDER BY created_at`
  ).bind(convId, userId).all();
  
  return c.json(messages.results);
});

async function callClaude(env: Env, systemPrompt: string, messages: any[]) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: getTools(),
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }
  
  return response.json();
}
