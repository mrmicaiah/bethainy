import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface SaveInstruction {
  path: string;
  content: any;
}

export interface ChatResponse {
  message: string;
  saves: SaveInstruction[];
  listMode: boolean;
}

export async function chat(
  systemPrompt: string,
  messages: Message[]
): Promise<ChatResponse> {
  
  const structuredPrompt = systemPrompt + `

---

## Response Format

You must respond with valid JSON in this exact format:

{
  "message": "Your response to the user (plain text, conversational)",
  "saves": [
    {
      "path": "relative/path/to/file.json",
      "content": { ... }
    }
  ],
  "listMode": false
}

- "message" is what the user sees
- "saves" is an array of files to save (can be empty [])
- "listMode" is true when you are in list mode, false otherwise
- Always respond with this JSON structure, nothing else
- Do not wrap in markdown code fences
`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: structuredPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  });
  
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  
  const rawText = textBlock?.text || "";
  
  try {
    let jsonStr = rawText.trim();
    
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      message: parsed.message || rawText,
      saves: Array.isArray(parsed.saves) ? parsed.saves : [],
      listMode: parsed.listMode === true
    };
  } catch (err) {
    console.error("Failed to parse Claude response as JSON:", err);
    console.error("Raw response:", rawText.substring(0, 500));
    
    return {
      message: rawText,
      saves: [],
      listMode: false
    };
  }
}
