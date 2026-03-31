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

export interface CalendarAction {
  type: "create" | "update" | "delete";
  event?: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string } | { date: string };
    end: { dateTime: string; timeZone?: string } | { date: string };
    location?: string;
  };
  eventId?: string;
  updates?: any;
}

export interface ChatResponse {
  message: string;
  saves: SaveInstruction[];
  listMode: boolean;
  calendarActions: CalendarAction[];
  connectCalendar: boolean;
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
  "saves": [],
  "listMode": false,
  "calendarActions": [],
  "connectCalendar": false
}

- "message" is what the user sees
- "saves" is an array of files to save (can be empty [])
- "listMode" is true when you are in list mode, false otherwise
- "calendarActions" is an array of calendar operations (can be empty [])
- "connectCalendar" is true ONLY when the user wants to connect their calendar and it's not connected yet

### Calendar Actions

To create an event, put this in calendarActions:
{
  "type": "create",
  "event": {
    "summary": "Event title",
    "start": { "dateTime": "2026-04-01T08:00:00-05:00", "timeZone": "America/Chicago" },
    "end": { "dateTime": "2026-04-01T09:00:00-05:00", "timeZone": "America/Chicago" }
  }
}

IMPORTANT: Always respond with valid JSON only. No markdown, no explanation, just the JSON object.
`;

  try {
    console.log("Calling Anthropic API...");
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: structuredPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });
    
    console.log("Anthropic API response received");
    
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    
    const rawText = textBlock?.text || "";
    console.log("Raw response length:", rawText.length);
    console.log("Raw response preview:", rawText.substring(0, 200));
    
    try {
      let jsonStr = rawText.trim();
      
      // Remove markdown code fences if present
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
      
      console.log("JSON parsed successfully");
      console.log("Calendar actions:", parsed.calendarActions?.length || 0);
      
      return {
        message: parsed.message || rawText,
        saves: Array.isArray(parsed.saves) ? parsed.saves : [],
        listMode: parsed.listMode === true,
        calendarActions: Array.isArray(parsed.calendarActions) ? parsed.calendarActions : [],
        connectCalendar: parsed.connectCalendar === true
      };
    } catch (parseErr) {
      console.error("Failed to parse Claude response as JSON:", parseErr);
      console.error("Full raw response:", rawText);
      
      // Return the raw text as the message
      return {
        message: rawText || "I had trouble processing that. Could you try again?",
        saves: [],
        listMode: false,
        calendarActions: [],
        connectCalendar: false
      };
    }
  } catch (apiErr: any) {
    console.error("Anthropic API error:", apiErr.message || apiErr);
    throw new Error("Failed to get response from AI: " + (apiErr.message || "Unknown error"));
  }
}
