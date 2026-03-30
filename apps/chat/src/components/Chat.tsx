import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { WakeUpAnimation } from './WakeUpAnimation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  user: { id: string; email: string; name: string | null };
  token: string;
  onLogout: () => void;
}

type ContainerState = 'checking' | 'waking' | 'awake';

export function Chat({ user, token, onLogout }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [containerState, setContainerState] = useState<ContainerState>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if container is awake on mount
  useEffect(() => {
    checkContainerStatus();
  }, []);

  const checkContainerStatus = async () => {
    setContainerState('checking');
    try {
      const response = await api.wake();
      if (response.status === 'awake') {
        setContainerState('awake');
      } else {
        setContainerState('waking');
      }
    } catch {
      // Container is starting up
      setContainerState('waking');
    }
  };

  const handleWakeComplete = useCallback(async () => {
    // Poll until container is actually ready
    const pollUntilAwake = async (attempts = 0): Promise<void> => {
      if (attempts > 30) {
        // Give up after ~30 seconds
        setContainerState('awake'); // Let them try anyway
        return;
      }
      
      try {
        const response = await api.wake();
        if (response.status === 'awake') {
          setContainerState('awake');
          inputRef.current?.focus();
        } else {
          setTimeout(() => pollUntilAwake(attempts + 1), 1000);
        }
      } catch {
        setTimeout(() => pollUntilAwake(attempts + 1), 1000);
      }
    };
    
    await pollUntilAwake();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await api.sendMessage(userMessage, messages, conversationId || undefined);
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);
    } catch (err: any) {
      // Check if it's a wake-up issue
      if (err.message?.includes('waking') || err.status === 503) {
        setContainerState('waking');
        setMessages((prev) => prev.slice(0, -1)); // Remove the user message
        setInput(userMessage); // Put the message back
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Something went wrong: ${err.message}` },
        ]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  // Show wake-up animation if container is starting
  if (containerState === 'waking') {
    return (
      <div className="h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="w-12" />
          <h1 className="font-semibold">bethainy</h1>
          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            Logout
          </button>
        </header>
        <div className="flex-1">
          <WakeUpAnimation onAwake={handleWakeComplete} />
        </div>
      </div>
    );
  }

  // Show loading spinner while checking
  if (containerState === 'checking') {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Checking in...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={startNewChat}
          className="text-gray-400 hover:text-white transition-colors"
        >
          + New
        </button>
        <h1 className="font-semibold">bethainy</h1>
        <button
          onClick={onLogout}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          Logout
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Hey{user.name ? ` ${user.name}` : ''}. What's up?</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-surface-light text-gray-100'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-light px-4 py-2 rounded-2xl">
              <p className="text-gray-400">...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-end gap-2 bg-surface-light rounded-2xl px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message bethainy..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="text-primary disabled:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
