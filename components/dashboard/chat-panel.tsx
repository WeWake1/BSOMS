'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type HistoryItem = { role: 'user' | 'assistant'; content: string };

type VoiceState = 'idle' | 'connecting' | 'active' | 'stopping';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

/** Nearest-neighbour downsample from srcRate → dstRate */
function downsample(f32: Float32Array, srcRate: number, dstRate: number): Float32Array {
  const ratio = srcRate / dstRate;
  const len = Math.floor(f32.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = f32[Math.floor(i * ratio)];
  return out;
}

/** Float32 PCM → Int16 PCM */
function float32ToInt16(f32: Float32Array): ArrayBuffer {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

/** Int16 PCM (as ArrayBuffer) → Float32 */
function int16ToFloat32(buf: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(buf);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

/** Gap-free audio scheduler at 24 kHz */
function makePlayer(ctx: AudioContext) {
  let nextStart = 0;
  return (pcmBuf: ArrayBuffer) => {
    const f32 = int16ToFloat32(pcmBuf);
    if (!f32.length) return;
    const buf = ctx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextStart);
    src.start(startAt);
    nextStart = startAt + buf.duration;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState('');
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceOutput, setVoiceOutput] = useState('');
  const [micLevel, setMicLevel] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processorRef = useRef<any>(null);
  const playerRef = useRef<((buf: ArrayBuffer) => void) | null>(null);
  const lastLevelTickRef = useRef(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceInput, voiceOutput]);

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

  // ── Voice cleanup ───────────────────────────────────────────────────────────

  const cleanupVoice = useCallback(() => {
    // Disconnect and stop processor
    try { processorRef.current?.disconnect(); } catch {}
    processorRef.current = null;

    // Stop mic tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    // Close audio contexts
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    try { playCtxRef.current?.close(); } catch {}
    playCtxRef.current = null;

    playerRef.current = null;
    setMicLevel(0);
  }, []);

  // ── Stop voice ──────────────────────────────────────────────────────────────

  const stopVoice = useCallback(() => {
    setVoiceState('stopping');

    // Signal server to flush audio before tearing down
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify({ type: 'stop' })); } catch {}
    }
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    cleanupVoice();

    // Persist exchange into the message history
    setVoiceInput(prevIn => {
      setVoiceOutput(prevOut => {
        const lines: string[] = [];
        if (prevIn.trim()) lines.push(`You said: ${prevIn.trim()}`);
        if (prevOut.trim()) lines.push(`Assistant: ${prevOut.trim()}`);
        if (lines.length) {
          setMessages(ms => [...ms, { id: uid(), role: 'assistant', content: lines.join('\n\n') }]);
        }
        return '';
      });
      return '';
    });

    setVoiceState('idle');
  }, [cleanupVoice]);

  // ── Start voice ─────────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    setVoiceError('');
    setVoiceInput('');
    setVoiceOutput('');
    setMicLevel(0);
    setVoiceState('connecting');

    try {
      // 1. Mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      // 2. Recording context (default native rate, usually 48 kHz)
      const recordCtx = new AudioContext();
      audioCtxRef.current = recordCtx;
      if (recordCtx.state === 'suspended') await recordCtx.resume();

      // 3. Playback context for Gemini audio (24 kHz buffers)
      const playCtx = new AudioContext();
      playCtxRef.current = playCtx;
      if (playCtx.state === 'suspended') await playCtx.resume();
      playerRef.current = makePlayer(playCtx);

      // 4. Open WebSocket to our server bridge
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/voice-ws`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[voice] WebSocket to bridge open — waiting for Gemini session…');
      };

      ws.onmessage = (event) => {
        // Binary = raw 24 kHz Int16 PCM audio from Gemini
        if (event.data instanceof ArrayBuffer) {
          playerRef.current?.(event.data);
          return;
        }

        // Text = JSON control message
        let msg: { type: string; role?: string; text?: string; message?: string };
        try {
          msg = JSON.parse(event.data as string);
        } catch (parseErr) {
          console.error('[voice] bad JSON from server:', event.data, parseErr);
          return;
        }

        if (msg.type === 'ready') {
          console.log('[voice] Gemini session ready — mic active');
          setVoiceState('active');

          try {
            // 5. Wire up ScriptProcessorNode now that the session is ready
            const source = recordCtx.createMediaStreamSource(stream);
            // 4096-sample buffer: ~85 ms of audio per chunk at 48 kHz
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const processor = (recordCtx as any).createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e: AudioProcessingEvent) => {
              if (ws.readyState !== WebSocket.OPEN) return;

              const raw = e.inputBuffer.getChannelData(0);

              // Mic level for the UI meter (throttled to ~10 Hz)
              const now = performance.now();
              if (now - lastLevelTickRef.current > 100) {
                lastLevelTickRef.current = now;
                let peak = 0;
                for (let i = 0; i < raw.length; i++) {
                  const abs = raw[i] < 0 ? -raw[i] : raw[i];
                  if (abs > peak) peak = abs;
                }
                setMicLevel(peak);
              }

              // Downsample 48 kHz → 16 kHz and convert to Int16 PCM
              const f16k = downsample(raw, recordCtx.sampleRate, 16000);
              const pcm16 = float32ToInt16(f16k);
              ws.send(pcm16);
            };

            // Silent sink so the audio graph actually runs
            const sink = recordCtx.createGain();
            sink.gain.value = 0;
            source.connect(processor);
            processor.connect(sink);
            sink.connect(recordCtx.destination);

            console.log('[voice] ScriptProcessorNode wired — sampleRate:', recordCtx.sampleRate);
          } catch (setupErr) {
            console.error('[voice] ScriptProcessorNode setup failed:', setupErr);
            setVoiceError('Mic setup failed. Please try again.');
            stopVoice();
          }

        } else if (msg.type === 'transcript') {
          if (msg.role === 'user') setVoiceInput(prev => prev + (msg.text ?? ''));
          else setVoiceOutput(prev => prev + (msg.text ?? ''));

        } else if (msg.type === 'turn_complete') {
          setVoiceInput(prev => prev && !prev.endsWith('\n') ? prev + '\n' : prev);
          setVoiceOutput(prev => prev && !prev.endsWith('\n') ? prev + '\n' : prev);

        } else if (msg.type === 'error') {
          console.error('[voice] server error:', msg.message);
          setVoiceError(msg.message || 'Voice error');
          stopVoice();
        }
      };

      ws.onerror = (e) => {
        console.error('[voice] WebSocket error', e);
        setVoiceError('Connection error. Please try again.');
        stopVoice();
      };

      ws.onclose = (e) => {
        console.log('[voice] WebSocket closed: code=', e.code, 'reason=', e.reason);
        // Reset to idle from any non-stopping state (handles both 'connecting' and 'active')
        setVoiceState(cur => {
          if (cur !== 'stopping' && cur !== 'idle') {
            cleanupVoice();
            wsRef.current = null;
            return 'idle';
          }
          return cur;
        });
      };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice';
      console.error('[startVoice]', err);
      setVoiceError(msg);
      cleanupVoice();
      setVoiceState('idle');
    }
  }, [stopVoice, cleanupVoice]);

  // Cleanup on unmount
  useEffect(() => () => {
    try { wsRef.current?.close(); } catch {}
    cleanupVoice();
  }, [cleanupVoice]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isVoiceActive = voiceState === 'active';
  const isVoiceConnecting = voiceState === 'connecting';
  const isVoiceBusy = voiceState !== 'idle';

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
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">Order Assistant</span>
              {isVoiceActive && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"/>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
                  </span>
                  Live
                </span>
              )}
              {isVoiceConnecting && (
                <span className="text-xs text-muted-foreground">Connecting…</span>
              )}
            </div>
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
            {messages.length === 0 && !isVoiceActive && !isVoiceConnecting && (
              <div className="text-center text-sm text-muted-foreground mt-8 space-y-1">
                <p className="font-medium text-foreground">Ask me about your orders</p>
                <p>Try: "How many orders are pending?" or "What's overdue?"</p>
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

            {/* Text loading indicator */}
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

            {/* ── Voice connecting placeholder ── */}
            {isVoiceConnecting && (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="flex items-end gap-1 h-8">
                  {[0, 1, 2, 3, 4].map(i => (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-muted-foreground/40 animate-pulse"
                      style={{
                        height: `${14 + Math.sin(i * 0.8) * 10}px`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Connecting to voice…</p>
              </div>
            )}

            {/* ── Voice active panel ── */}
            {isVoiceActive && (
              <div className="space-y-3">
                {/* Animated waveform + mic level */}
                <div className="flex flex-col items-center gap-3 py-4">
                  {/* Waveform bars */}
                  <div className="flex items-end gap-1 h-10">
                    {[0, 1, 2, 3, 4].map(i => {
                      const base = 8;
                      const boost = Math.round(micLevel * 80 * (0.6 + Math.sin(i * 1.2) * 0.4));
                      return (
                        <span
                          key={i}
                          className="w-1.5 rounded-full bg-emerald-500 transition-[height] duration-75"
                          style={{ height: `${Math.max(base, Math.min(40, base + boost))}px` }}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {voiceInput ? 'Listening…' : 'Say something…'}
                  </p>
                </div>

                {/* You said */}
                {voiceInput ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-primary/70 font-semibold mb-1.5">You</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{voiceInput}</p>
                  </div>
                ) : null}

                {/* Assistant said */}
                {voiceOutput ? (
                  <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Assistant</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{voiceOutput}</p>
                  </div>
                ) : null}
              </div>
            )}

            {voiceError && (
              <p className="text-xs text-destructive text-center py-1">{voiceError}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="flex-shrink-0 border-t border-border px-3 py-3 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isVoiceActive ? 'Voice active…' : 'Ask about orders…'}
              disabled={isLoading || isVoiceActive}
              className="flex-1 h-10 px-3.5 rounded-full border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            {/* Send */}
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || isVoiceActive}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>

            {/* Mic / Stop */}
            {!isVoiceActive ? (
              <button
                onClick={startVoice}
                disabled={isVoiceBusy || isLoading}
                className="w-10 h-10 rounded-full border border-border bg-card text-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-muted active:scale-95 transition-all"
                aria-label="Start voice"
              >
                {isVoiceConnecting ? (
                  <svg className="w-4 h-4 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
            ) : (
              <button
                onClick={stopVoice}
                className="px-3 h-10 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 hover:opacity-90 active:scale-95 transition-all"
                aria-label="Stop voice"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
                Stop
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
