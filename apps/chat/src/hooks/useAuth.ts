import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth
    const storedToken = localStorage.getItem('bethainy_token');
    const storedUser = localStorage.getItem('bethainy_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pin: string) => {
    const response = await api.login(email, pin);
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem('bethainy_token', response.token);
    localStorage.setItem('bethainy_user', JSON.stringify(response.user));
  };

  const signup = async (email: string, name: string, pin: string) => {
    await api.signup(email, name, pin);
    // Auto-login after signup
    await login(email, pin);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('bethainy_token');
    localStorage.removeItem('bethainy_user');
  };

  return { user, token, login, signup, logout, loading };
}
