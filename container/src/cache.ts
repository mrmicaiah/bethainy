/**
 * In-memory user data cache
 * Loads data once per session, syncs writes async
 */

import { GitHubClient } from "./github.js";

interface UserCache {
  loaded: boolean;
  loadedAt: number;
  // Core (rarely changes)
  dietPlan: string;
  workoutPlan: string;
  // Daily (changes often)
  dailyNotes: any;
  todaysMeals: any;
  yesterdaysMeals: any;
  recentWorkout: any;
  bodyComposition: any;
  // Lists
  activeList: any;
}

const cache: Map<string, UserCache> = new Map();
const pendingWrites: Map<string, Array<{ path: string; content: string }>> = new Map();

export async function getUserData(userId: string, github: GitHubClient, today: string, yesterday: string): Promise<UserCache> {
  const cached = cache.get(userId);
  if (cached && cached.loaded) {
    console.log("Cache hit for user:", userId);
    return cached;
  }
  
  console.log("Loading user data into cache:", userId);
  const startTime = Date.now();
  
  const [
    dietPlan,
    workoutPlan,
    dailyNotes,
    todaysMeals,
    yesterdaysMeals,
    recentWorkout,
    bodyComposition,
    activeList
  ] = await Promise.all([
    github.getDietPlan().catch(() => ""),
    github.getWorkoutPlan().catch(() => ""),
    github.getDailyNotes().catch(() => ({ tasks: [], notes: [] })),
    github.getMeals(today).catch(() => null),
    github.getMeals(yesterday).catch(() => null),
    github.getWorkout(today).catch(() => null),
    github.getBodyComposition(today).catch(() => null),
    github.getActiveList().catch(() => null)
  ]);
  
  const userData: UserCache = {
    loaded: true,
    loadedAt: Date.now(),
    dietPlan,
    workoutPlan,
    dailyNotes,
    todaysMeals,
    yesterdaysMeals,
    recentWorkout,
    bodyComposition,
    activeList
  };
  
  cache.set(userId, userData);
  console.log("User data cached in", Date.now() - startTime, "ms");
  
  return userData;
}

export function updateCache(userId: string, key: keyof UserCache, value: any): void {
  const cached = cache.get(userId);
  if (cached) {
    (cached as any)[key] = value;
  }
}

export function queueWrite(userId: string, path: string, content: string): void {
  if (!pendingWrites.has(userId)) {
    pendingWrites.set(userId, []);
  }
  pendingWrites.get(userId)!.push({ path, content });
}

export async function flushWrites(userId: string, github: GitHubClient): Promise<void> {
  const writes = pendingWrites.get(userId);
  if (!writes || writes.length === 0) return;
  
  console.log("Flushing", writes.length, "pending writes for user:", userId);
  
  pendingWrites.set(userId, []);
  
  await Promise.all(
    writes.map(({ path, content }) => 
      github.putFile(path, content).catch(err => 
        console.error("Write failed:", path, err)
      )
    )
  );
  
  console.log("Writes flushed");
}

export function clearCache(userId: string): void {
  cache.delete(userId);
}
