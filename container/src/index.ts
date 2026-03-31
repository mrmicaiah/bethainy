import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chat } from "./claude.js";
import { GitHubClient } from "./github.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODES_DIR = path.join(__dirname, "..", "modes");

const app = new Hono();
const USER_TIMEZONE = "America/Chicago";

// Load core instructions once at startup (these are small)
let coreInstructions = "";

async function loadCoreInstructions() {
  try {
    coreInstructions = await fs.readFile(path.join(MODES_DIR, "CLAUDE-INSTRUCTIONS.md"), "utf-8");
    console.log("Core instructions loaded:", coreInstructions.length, "chars");
  } catch (err) {
    console.error("Failed to load core instructions:", err);
  }
}

// Get current time info
function getTimeContext(): { date: string; time: string; timeOfDay: string; today: string; yesterday: string } {
  const now = new Date();
  const localNow = new Date(now.toLocaleString("en-US", { timeZone: USER_TIMEZONE }));
  
  const hour = localNow.getHours();
  let timeOfDay = "morning";
  if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17) timeOfDay = "evening";
  
  const dateStr = localNow.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  const timeStr = localNow.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  
  const today = localNow.toISOString().split("T")[0];
  const yesterday = new Date(localNow);
  yesterday.setDate(yesterday.getDate() - 1);
  
  return {
    date: dateStr,
    time: timeStr,
    timeOfDay,
    today,
    yesterday: yesterday.toISOString().split("T")[0]
  };
}

// Simple mode detection - just keywords, no loading
function detectMode(message: string): string {
  const lower = message.toLowerCase();
  
  // Fitness
  if (/\b(gym|workout|train|exercise|meal|eat|lunch|dinner|breakfast|protein|calories|push day|pull day|leg day)\b/.test(lower)) {
    return "fitness";
  }
  
  // Maintenance
  if (/\b(tire|oil change|car|maintenance|repair|filter|brake|battery|mechanic|house|hvac|plumbing|appliance|fix)\b/.test(lower)) {
    return "maintenance";
  }
  
  // Shopping
  if (/\b(store|lowe's|lowes|walmart|target|costco|shopping|grocery|buy)\b/.test(lower)) {
    return "shopping";
  }
  
  // Money
  if (/\b(spent \$|budget|expense|cost|track spending)\b/.test(lower)) {
    return "money";
  }
  
  // Journal
  if (/\b(journal|journaling|reflect)\b/.test(lower)) {
    return "journal";
  }
  
  // Faith
  if (/\b(devotional|bible|prayer|quiet time|scripture|spiritual|faith)\b/.test(lower)) {
    return "faith";
  }
  
  // Learning
  if (/\b(course|learning|studying|lesson|module|certification|tutorial)\b/.test(lower)) {
    return "learning";
  }
  
  // Projects
  if (/\b(working on|project)\b/.test(lower)) {
    return "projects";
  }
  
  // Daily (catch-all for greetings and day planning)
  if (/\b(good morning|good afternoon|good evening|what's my day|today|tomorrow)\b/.test(lower)) {
    return "daily";
  }
  
  return "general";
}

// Build minimal system prompt - just instructions + time context
function buildSystemPrompt(mode: string, timeCtx: ReturnType<typeof getTimeContext>): string {
  let prompt = coreInstructions;
  
  prompt += "\n\n---\n\n";
  prompt += "## Current Context\n\n";
  prompt += "- **Date**: " + timeCtx.date + "\n";
  prompt += "- **Time**: " + timeCtx.time + " (" + timeCtx.timeOfDay + ")\n";
  prompt += "- **Today's date for files**: " + timeCtx.today + "\n";
  prompt += "- **Yesterday's date for files**: " + timeCtx.yesterday + "\n";
  prompt += "- **Active mode**: " + mode + "\n";
  
  prompt += "\n---\n\n";
  prompt += "## File Structure\n\n";
  prompt += "User data is in their folder. Key paths:\n";
  prompt += "- `daily/notes.json` - Tasks and notes\n";
  prompt += "- `fitness/diet-plan.md` - Nutrition plan\n";
  prompt += "- `fitness/workout-plan.md` - Workout split\n";
  prompt += "- `fitness/meals/YYYY-MM-DD.json` - Daily meals\n";
  prompt += "- `fitness/workouts/YYYY-MM-DD.json` - Workout logs\n";
  prompt += "- `fitness/body-composition/YYYY-MM-DD.json` - Weigh-ins\n";
  prompt += "- `maintenance/tracks/*.json` - Maintenance items\n";
  prompt += "- `shopping/tracks/*.json` - Shopping lists\n";
  prompt += "- `people/tracks/*.json` - People profiles\n";
  prompt += "- `projects/tracks/*.json` - Project files\n";
  prompt += "- `money/tracking/*.json` - Expense tracking\n";
  prompt += "- `journal/entries/*.json` - Journal entries\n";
  
  prompt += "\n**Use your tools to read files when you need data. Don't guess.**\n";
  
  return prompt;
}

// Startup
console.log("");
console.log("========================================");
console.log("BethAiny container starting...");
console.log("========================================");
console.log("");

await loadCoreInstructions();

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) => {
  return c.json({ 
    status: "awake",
    uptime: process.uptime()
  });
});

app.get("/wake", (c) => {
  return c.json({ 
    status: "ready", 
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

app.post("/message", async (c) => {
  const startTime = Date.now();
  
  try {
    const body = await c.req.json();
    const { message, conversationHistory = [] } = body;
    const userId = c.req.header("X-User-Id") || body.userId;
    
    console.log("");
    console.log("--- New message ---");
    console.log("User:", userId || "unknown");
    console.log("Message:", message.substring(0, 100));
    
    // Create GitHub client
    const github = new GitHubClient(userId);
    
    // Check if new user (this is the only pre-check we do)
    const userExists = await github.userExists();
    if (!userExists) {
      console.log("New user, initializing folder...");
      await github.initializeUser();
    }
    
    // Detect mode (no API calls)
    const mode = detectMode(message);
    console.log("Mode:", mode);
    
    // Get time context (no API calls)
    const timeCtx = getTimeContext();
    
    // Build minimal system prompt (no API calls)
    const systemPrompt = buildSystemPrompt(mode, timeCtx);
    console.log("System prompt:", systemPrompt.length, "chars");
    
    // Prepare messages
    const messages = [
      ...conversationHistory,
      { role: "user" as const, content: message }
    ];
    
    // Call Claude - let IT decide what to fetch
    console.log("Calling Claude...");
    const response = await chat(systemPrompt, messages, github);
    
    const duration = Date.now() - startTime;
    console.log("Response in", duration, "ms");
    
    return c.json({
      message: response,
      mode,
      timing: { duration }
    });
  } catch (err) {
    const error = err as Error;
    console.error("Chat error:", error);
    return c.json({ error: error.message }, 500);
  }
});

const port = parseInt(process.env.PORT || "8080");

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log("");
  console.log("BethAiny container running on port " + info.port);
  console.log("");
});
