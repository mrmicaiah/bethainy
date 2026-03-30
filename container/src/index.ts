import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadContext, buildSystemPrompt, detectMode, type Context } from "./context.js";
import { chat } from "./claude.js";
import { GitHubClient } from "./github.js";

const app = new Hono();

const USER_TIMEZONE = "America/Chicago";

function getLocalDate(offsetDays: number = 0): string {
  const now = new Date();
  const localDate = new Date(now.toLocaleString("en-US", { timeZone: USER_TIMEZONE }));
  localDate.setDate(localDate.getDate() + offsetDays);
  return localDate.toISOString().split("T")[0];
}

console.log("");
console.log("========================================");
console.log("bethainy container starting...");
console.log("========================================");
console.log("");

console.log("Loading mode context...");
let context: Context;

try {
  context = await loadContext();
  console.log("Context loaded successfully");
  console.log("  Modes available:", Object.keys(context.modes).join(", "));
} catch (err) {
  console.error("Failed to load context:", err);
  process.exit(1);
}

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) => {
  return c.json({ 
    status: "awake", 
    modes: Object.keys(context.modes),
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
    
    const github = new GitHubClient(userId);
    
    const userExists = await github.userExists();
    if (!userExists) {
      console.log("New user, initializing folder...");
      await github.initializeUser();
    }
    
    const activeMode = detectMode(message, context);
    console.log("Detected mode:", activeMode || "general");
    
    const today = getLocalDate(0);
    const yesterday = getLocalDate(-1);
    
    let userDataContext = "";
    
    try {
      const dailyNotes = await github.getDailyNotes();
      if (dailyNotes.tasks && dailyNotes.tasks.length > 0) {
        userDataContext += "\n\n## Daily Tasks\n";
        for (const task of dailyNotes.tasks) {
          const taskText = typeof task === "string" ? task : task.content || task.task;
          userDataContext += "- " + taskText + "\n";
        }
      }
      
      if (activeMode === "fitness") {
        const dietPlan = await github.getDietPlan();
        if (dietPlan && dietPlan.length > 50) {
          userDataContext += "\n\n## Diet Plan\n" + dietPlan + "\n";
        }
        
        const workoutPlan = await github.getWorkoutPlan();
        if (workoutPlan && workoutPlan.length > 50) {
          userDataContext += "\n\n## Workout Plan\n" + workoutPlan + "\n";
        }
        
        const todayMeals = await github.getMeals(today);
        if (todayMeals) {
          userDataContext += "\n\n## Todays Meals (" + today + ")\n";
          userDataContext += JSON.stringify(todayMeals, null, 2) + "\n";
        }
        
        const yesterdayMeals = await github.getMeals(yesterday);
        if (yesterdayMeals) {
          userDataContext += "\n\n## Yesterdays Meals (" + yesterday + ")\n";
          userDataContext += JSON.stringify(yesterdayMeals, null, 2) + "\n";
        }
        
        const bodyComp = await github.getBodyComposition(today) || await github.getBodyComposition(yesterday);
        if (bodyComp) {
          userDataContext += "\n\n## Recent Body Composition\n";
          userDataContext += JSON.stringify(bodyComp, null, 2) + "\n";
        }
      }
      
    } catch (err) {
      console.error("Error loading user data:", err);
    }
    
    const systemPrompt = buildSystemPrompt(activeMode, context, USER_TIMEZONE) + userDataContext;
    console.log("System prompt length:", systemPrompt.length, "chars");
    
    const messages = [
      ...conversationHistory,
      { role: "user" as const, content: message }
    ];
    
    console.log("Calling Claude...");
    const response = await chat(systemPrompt, messages, github);
    
    const duration = Date.now() - startTime;
    console.log("Response in", duration, "ms");
    
    return c.json({
      message: response,
      mode: activeMode,
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
  console.log("bethainy container running on port " + info.port);
  console.log("");
});
