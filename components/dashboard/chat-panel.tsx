'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import Orb from '@/components/ui/orb';
import { cn, glass } from '@/lib/utils';
import toast from 'react-hot-toast';

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
};

type HistoryItem = { role: 'user' | 'assistant'; content: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitial(name?: string): string {
  const c = name?.trim()?.[0];
  return c ? c.toUpperCase() : 'U';
}

const SUGGESTIONS = [
  'How many orders are pending?',
  'Show me overdue orders',
  "What's due in the next 3 days?",
];

// ── Small avatars ─────────────────────────────────────────────────────────────

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn('shrink-0 rounded-full flex items-center justify-center text-primary-foreground shadow-sm', className)}
      style={{ backgroundImage: 'linear-gradient(135deg, var(--primary), oklch(62% 0.26 300))' }}
      aria-hidden="true"
    >
      <svg className="w-1/2 h-1/2" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" />
      </svg>
    </div>
  );
}

function UserAvatar({ initial, className }: { initial: string; className?: string }) {
  return (
    <div
      className={cn(
        'shrink-0 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold',
        className
      )}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel({ userName }: { userName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userInitial = getInitial(userName);

  // ── Voice (Gemini Live, audio-to-audio) ──────────────────────────────────────
  // Completed turns are committed straight into the unified message thread.
  const handleVoiceTurn = useCallback((turn: { user: string; assistant: string }) => {
    const now = Date.now();
    setMessages(prev => [
      ...prev,
      ...(turn.user ? [{ id: uid(), role: 'user' as const, content: turn.user, ts: now }] : []),
      ...(turn.assistant ? [{ id: uid(), role: 'assistant' as const, content: turn.assistant, ts: now + 1 }] : []),
    ]);
  }, []);

  const { status: voiceStatus, error: voiceError, transcript, inputLevelRef, start, stop } =
    useGeminiLive({ onTurnComplete: handleVoiceTurn });
  const voiceActive = voiceStatus !== 'idle' && voiceStatus !== 'error';

  const openVoice = useCallback(() => {
    setShowVoice(true);
    start();
  }, [start]);

  const stopVoice = useCallback(() => {
    stop();
    setShowVoice(false);
  }, [stop]);

  const typeInstead = useCallback(() => {
    stop();
    setShowVoice(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [stop]);

  // Hide the voice overlay whenever the session is no longer live.
  useEffect(() => {
    if (!voiceActive) setShowVoice(false);
  }, [voiceActive]);

  // Stop the voice session when the panel closes.
  useEffect(() => {
    if (!isOpen) {
      if (voiceActive) stop();
      setShowVoice(false);
    }
  }, [isOpen, voiceActive, stop]);

  // Surface voice connection errors.
  useEffect(() => {
    if (voiceError) toast.error(voiceError);
  }, [voiceError]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen && !showVoice) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen, showVoice]);

  // ── Text chat ───────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;
    setInput('');

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, ts: Date.now() };
    // Snapshot history BEFORE appending the new user message.
    const history: HistoryItem[] = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      if (!res.ok) throw new Error('Request failed');
      const { response } = await res.json() as { response: string };
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: response, ts: Date.now() }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: uid(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.', ts: Date.now() },
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

  // ── Derived header state ──────────────────────────────────────────────────────
  const subtitle =
    voiceStatus === 'connecting' ? 'Connecting…'
    : voiceStatus === 'speaking' ? 'Speaking…'
    : voiceStatus === 'listening' ? 'Listening…'
    : isLoading ? 'Typing…'
    : 'Ask about your orders';

  const statusDot = voiceStatus === 'speaking' ? 'bg-[var(--status-progress)]' : 'bg-emerald-500';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Launcher FAB ─────────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-primary-foreground shadow-[0_8px_28px_-6px_var(--primary)] hover:scale-105 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring min-tap"
          style={{ backgroundImage: 'linear-gradient(135deg, var(--primary), oklch(62% 0.26 300))' }}
          aria-label="Open AI assistant"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M9.5 9.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="currentColor" stroke="none" />
          </svg>
        </button>
      )}

      {/* ── Floating widget ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Order assistant"
          className={cn(
            glass.heavy,
            'fixed z-50 flex flex-col overflow-hidden border border-border shadow-2xl rounded-[28px]',
            'left-3 right-3 bottom-3 h-[min(78dvh,580px)]',
            'sm:left-6 sm:right-auto sm:w-[392px] sm:h-[min(80dvh,600px)]',
            'origin-bottom-left animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300'
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0 bg-gradient-to-b from-primary/[0.06] to-transparent">
            <div className="relative">
              <AssistantAvatar className="w-9 h-9" />
              <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card', statusDot, voiceActive && 'animate-live-pulse')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground leading-tight tracking-tight">Order Assistant</p>
              <p className="text-xs text-muted-foreground font-medium truncate">{subtitle}</p>
            </div>
            {messages.length > 0 && !showVoice && (
              <button
                onClick={() => setMessages([])}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Clear conversation"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close assistant"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Voice overlay ──────────────────────────────────────────── */}
          {showVoice ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-7 px-6 py-6 text-center">
              {/* Orb + breathing glow */}
              <div className="relative flex items-center justify-center">
                <div
                  className="absolute inset-0 -z-10 rounded-full blur-3xl opacity-50 animate-live-pulse"
                  style={{ background: 'radial-gradient(circle, var(--primary), transparent 70%)' }}
                  aria-hidden="true"
                />
                <div className="w-40 h-40 xs:w-44 xs:h-44">
                  <Orb
                    levelRef={inputLevelRef}
                    hue={12}
                    hoverIntensity={0.9}
                    rotateOnHover
                    forceHoverState={voiceStatus === 'speaking'}
                    backgroundColor="#000000"
                  />
                </div>
              </div>

              {/* Live transcription */}
              <div className="min-h-[4rem] max-w-[92%] flex flex-col gap-2">
                <p className="text-lg font-semibold text-foreground leading-snug text-balance">
                  {transcript.user || (voiceStatus === 'connecting' ? 'Connecting…' : 'Listening… ask me anything')}
                </p>
                {transcript.assistant && (
                  <p className="text-sm font-medium text-muted-foreground italic leading-snug text-balance">
                    {transcript.assistant}
                  </p>
                )}
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className={cn('w-2 h-2 rounded-full', voiceStatus === 'connecting' ? 'bg-muted-foreground animate-pulse' : statusDot, voiceStatus !== 'connecting' && 'animate-live-pulse')} />
                {subtitle}
              </div>
            </div>
          ) : (
            /* ── Message thread ───────────────────────────────────────── */
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3.5 py-4 space-y-2.5">
              {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-4">
                  <AssistantAvatar className="w-14 h-14" />
                  <div className="space-y-1">
                    <p className="font-bold text-foreground text-base tracking-tight">Hi! I&apos;m your order assistant</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">Ask me anything about your orders — type below, or tap the mic to talk in English, Hindi or Gujarati.</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-[280px] mt-1">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="w-full text-left px-3.5 py-2.5 rounded-2xl border border-border bg-card/60 hover:bg-muted hover:border-primary/30 transition-colors text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i, arr) => {
                const isUser = msg.role === 'user';
                const prev = arr[i - 1];
                const showAvatar = !prev || prev.role !== msg.role;
                return (
                  <div key={msg.id} className={cn('flex items-end gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (showAvatar ? <AssistantAvatar className="w-7 h-7" /> : <span className="w-7 shrink-0" aria-hidden="true" />)}
                    <div className={cn('max-w-[78%] flex flex-col', isUser ? 'items-end' : 'items-start')}>
                      <div className={cn(
                        'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm',
                        isUser ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted text-foreground rounded-bl-md'
                      )}>
                        {msg.content}
                      </div>
                      <span className="px-1 mt-0.5 text-[10px] font-medium text-muted-foreground/70">{formatTime(msg.ts)}</span>
                    </div>
                    {isUser && (showAvatar ? <UserAvatar initial={userInitial} className="w-7 h-7 text-[11px]" /> : <span className="w-7 shrink-0" aria-hidden="true" />)}
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-end gap-2 justify-start">
                  <AssistantAvatar className="w-7 h-7" />
                  <div className="bg-muted text-foreground rounded-2xl rounded-bl-md px-3.5 py-3">
                    <span className="flex gap-1 items-center h-2">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* ── Footer ─────────────────────────────────────────────────── */}
          {showVoice ? (
            <div className="flex-shrink-0 border-t border-border px-4 py-3 flex items-center justify-center gap-3">
              <button
                onClick={typeInstead}
                className="flex items-center gap-2 h-11 px-5 rounded-full bg-muted text-foreground text-sm font-semibold hover:bg-muted/70 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
                </svg>
                Type
              </button>
              <button
                onClick={stopVoice}
                className="flex items-center gap-2 h-11 px-5 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Stop voice assistant"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                Stop
              </button>
            </div>
          ) : (
            <div className="flex-shrink-0 border-t border-border px-3 py-3 flex items-center gap-2">
              {/* Mic → opens voice overlay */}
              <button
                onClick={openVoice}
                className="w-11 h-11 rounded-full bg-muted text-foreground flex items-center justify-center flex-shrink-0 hover:bg-muted/70 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Talk to the assistant"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about orders…"
                disabled={isLoading}
                className="flex-1 h-11 px-4 rounded-full border border-input bg-background/70 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />

              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Send message"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
