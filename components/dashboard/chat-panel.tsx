'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SYSTEM_INSTRUCTION, TOOL_DECLARATIONS, VOICE_MODEL } from '@/lib/gemini-tools';
import * as queries from '@/lib/supabase/chatbot-queries';

// ── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type HistoryItem = { role: 'user' | 'assistant'; content: string };

type VoiceState = 'idle' | 'connecting' | 'active' | 'stopping';

// Worklet → main-thread message envelope (matches /public/audio-worklet-processor.js)
type WorkletMessage =
  | { type: 'audio'; data: ArrayBuffer; peak: number }
  | { type: 'level'; peak: number }
  | { type: 'init'; inputRate: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// Play a PCM chunk (24 kHz mono Int16, base64-encoded) through the AudioContext.
// Schedules each chunk after the previous one so playback is gap-free.
function makePlayer(ctx: AudioContext) {
  let nextStart = 0;
  return (base64: string) => {
    const f32 = base64ToFloat32(base64);
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

// Execute a Gemini tool call client-side (read-only, RLS enforced by anon key + user session)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeClientTool(
  name: string,
  args: Record<string, unknown>,
  client: any
): Promise<unknown> {
  switch (name) {
    case 'get_orders_summary':
      return queries.getOrdersSummary(client);
    case 'get_orders_by_status':
      return queries.getOrdersByStatus(client, args.status as string);
    case 'get_orders_by_customer':
      return queries.getOrdersByCustomer(client, args.customer_name as string);
    case 'get_orders_by_category':
      return queries.getOrdersByCategory(client, args.category_name as string);
    case 'get_overdue_orders':
      return queries.getOverdueOrders(client);
    case 'get_orders_due_soon':
      return queries.getOrdersDueSoon(client, args.days as number);
    case 'get_order_detail':
      return queries.getOrderDetail(client, args.order_no as string);
    case 'get_dispatch_summary':
      return queries.getDispatchSummary(client, args.start_date as string, args.end_date as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState('');
  // Split transcripts so the user can see input is being captured separately
  // from the assistant's reply.
  const [voiceInput, setVoiceInput] = useState('');     // running input transcript
  const [voiceOutput, setVoiceOutput] = useState('');   // running output transcript
  const [chunksSent, setChunksSent] = useState(0);
  const [micLevel, setMicLevel] = useState(0);          // 0..1 peak amplitude
  const [inputRate, setInputRate] = useState<number | null>(null); // actual mic rate (diagnostic)

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const recordCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playerRef = useRef<((b64: string) => void) | null>(null);
  // Throttle level updates so we don't trigger React renders every 8 ms
  const lastLevelTickRef = useRef(0);

  const supabase = useMemo(() => createClient(), []);

  // Scroll to bottom whenever messages or transcripts update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceInput, voiceOutput]);

  // Focus input when panel opens
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

  // ── Voice cleanup helper ────────────────────────────────────────────────────

  const cleanupVoice = useCallback(async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    if (recordCtxRef.current && recordCtxRef.current.state !== 'closed') {
      try { await recordCtxRef.current.close(); } catch {}
    }
    recordCtxRef.current = null;

    if (liveSessionRef.current) {
      try { await liveSessionRef.current.close(); } catch {}
      liveSessionRef.current = null;
    }

    playerRef.current = null;
    setMicLevel(0);
  }, []);

  // ── Stop voice ──────────────────────────────────────────────────────────────

  const stopVoice = useCallback(async () => {
    setVoiceState('stopping');

    // Tell Gemini to flush any cached audio before we tear the session down.
    // Per docs, audioStreamEnd is the "end of utterance" signal.
    try {
      liveSessionRef.current?.sendRealtimeInput?.({ audioStreamEnd: true });
    } catch {}

    await cleanupVoice();

    // Persist the voice exchange into the chat history so it isn't lost
    // when we close the session.
    setVoiceInput(prevIn => {
      setVoiceOutput(prevOut => {
        const block: string[] = [];
        if (prevIn.trim()) block.push(`You said: ${prevIn.trim()}`);
        if (prevOut.trim()) block.push(`Assistant: ${prevOut.trim()}`);
        if (block.length) {
          setMessages(ms => [
            ...ms,
            { id: uid(), role: 'assistant', content: block.join('\n\n') },
          ]);
        }
        return '';
      });
      return '';
    });

    setChunksSent(0);
    setInputRate(null);
    setVoiceState('idle');
  }, [cleanupVoice]);

  // ── Start voice ─────────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    setVoiceError('');
    setVoiceInput('');
    setVoiceOutput('');
    setChunksSent(0);
    setMicLevel(0);
    setVoiceState('connecting');

    try {
      // 1. Get ephemeral token from our server
      const tokenRes = await fetch('/api/chat/voice-token');
      if (!tokenRes.ok) throw new Error('Could not get voice token from server.');
      const { token, model } = await tokenRes.json() as { token: string; model: string };

      // 2. Mic — let the browser pick its native rate. We resample to 16 kHz
      //    inside the AudioWorklet because forcing a 16 kHz AudioContext is
      //    unreliable on Windows (silently falls back to device default).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 3. Recording context at the device's default rate
      const recordCtx = new AudioContext();
      recordCtxRef.current = recordCtx;
      if (recordCtx.state === 'suspended') await recordCtx.resume();
      console.log('[voice] recordCtx sampleRate =', recordCtx.sampleRate);

      // 4. Playback context (default sample rate; buffers are explicitly built at 24 kHz)
      const playCtx = new AudioContext();
      playCtxRef.current = playCtx;
      if (playCtx.state === 'suspended') await playCtx.resume();
      playerRef.current = makePlayer(playCtx);

      // 5. Load AudioWorklet processor and wire the graph
      await recordCtx.audioWorklet.addModule('/audio-worklet-processor.js');
      const source = recordCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(recordCtx, 'pcm-processor');
      workletNodeRef.current = workletNode;
      source.connect(workletNode);
      // Connect worklet output → muted gain → destination so the audio graph
      // actually pulls samples through process(). Without this, AudioWorklets
      // with no consumer can stall.
      const silentSink = recordCtx.createGain();
      silentSink.gain.value = 0;
      workletNode.connect(silentSink).connect(recordCtx.destination);

      // 6. Connect to Gemini Live (v1alpha is required for ephemeral tokens)
      const { GoogleGenAI } = await import('@google/genai');
      const genai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      const session = await genai.live.connect({
        model: model ?? VOICE_MODEL,
        config: {
          responseModalities: ['AUDIO' as any],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: TOOL_DECLARATIONS as any }],
          inputAudioTranscription: {} as any,
          outputAudioTranscription: {} as any,
        },
        callbacks: {
          onopen: () => {
            console.log('[voice] session open');
            setVoiceState('active');
            // Diagnostic probe: send a text input the moment the session opens.
            // If the session closes ONLY when audio arrives, the problem is the
            // audio bytes / mime type. If it closes on text too, the problem is
            // the session config itself (model entitlement, malformed setup,
            // ephemeral-token constraint mismatch, etc.).
            setTimeout(() => {
              try {
                liveSessionRef.current?.sendRealtimeInput?.({
                  text: 'Say hello in one short sentence.',
                });
                console.log('[voice] sent text probe');
              } catch (probeErr) {
                console.error('[voice] text probe failed:', probeErr);
              }
            }, 200);
          },

          onmessage: async (msg: any) => {
            // Compact log so we can see what fields actually arrive
            console.log('[voice] msg keys:', Object.keys(msg));
            const sc = msg.serverContent;

            // Audio + inline text parts (Gemini 3.1 may put both in one event)
            const parts = sc?.modelTurn?.parts as any[] | undefined;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  playerRef.current?.(part.inlineData.data);
                }
                if (part.text) {
                  setVoiceOutput(prev => prev + part.text);
                }
              }
            }

            // Separate transcription fields
            const inTx = sc?.inputTranscription?.text as string | undefined;
            if (inTx) setVoiceInput(prev => prev + inTx);

            const outTx = sc?.outputTranscription?.text as string | undefined;
            if (outTx) setVoiceOutput(prev => prev + outTx);

            // Add a paragraph break when the model finishes a turn so the
            // next exchange starts on its own line.
            if (sc?.turnComplete) {
              setVoiceInput(prev => (prev && !prev.endsWith('\n') ? prev + '\n' : prev));
              setVoiceOutput(prev => (prev && !prev.endsWith('\n') ? prev + '\n' : prev));
            }

            // Synchronous tool calls
            const fcs = msg.toolCall?.functionCalls as any[] | undefined;
            if (fcs?.length) {
              const responses = await Promise.all(
                fcs.map(async (fc: any) => {
                  try {
                    const result = await executeClientTool(fc.name, fc.args ?? {}, supabase);
                    return { id: fc.id, name: fc.name, response: { result } };
                  } catch (err) {
                    return { id: fc.id, name: fc.name, response: { error: String(err) } };
                  }
                })
              );
              liveSessionRef.current?.sendToolResponse({ functionResponses: responses });
            }
          },

          onerror: (err: ErrorEvent) => {
            console.error('[voice] error:', err);
            setVoiceError(err?.message || 'Voice connection error.');
            stopVoice();
          },

          onclose: (e: CloseEvent) => {
            console.log('[voice] close: code=', e?.code, 'reason=', e?.reason);
            if (voiceState === 'active') stopVoice();
          },
        },
      });

      liveSessionRef.current = session;

      // 7. Stream PCM from the worklet → Gemini Live session
      let chunks = 0;
      workletNode.port.onmessage = (event: MessageEvent<WorkletMessage>) => {
        const data = event.data;

        if (data.type === 'init') {
          console.log('[voice] worklet input rate =', data.inputRate, '→ resampling to 16000');
          setInputRate(data.inputRate);
          return;
        }

        if (data.type === 'level') {
          // Throttle UI updates to ~10 Hz
          const now = performance.now();
          if (now - lastLevelTickRef.current > 100) {
            lastLevelTickRef.current = now;
            setMicLevel(data.peak);
          }
          return;
        }

        // type === 'audio'
        if (!liveSessionRef.current) return;
        try {
          const base64 = arrayBufferToBase64(data.data);
          liveSessionRef.current.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
          });
          chunks++;
          setChunksSent(chunks);
          if (chunks === 1) console.log('[voice] first audio chunk sent');
        } catch (sendErr) {
          console.error('[voice] sendRealtimeInput failed:', sendErr);
        }
      };
    } catch (err: any) {
      console.error('[startVoice]', err);
      setVoiceError(err?.message ?? 'Failed to start voice. Check microphone permissions.');
      await cleanupVoice();
      setVoiceState('idle');
    }
  }, [supabase, stopVoice, cleanupVoice, voiceState]);

  // Cleanup on unmount
  useEffect(() => () => { cleanupVoice(); }, [cleanupVoice]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const isVoiceConnecting = voiceState === 'connecting';
  const isVoiceActive = voiceState === 'active';
  const isVoiceBusy = voiceState === 'connecting' || voiceState === 'stopping';

  return (
    <>
      {/* ── Chat FAB (bottom-left, doesn't overlap the + Add Order FAB) ── */}
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

      {/* ── Chat panel ── */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-background border-t border-border rounded-t-2xl shadow-2xl"
          style={{ height: '70dvh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">Order Assistant</span>
              {isVoiceActive && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"/>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"/>
                  </span>
                  Voice active
                </span>
              )}
              {isVoiceConnecting && (
                <span className="text-xs text-muted-foreground font-medium">Connecting…</span>
              )}
            </div>
            <button
              onClick={() => { setIsOpen(false); }}
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
            {messages.length === 0 && !isVoiceActive && (
              <div className="text-center text-sm text-muted-foreground mt-8 space-y-1">
                <p className="font-medium text-foreground">Ask me about your orders</p>
                <p>Try: "How many orders are pending?" or "What's overdue?"</p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator (text mode) */}
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

            {/* ── Voice live panel ─────────────────────────────────────── */}
            {isVoiceActive && (
              <div className="space-y-2">
                {/* Mic level + chunk counter */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Mic
                      {inputRate ? ` · ${inputRate}Hz → 16000Hz` : ''}
                    </span>
                    <span className="font-mono">
                      {chunksSent} chunk{chunksSent === 1 ? '' : 's'} sent
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-[width] duration-100"
                      style={{ width: `${Math.min(100, Math.round(micLevel * 140))}%` }}
                    />
                  </div>
                </div>

                {/* You said */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-primary font-semibold mb-1">
                    You said
                  </p>
                  <p className="whitespace-pre-wrap text-foreground min-h-[1.25rem]">
                    {voiceInput || (
                      <span className="text-muted-foreground italic">Listening…</span>
                    )}
                  </p>
                </div>

                {/* Assistant said */}
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                    Assistant
                  </p>
                  <p className="whitespace-pre-wrap text-foreground min-h-[1.25rem]">
                    {voiceOutput || (
                      <span className="text-muted-foreground italic">…</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {voiceError && (
              <p className="text-xs text-destructive text-center">{voiceError}</p>
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

            {/* Mic */}
            {!isVoiceActive ? (
              <button
                onClick={startVoice}
                disabled={isVoiceBusy || isLoading}
                className="w-10 h-10 rounded-full border border-border bg-card text-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-muted active:scale-95 transition-all"
                aria-label="Start voice"
              >
                {isVoiceConnecting ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </button>
            ) : (
              <button
                onClick={stopVoice}
                className="px-3 h-10 rounded-full bg-destructive text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 animate-pulse hover:animate-none hover:opacity-90 active:scale-95 transition-all"
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
