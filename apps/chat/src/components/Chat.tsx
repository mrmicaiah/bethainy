import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { WakeUpAnimation } from "./WakeUpAnimation";
import { getThinkingSequence } from "../lib/thinking-phrases";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatProps {
  user: { id: string; email: string; name: string | null };
  token: string;
  onLogout: () => void;
}

type ContainerState = "checking" | "waking" | "awake";

export function Chat({ user, token, onLogout }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [containerState, setContainerState] = useState<ContainerState>("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 24;
      const maxLines = 3;
      const maxHeight = lineHeight * maxLines;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  // Check if container is awake on mount
  useEffect(() => {
    checkContainerStatus();
  }, []);

  // Rotate thinking phrases while loading
  useEffect(() => {
    if (loading) {
      // Get a sequence of phrases to rotate through
      const phrases = getThinkingSequence(20);
      let index = 0;
      
      // Set initial phrase
      setThinkingPhrase(phrases[0]);
      
      // Rotate every 2-3 seconds
      thinkingIntervalRef.current = window.setInterval(() => {
        index = (index + 1) % phrases.length;
        setThinkingPhrase(phrases[index]);
      }, 2000 + Math.random() * 1000);
    } else {
      // Clear interval when not loading
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      setThinkingPhrase("");
    }
    
    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
    };
  }, [loading]);

  const checkContainerStatus = async () => {
    setContainerState("checking");
    try {
      const response = await api.wake();
      if (response.status === "awake") {
        setContainerState("awake");
      } else {
        setContainerState("waking");
      }
    } catch {
      setContainerState("waking");
    }
  };

  const handleWakeComplete = useCallback(async () => {
    const pollUntilAwake = async (attempts = 0): Promise<void> => {
      if (attempts > 30) {
        setContainerState("awake");
        return;
      }
      
      try {
        const response = await api.wake();
        if (response.status === "awake") {
          setContainerState("awake");
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
    setInput("");
    
    const newUserMsg: Message = { role: "user", content: userMessage };
    setMessages((prev) => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const fullHistory = [...messages, newUserMsg];
      const response = await api.sendMessage(userMessage, fullHistory, conversationId || undefined);
      
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }
      setMessages((prev) => [...prev, { role: "assistant", content: response.message }]);
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      if (error.message?.includes("waking") || error.status === 503) {
        setContainerState("waking");
        setMessages((prev) => prev.slice(0, -1));
        setInput(userMessage);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong: " + (error.message || "Unknown error") },
        ]);
      }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  if (containerState === "waking") {
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

  if (containerState === "checking") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Checking in...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
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

      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Hey{user.name ? " " + user.name : ""}. What's up?</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-surface-light text-gray-100"
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
              <p className="text-gray-400 italic">{thinkingPhrase}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-end gap-2 bg-surface-light rounded-2xl px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message bethainy..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
            style={{ 
              minHeight: "24px",
              maxHeight: "72px",
              overflowY: "hidden"
            }}
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
