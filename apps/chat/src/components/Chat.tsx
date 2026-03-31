import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { WakeUpAnimation } from "./WakeUpAnimation";
import { getThinkingSequence } from "../lib/thinking-phrases";

interface Message {
  role: "user" | "assistant";
  content: string;
  connectCalendar?: boolean;
}

interface ChatProps {
  token: string;
  onLogout: () => void;
}

type ContainerState = "checking" | "waking" | "awake";

export function Chat({ token, onLogout }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingPhrase, setThinkingPhrase] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [containerState, setContainerState] = useState<ContainerState>("checking");
  const [inputFocused, setInputFocused] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 24;
      const maxLines = 3;
      const maxHeight = lineHeight * maxLines;
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px";
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  useEffect(() => {
    checkContainerStatus();
  }, []);

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

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const response = await api.getCalendarConnectUrl();
      if (response.url) {
        // Open in new tab
        window.open(response.url, "_blank");
      }
    } catch (err) {
      console.error("Failed to get calendar connect URL:", err);
    } finally {
      setConnectingCalendar(false);
    }
  };

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
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: response.message,
        connectCalendar: response.connectCalendar || false
      }]);
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

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  const dismissKeyboard = () => {
    inputRef.current?.blur();
    setInputFocused(false);
  };

  const handleInputFocus = () => setInputFocused(true);
  const handleInputBlur = () => setInputFocused(false);

  const handleToolbarMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  if (containerState === "waking") {
    return (
      <div className="chat-wrapper">
        <div className="h-12 flex-shrink-0"></div>
        <div className="flex-1 overflow-hidden">
          <WakeUpAnimation onAwake={handleWakeComplete} />
        </div>
      </div>
    );
  }

  if (containerState === "checking") {
    return (
      <div className="chat-wrapper items-center justify-center">
        <div className="text-gray-400">Checking in...</div>
      </div>
    );
  }

  return (
    <div className="chat-wrapper">
      {/* Ghost header for iOS */}
      <div className="h-12 flex-shrink-0"></div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-end pb-8">
            <div className="w-16 h-px bg-white/20 mb-6"></div>
            <p className="text-gray-400 text-center text-lg">Hi, I'm BethAiny</p>
            <p className="text-gray-500 text-center text-sm mt-1">Your intuitive assistant for life</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={"max-w-[85%] " + (msg.role === "user" ? "" : "")}>
                <div className={"px-4 py-2 rounded-2xl " + (msg.role === "user" ? "bg-primary text-white" : "bg-surface-light text-gray-100")}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {/* Connect Calendar Button */}
                {msg.connectCalendar && (
                  <button
                    onClick={handleConnectCalendar}
                    disabled={connectingCalendar}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl transition-colors text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
                    </svg>
                    {connectingCalendar ? "Opening..." : "Connect Google Calendar"}
                  </button>
                )}
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

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-surface">
        {inputFocused && (
          <div 
            className="flex justify-between items-center mb-3 px-1"
            onMouseDown={handleToolbarMouseDown}
            onTouchStart={handleToolbarMouseDown}
          >
            <button 
              onClick={clearChat} 
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Clear
            </button>
            <button 
              onClick={dismissKeyboard}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
              </svg>
            </button>
            <button 
              onClick={onLogout} 
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-surface-light rounded-2xl px-4 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Message BethAiny..."
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
            style={{ minHeight: "24px", maxHeight: "72px", overflowY: "hidden" }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading} className="text-primary disabled:text-gray-600 transition-colors flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
