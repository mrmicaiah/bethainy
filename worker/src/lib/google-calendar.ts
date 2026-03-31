/**
 * Google Calendar API wrapper
 */

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

interface Tokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
}

export class GoogleCalendar {
  private env: Env;
  private userId: string;
  private tokens: Tokens | null = null;
  
  constructor(env: Env, userId: string) {
    this.env = env;
    this.userId = userId;
  }
  
  // Load tokens from D1
  async loadTokens(): Promise<boolean> {
    const result = await this.env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM google_tokens WHERE user_id = ?'
    ).bind(this.userId).first<Tokens>();
    
    if (!result) {
      return false;
    }
    
    this.tokens = result;
    return true;
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.tokens !== null;
  }
  
  // Refresh token if needed
  private async ensureValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not connected to Google Calendar');
    }
    
    // If token expires in less than 5 minutes, refresh it
    if (Date.now() > this.tokens.expires_at - (5 * 60 * 1000)) {
      if (!this.tokens.refresh_token) {
        throw new Error('No refresh token available. Please reconnect.');
      }
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.env.GOOGLE_CLIENT_ID,
          client_secret: this.env.GOOGLE_CLIENT_SECRET,
          refresh_token: this.tokens.refresh_token,
          grant_type: 'refresh_token'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh token. Please reconnect.');
      }
      
      const newTokens = await response.json() as {
        access_token: string;
        expires_in: number;
      };
      
      const expiresAt = Date.now() + (newTokens.expires_in * 1000);
      
      // Update in D1
      await this.env.DB.prepare(`
        UPDATE google_tokens 
        SET access_token = ?, expires_at = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).bind(newTokens.access_token, expiresAt, this.userId).run();
      
      this.tokens.access_token = newTokens.access_token;
      this.tokens.expires_at = expiresAt;
    }
    
    return this.tokens.access_token;
  }
  
  // Make authenticated request to Calendar API
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.ensureValidToken();
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Calendar API error: ${response.status} - ${err}`);
    }
    
    return response.json();
  }
  
  // Get upcoming events
  async getUpcomingEvents(maxResults: number = 10, timeMin?: string): Promise<any[]> {
    const min = timeMin || new Date().toISOString();
    
    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      timeMin: min,
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    
    const result = await this.request(`/calendars/primary/events?${params}`);
    return result.items || [];
  }
  
  // Get events for a specific day
  async getEventsForDay(date: string): Promise<any[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    
    const result = await this.request(`/calendars/primary/events?${params}`);
    return result.items || [];
  }
  
  // Create an event
  async createEvent(event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string } | { date: string };
    end: { dateTime: string; timeZone?: string } | { date: string };
    location?: string;
    reminders?: any;
  }): Promise<any> {
    return this.request('/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify(event)
    });
  }
  
  // Update an event
  async updateEvent(eventId: string, updates: any): Promise<any> {
    return this.request(`/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }
  
  // Delete an event
  async deleteEvent(eventId: string): Promise<void> {
    await this.ensureValidToken();
    const token = this.tokens!.access_token;
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete event: ${response.status}`);
    }
  }
  
  // Find free time slots
  async findFreeTime(date: string, durationMinutes: number = 60): Promise<string[]> {
    const events = await this.getEventsForDay(date);
    
    // Simple implementation: find gaps between events
    const busyTimes = events
      .filter((e: any) => e.start?.dateTime && e.end?.dateTime)
      .map((e: any) => ({
        start: new Date(e.start.dateTime),
        end: new Date(e.end.dateTime)
      }));
    
    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0); // 8 AM
    
    const dayEnd = new Date(date);
    dayEnd.setHours(18, 0, 0, 0); // 6 PM
    
    const freeSlots: string[] = [];
    let current = dayStart;
    
    for (const busy of busyTimes) {
      if (busy.start > current) {
        const gap = (busy.start.getTime() - current.getTime()) / (1000 * 60);
        if (gap >= durationMinutes) {
          freeSlots.push(
            `${current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${busy.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          );
        }
      }
      current = busy.end > current ? busy.end : current;
    }
    
    // Check time after last event
    if (current < dayEnd) {
      const gap = (dayEnd.getTime() - current.getTime()) / (1000 * 60);
      if (gap >= durationMinutes) {
        freeSlots.push(
          `${current.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${dayEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        );
      }
    }
    
    return freeSlots;
  }
}
