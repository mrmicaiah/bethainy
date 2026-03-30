const API_URL = 'https://bethainy-api.micaiah-tasks.workers.dev';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async fetch(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async signup(email: string, name: string, pin: string) {
    return this.fetch('/users/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, pin }),
    });
  }

  async login(email: string, pin: string) {
    return this.fetch('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, pin }),
    });
  }

  // Chat
  async sendMessage(message: string, conversationId?: string) {
    return this.fetch('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
    });
  }

  async getConversations() {
    return this.fetch('/chat/conversations');
  }

  async getConversation(id: string) {
    return this.fetch(`/chat/conversations/${id}`);
  }

  // Data
  async getFeed() {
    return this.fetch('/data/feed');
  }

  async getModes() {
    return this.fetch('/data/modes');
  }

  async getTracks(mode?: string) {
    const query = mode ? `?mode=${mode}` : '';
    return this.fetch(`/data/tracks${query}`);
  }

  async getEntries(params: { type?: string; start?: string; end?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.start) query.set('start', params.start);
    if (params.end) query.set('end', params.end);
    if (params.limit) query.set('limit', params.limit.toString());
    return this.fetch(`/data/entries?${query}`);
  }

  async getDaily(date: string) {
    return this.fetch(`/data/daily/${date}`);
  }
}

export const api = new ApiClient();
