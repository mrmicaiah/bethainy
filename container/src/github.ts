/**
 * GitHub client for reading/writing user data
 * 
 * Each user has a folder: users/{user_id}/
 * Claude reads and writes files freely, just like my-life project
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_REPO = process.env.DATA_REPO || 'mrmicaiah/bethainy-data';

export class GitHubClient {
  private userId: string;
  private basePath: string;
  
  constructor(userId: string) {
    this.userId = userId;
    this.basePath = `users/${userId}`;
  }
  
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${text}`);
    }
    
    return response.json();
  }
  
  // Get file content
  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const fullPath = `${this.basePath}/${path}`;
      const data = await this.request(`/repos/${DATA_REPO}/contents/${fullPath}`);
      
      if (data.type !== 'file') {
        return null;
      }
      
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    } catch (err: any) {
      if (err.message.includes('404')) {
        return null;
      }
      throw err;
    }
  }
  
  // Create or update file
  async putFile(path: string, content: string, message?: string): Promise<void> {
    const fullPath = `${this.basePath}/${path}`;
    
    // Check if file exists to get SHA
    let sha: string | undefined;
    try {
      const existing = await this.getFile(path);
      if (existing) {
        sha = existing.sha;
      }
    } catch {
      // File doesn't exist, that's fine
    }
    
    await this.request(`/repos/${DATA_REPO}/contents/${fullPath}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: message || `Update ${path}`,
        content: Buffer.from(content).toString('base64'),
        sha
      })
    });
  }
  
  // List files in a directory
  async listDir(path: string): Promise<string[]> {
    try {
      const fullPath = `${this.basePath}/${path}`;
      const data = await this.request(`/repos/${DATA_REPO}/contents/${fullPath}`);
      
      if (!Array.isArray(data)) {
        return [];
      }
      
      return data.map((item: any) => item.name);
    } catch {
      return [];
    }
  }
  
  // Check if user folder exists
  async userExists(): Promise<boolean> {
    try {
      await this.request(`/repos/${DATA_REPO}/contents/${this.basePath}`);
      return true;
    } catch {
      return false;
    }
  }
  
  // Initialize new user with template structure
  async initializeUser(): Promise<void> {
    console.log(`Initializing user folder: ${this.basePath}`);
    
    // Create initial files
    const files = [
      {
        path: 'daily/notes.json',
        content: JSON.stringify({
          description: "Ongoing bucket of generic tasks and notes.",
          tasks: [],
          notes: []
        }, null, 2)
      },
      {
        path: 'fitness/diet-plan.md',
        content: '# Diet Plan\n\n*To be customized*\n'
      },
      {
        path: 'fitness/workout-plan.md',
        content: '# Workout Plan\n\n*To be customized*\n'
      },
      {
        path: 'journal/journal.json',
        content: JSON.stringify({ purpose: null, preferences: {} }, null, 2)
      }
    ];
    
    for (const file of files) {
      await this.putFile(file.path, file.content, `Initialize ${file.path}`);
    }
    
    console.log('User folder initialized');
  }
  
  // ============ CONVENIENCE METHODS ============
  
  // Daily
  async getDailyNotes(): Promise<any> {
    const file = await this.getFile('daily/notes.json');
    return file ? JSON.parse(file.content) : { tasks: [], notes: [] };
  }
  
  async saveDailyNotes(notes: any): Promise<void> {
    await this.putFile('daily/notes.json', JSON.stringify(notes, null, 2));
  }
  
  async getDailyPlan(date: string): Promise<any> {
    const file = await this.getFile(`daily/plans/${date}.json`);
    return file ? JSON.parse(file.content) : null;
  }
  
  async saveDailyPlan(date: string, plan: any): Promise<void> {
    await this.putFile(`daily/plans/${date}.json`, JSON.stringify(plan, null, 2));
  }
  
  // Lists
  async getActiveList(): Promise<any> {
    const file = await this.getFile('daily/lists.json');
    return file ? JSON.parse(file.content) : null;
  }
  
  async saveActiveList(list: any): Promise<void> {
    await this.putFile('daily/lists.json', JSON.stringify(list, null, 2));
  }
  
  // Fitness
  async getDietPlan(): Promise<string> {
    const file = await this.getFile('fitness/diet-plan.md');
    return file?.content || '';
  }
  
  async getWorkoutPlan(): Promise<string> {
    const file = await this.getFile('fitness/workout-plan.md');
    return file?.content || '';
  }
  
  async getWorkout(date: string): Promise<any> {
    const file = await this.getFile(`fitness/workouts/${date}.json`);
    return file ? JSON.parse(file.content) : null;
  }
  
  async saveWorkout(date: string, workout: any): Promise<void> {
    await this.putFile(`fitness/workouts/${date}.json`, JSON.stringify(workout, null, 2));
  }
  
  async getMeals(date: string): Promise<any> {
    const file = await this.getFile(`fitness/meals/${date}.json`);
    return file ? JSON.parse(file.content) : null;
  }
  
  async saveMeals(date: string, meals: any): Promise<void> {
    await this.putFile(`fitness/meals/${date}.json`, JSON.stringify(meals, null, 2));
  }
  
  async getBodyComposition(date: string): Promise<any> {
    const file = await this.getFile(`fitness/body-composition/${date}.json`);
    return file ? JSON.parse(file.content) : null;
  }
  
  // Tracks (generic)
  async getTrack(mode: string, trackId: string): Promise<any> {
    const file = await this.getFile(`${mode}/tracks/${trackId}.json`);
    return file ? JSON.parse(file.content) : null;
  }
  
  async saveTrack(mode: string, trackId: string, track: any): Promise<void> {
    await this.putFile(`${mode}/tracks/${trackId}.json`, JSON.stringify(track, null, 2));
  }
  
  async listTracks(mode: string): Promise<string[]> {
    const files = await this.listDir(`${mode}/tracks`);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  }
}
