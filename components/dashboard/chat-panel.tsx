'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type HistoryItem = { role: 'user' | 'assistant'; content: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Voice (Gemini Live, audio-to-audio) ──────────────────────────────────────
  const { status: voiceStatus, error: voiceError, transcript, start, stop } = useGeminiLive();
  const voiceActive = voiceStatus !== 'idle' && voiceStatus !== 'error';

  const toggleVoice = useCallback(() => {
    if (voiceActive) stop();
    else start();
  }, [voiceActive, start, stop]);

  // Stop the voice session when the panel closes.
  useEffect(() => {
    if (!isOpen && voiceActive) stop();
  }, [isOpen, voiceActive, stop]);

  const voiceLabel =
    voiceStatus === 'connecting' ? 'Connecting…'
    : voiceStatus === 'speaking' ? 'Speaking…'
    : voiceStatus === 'listening' ? 'Listening…'
    : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // ── Text chat ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history: HistoryItem[] = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) throw new Error('Request failed');
      const { response } = await res.json() as { response: string };
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: response }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: uid(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat FAB ─────────────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 bg-card border border-border rounded-full shadow-lg flex items-center justify-center hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open AI assistant"
        >
          <svg className="w-6 h-6 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background border-t border-border rounded-t-2xl shadow-2xl"
          style={{ height: '70dvh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <span className="font-semibold text-foreground text-sm">Order Assistant</span>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Close assistant"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Message area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8 space-y-1">
                <p className="font-medium text-foreground">Ask me about your orders</p>
                <p>{`Type, or tap the mic to talk. Try: "How many orders are pending?"`}</p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]"/>
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]"/>
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]"/>
                  </span>
                </div>
              </div>
            )}

            {/* Live voice captions (ephemeral, current turn only) */}
            {voiceActive && transcript.user && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words bg-primary/70 text-primary-foreground italic">
                  {transcript.user}
                </div>
              </div>
            )}
            {voiceActive && transcript.assistant && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words bg-muted text-foreground italic">
                  {transcript.assistant}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice status strip */}
          {(voiceActive || voiceError) && (
            <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2 text-xs border-t border-border">
              {voiceError ? (
                <span className="text-destructive">{voiceError}</span>
              ) : (
                <>
                  <span className={`w-2 h-2 rounded-full ${voiceStatus === 'speaking' ? 'bg-primary' : 'bg-emerald-500'} ${voiceStatus === 'connecting' ? 'animate-pulse' : 'animate-ping'}`} />
                  <span className="text-muted-foreground font-medium">{voiceLabel}</span>
                  <span className="text-muted-foreground/70">· tap mic to end</span>
                </>
              )}
            </div>
          )}

          {/* Input bar */}
          <div className="flex-shrink-0 border-t border-border px-3 py-3 flex items-center gap-2">
            {/* Voice mic toggle */}
            <button
              onClick={toggleVoice}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                voiceActive
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
              aria-label={voiceActive ? 'Stop voice assistant' : 'Start voice assistant'}
              aria-pressed={voiceActive}
            >
              {voiceActive ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about orders…"
              disabled={isLoading}
              className="flex-1 h-10 px-3.5 rounded-full border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            {/* Send */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
