/**
 * Data client for accessing D1 via the Worker API
 * 
 * The container calls back to the worker to read/write data.
 * This mirrors the my-life repo file structure.
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

export class DataClient {
  private userId: string;
  private token: string;
  
  constructor(userId: string, token: string) {
    this.userId = userId;
    this.token = token;
    console.log('DataClient initialized:');
    console.log('  WORKER_URL:', WORKER_URL);
    console.log('  userId:', userId);
    console.log('  token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
  }
  
  private async request(path: string, options: RequestInit = {}) {
    const url = `${WORKER_URL}/data${path}`;
    console.log(`DataClient request: ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          ...options.headers,
        },
      });
      
      console.log(`DataClient response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`DataClient error response body: ${text}`);
        throw new Error(`Data API error: ${response.status} - ${text}`);
      }
      
      const data = await response.json();
      console.log(`DataClient response data:`, JSON.stringify(data).substring(0, 200));
      return data;
    } catch (err: any) {
      console.error(`DataClient fetch error:`, err.message);
      throw err;
    }
  }
  
  // ============ TRACKS ============
  
  async getTracks(mode: string): Promise<Track[]> {
    return this.request(`/tracks/${mode}`);
  }
  
  async getTrack(mode: string, trackId: string): Promise<Track | null> {
    try {
      return await this.request(`/tracks/${mode}/${trackId}`);
    } catch {
      return null;
    }
  }
  
  async saveTrack(mode: string, trackId: string, data: Partial<Track>): Promise<void> {
    await this.request(`/tracks/${mode}/${trackId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  
  // ============ ENTRIES ============
  
  async getEntries(mode: string, options?: {
    type?: string;
    start?: string;
    end?: string;
  }): Promise<Entry[]> {
    const params = new URLSearchParams();
    if (options?.type) params.set('type', options.type);
    if (options?.start) params.set('start', options.start);
    if (options?.end) params.set('end', options.end);
    
    const query = params.toString();
    return this.request(`/entries/${mode}${query ? '?' + query : ''}`);
  }
  
  async getEntriesForDate(mode: string, date: string, type?: string): Promise<Entry[]> {
    const query = type ? `?type=${type}` : '';
    return this.request(`/entries/${mode}/${date}${query}`);
  }
  
  async createEntry(mode: string, entry: {
    type: string;
    date: string;
    data: any;
    track_id?: string;
  }): Promise<{ id: number }> {
    return this.request(`/entries/${mode}`, {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }
  
  async updateEntry(id: number, data: any): Promise<void> {
    await this.request(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }
  
  // ============ DAILY ============
  
  async getDailyNotes(status: string = 'open'): Promise<DailyNote[]> {
    return this.request(`/daily/notes?status=${status}`);
  }
  
  async addDailyNote(note: { type?: string; content: string; context?: string }): Promise<{ id: number }> {
    return this.request('/daily/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }
  
  async updateDailyNote(id: number, update: { status?: string; moved_to?: string }): Promise<void> {
    await this.request(`/daily/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }
  
  async getDailyPlan(date: string): Promise<DailyPlan> {
    return this.request(`/daily/plan/${date}`);
  }
  
  async saveDailyPlan(date: string, plan: { items?: any[]; completed?: any[]; reflection?: string }): Promise<void> {
    await this.request(`/daily/plan/${date}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    });
  }
  
  // ============ SETTINGS ============
  
  async getSetting(key: string): Promise<any> {
    return this.request(`/settings/${key}`);
  }
  
  async saveSetting(key: string, value: any): Promise<void> {
    await this.request(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
  }
  
  // ============ CONVENIENCE METHODS ============
  
  // Fitness shortcuts
  async getTodaysMeals(date: string): Promise<Entry[]> {
    return this.getEntriesForDate('fitness', date, 'meal');
  }
  
  async getTodaysWorkout(date: string): Promise<Entry | null> {
    const entries = await this.getEntriesForDate('fitness', date, 'workout');
    return entries[0] || null;
  }
  
  async logMeal(date: string, mealData: any): Promise<{ id: number }> {
    return this.createEntry('fitness', {
      type: 'meal',
      date,
      data: mealData,
    });
  }
  
  async logWorkout(date: string, workoutData: any): Promise<{ id: number }> {
    return this.createEntry('fitness', {
      type: 'workout',
      date,
      data: workoutData,
    });
  }
  
  async getBodyComposition(date: string): Promise<Entry | null> {
    const entries = await this.getEntriesForDate('fitness', date, 'body_composition');
    return entries[0] || null;
  }
  
  async logBodyComposition(date: string, data: any): Promise<{ id: number }> {
    return this.createEntry('fitness', {
      type: 'body_composition',
      date,
      data,
    });
  }
}

// Types
export interface Track {
  id: string;
  user_id: string;
  mode: string;
  name: string;
  type?: string;
  behavior: 'circuit' | 'collaborative';
  status: 'active' | 'paused' | 'completed';
  plan?: any;
  progress?: any;
  profile?: any;
  situation?: any;
  preferences?: any;
  current_list?: any[];
  tasks?: any[];
  schedule?: any[];
  insights?: any[];
  resources?: any[];
  timeline?: any[];
  notes?: any[];
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: number;
  user_id: string;
  mode: string;
  type: string;
  track_id?: string;
  date: string;
  data: any;
  created_at: string;
}

export interface DailyNote {
  id: number;
  user_id: string;
  type: 'task' | 'note';
  content: string;
  context?: string;
  status: 'open' | 'done' | 'moved';
  moved_to?: string;
  created_at: string;
  completed_at?: string;
}

export interface DailyPlan {
  date: string;
  items: any[];
  completed: any[];
  reflection?: string;
}
