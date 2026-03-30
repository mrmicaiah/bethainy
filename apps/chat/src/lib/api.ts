const API_URL = import.meta.env.VITE_API_URL || 'https://bethainy.micaiah-tasks.workers.dev';

class Api {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request(path: string, options: RequestInit = {}) {
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

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || 'Request failed') as any;
      error.status = response.status;
      throw error;
    }

    return data;
  }

  // Auth
  async signup(email: string, password: string, name?: string) {
    return this.request('/users/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string) {
    return this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Wake check
  async wake() {
    return this.request('/wake');
  }

  // Chat
  async sendMessage(
    message: string,
    conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [],
    conversationId?: string
  ) {
    return this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ 
        message, 
        conversationHistory,
        conversationId 
      }),
    });
  }
}

export const api = new Api();
