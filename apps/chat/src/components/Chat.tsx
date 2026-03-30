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
  const [inputFocused, setInputFocused] = useState(false);
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
      const phrases = getThinkingSequence(20);
      let index = 0;
      
      setThinkingPhrase(phrases[0]);
      
      thinkingIntervalRef.current = window.setInterval(() => {
        index = (index + 1) % phrases.length;
        setThinkingPhrase(phrases[index]);
      }, 2000 + Math.random() * 1000);
    } else {
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

  const toggleKeyboard = () => {
    if (inputFocused) {
      inputRef.current?.blur();
      setInputFocused(false);
    } else {
      inputRef.current?.focus();
      setInputFocused(true);
    }
  };

  const handleInputFocus = () => setInputFocused(true);
  const handleInputBlur = () => setInputFocused(false);

  if (containerState === "waking") {
    return (
      <div className="h-full flex flex-col">
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface sticky top-0 z-10">
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
      {/* Fixed Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface sticky top-0 z-10">
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

      {/* Messages - scrollable area */}
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

      {/* Fixed Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-surface">
        <div className="flex items-end gap-2 bg-surface-light rounded-2xl px-4 py-2">
          {/* Keyboard toggle button */}
          <button
            onClick={toggleKeyboard}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 pb-0.5"
            aria-label={inputFocused ? "Hide keyboard" : "Show keyboard"}
          >
            {inputFocused ? (
              // Keyboard hide icon (chevron down)
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
              </svg>
            ) : (
              // Keyboard icon
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M2.25 5.25a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v10.5a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V5.25Zm3.75 1.5a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H9Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H12Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H15Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H18ZM6 10.5a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H6Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H9Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H12Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H15Zm3 0a.75.75 0 0 0 0 1.5h.75a.75.75 0 0 0 0-1.5H18ZM6.75 14.25a.75.75 0 0 0-.75.75v.75c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75V15a.75.75 0 0 0-.75-.75H6.75Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
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
            className="text-primary disabled:text-gray-600 transition-colors flex-shrink-0"
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
