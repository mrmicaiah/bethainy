import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chat } from "./claude.js";
import { GitHubClient } from "./github.js";
import { getUserData, queueWrite, flushWrites, updateCache } from "./cache.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODES_DIR = path.join(__dirname, "..", "modes");

const app = new Hono();
const USER_TIMEZONE = "America/Chicago";

let coreInstructions = "";

async function loadCoreInstructions() {
  try {
    coreInstructions = await fs.readFile(path.join(MODES_DIR, "CLAUDE-INSTRUCTIONS.md"), "utf-8");
    console.log("Core instructions loaded:", coreInstructions.length, "chars");
  } catch (err) {
    console.error("Failed to load core instructions:", err);
  }
}

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

function detectMode(message: string): string {
  const lower = message.toLowerCase();
  
  if (/\b(gym|workout|train|exercise|meal|eat|eating|lunch|dinner|breakfast|protein|calories|macros|diet|food|hungry|starving|push day|pull day|leg day|weigh|weight|body fat|muscle)\b/.test(lower)) {
    return "fitness";
  }
  if (/\b(tire|oil change|car|maintenance|repair|filter|brake|battery|mechanic|house|hvac|plumbing|appliance|fix)\b/.test(lower)) {
    return "maintenance";
  }
  if (/\b(store|lowe's|lowes|walmart|target|costco|shopping|grocery|buy)\b/.test(lower)) {
    return "shopping";
  }
  if (/\b(spent \$|budget|expense|cost|track spending)\b/.test(lower)) {
    return "money";
  }
  if (/\b(journal|journaling|reflect)\b/.test(lower)) {
    return "journal";
  }
  if (/\b(devotional|bible|prayer|quiet time|scripture|spiritual|faith)\b/.test(lower)) {
    return "faith";
  }
  if (/\b(course|learning|studying|lesson|module|certification|tutorial)\b/.test(lower)) {
    return "learning";
  }
  if (/\b(working on|project)\b/.test(lower)) {
    return "projects";
  }
  if (/\b(good morning|good afternoon|good evening|what's my day|today|tomorrow)\b/.test(lower)) {
    return "daily";
  }
  
  return "general";
}

function buildSystemPrompt(mode: string, timeCtx: ReturnType<typeof getTimeContext>, userData: any): string {
  let prompt = coreInstructions;
  
  prompt += "\n\n---\n\n";
  prompt += "## Current Context\n\n";
  prompt += "- **Date**: " + timeCtx.date + "\n";
  prompt += "- **Time**: " + timeCtx.time + " (" + timeCtx.timeOfDay + ")\n";
  prompt += "- **Today's date for files**: " + timeCtx.today + "\n";
  prompt += "- **Yesterday's date for files**: " + timeCtx.yesterday + "\n";
  prompt += "- **Active mode**: " + mode + "\n";
  
  if (mode === "fitness") {
    if (userData.dietPlan) {
      prompt += "\n\n---\n\n## Diet Plan\n\n" + userData.dietPlan;
    }
    if (userData.workoutPlan) {
      prompt += "\n\n---\n\n## Workout Plan\n\n" + userData.workoutPlan;
    }
    if (userData.todaysMeals) {
      prompt += "\n\n---\n\n## Today's Meals\n\n```json\n" + JSON.stringify(userData.todaysMeals, null, 2) + "\n```";
    }
    if (userData.yesterdaysMeals) {
      prompt += "\n\n---\n\n## Yesterday's Meals\n\n```json\n" + JSON.stringify(userData.yesterdaysMeals, null, 2) + "\n```";
    }
    if (userData.recentWorkout) {
      prompt += "\n\n---\n\n## Recent Workout\n\n```json\n" + JSON.stringify(userData.recentWorkout, null, 2) + "\n```";
    }
    if (userData.bodyComposition) {
      prompt += "\n\n---\n\n## Body Composition\n\n```json\n" + JSON.stringify(userData.bodyComposition, null, 2) + "\n```";
    }
  }
  
  if (userData.dailyNotes && (userData.dailyNotes.tasks?.length > 0 || userData.dailyNotes.notes?.length > 0)) {
    prompt += "\n\n---\n\n## Daily Notes\n\n```json\n" + JSON.stringify(userData.dailyNotes, null, 2) + "\n```";
  }
  
  if (userData.activeList) {
    prompt += "\n\n---\n\n## Active List\n\n```json\n" + JSON.stringify(userData.activeList, null, 2) + "\n```";
  }
  
  prompt += "\n\n---\n\n## File Paths for Saving\n\n";
  prompt += "When you need to save data, use these paths:\n";
  prompt += "- Daily notes: `daily/notes.json`\n";
  prompt += "- Active list: `daily/lists.json`\n";
  prompt += "- Today's meals: `fitness/meals/" + timeCtx.today + ".json`\n";
  prompt += "- Today's workout: `fitness/workouts/" + timeCtx.today + ".json`\n";
  prompt += "- Maintenance: `maintenance/tracks/{item-name}.json`\n";
  prompt += "- Shopping: `shopping/tracks/{store-name}.json`\n";
  prompt += "- People: `people/tracks/{person-name}.json`\n";
  
  return prompt;
}

console.log("");
console.log("========================================");
console.log("BethAiny container starting...");
console.log("========================================");
console.log("");

await loadCoreInstructions();

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) => c.json({ status: "awake", uptime: process.uptime() }));
app.get("/wake", (c) => c.json({ status: "ready", timestamp: Date.now() }));

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
    
    const github = new GitHubClient(userId);
    
    const userExists = await github.userExists();
    if (!userExists) {
      console.log("New user, initializing...");
      await github.initializeUser();
    }
    
    const timeCtx = getTimeContext();
    const userData = await getUserData(userId, github, timeCtx.today, timeCtx.yesterday);
    
    const mode = detectMode(message);
    console.log("Mode:", mode);
    
    const systemPrompt = buildSystemPrompt(mode, timeCtx, userData);
    console.log("System prompt:", systemPrompt.length, "chars");
    
    const messages = [
      ...conversationHistory,
      { role: "user" as const, content: message }
    ];
    
    console.log("Calling Claude...");
    const response = await chat(systemPrompt, messages);
    
    const duration = Date.now() - startTime;
    console.log("Response in", duration, "ms");
    console.log("Saves:", response.saves.length);
    console.log("List mode:", response.listMode);
    
    if (response.saves.length > 0) {
      for (const save of response.saves) {
        const content = typeof save.content === "string" 
          ? save.content 
          : JSON.stringify(save.content, null, 2);
        queueWrite(userId, save.path, content);
        
        if (save.path.includes("fitness/meals/" + timeCtx.today)) {
          updateCache(userId, "todaysMeals", save.content);
        }
        if (save.path.includes("daily/lists.json")) {
          updateCache(userId, "activeList", save.content);
        }
      }
      
      flushWrites(userId, github).catch(err => 
        console.error("Background flush failed:", err)
      );
    }
    
    return c.json({
      message: response.message,
      mode,
      listMode: response.listMode,
      timing: { duration }
    });
  } catch (err) {
    const error = err as Error;
    console.error("Chat error:", error);
    return c.json({ error: error.message }, 500);
  }
});

const port = parseInt(process.env.PORT || "8080");

serve({ fetch: app.fetch, port }, (info) => {
  console.log("");
  console.log("BethAiny container running on port " + info.port);
  console.log("");
});
