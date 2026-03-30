import { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, token, login, signup, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={login} onSignup={signup} />;
  }

  return <Chat user={user} token={token!} onLogout={logout} />;
}
