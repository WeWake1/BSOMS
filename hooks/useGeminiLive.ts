'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { LIVE_MODEL, SYSTEM_INSTRUCTION, TOOL_DECLARATIONS, executeTool } from '@/lib/gemini-tools';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────
export type LiveStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

export type LiveTranscript = { user: string; assistant: string };

// Prebuilt voice — see https://ai.google.dev/gemini-api/docs/live-api for options.
const VOICE_NAME = 'Puck';
const INPUT_SAMPLE_RATE = 16000;  // Gemini Live requires 16kHz mic input
const OUTPUT_SAMPLE_RATE = 24000; // Gemini Live emits 24kHz audio

// ── Audio conversion helpers (PCM16 LE <-> Float32 <-> base64) ──────────────
function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s * 0x7fff;
  }
  return int16.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64PCMToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useGeminiLive() {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<LiveTranscript>({ user: '', assistant: '' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const captureNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  // Per-turn transcript accumulators.
  const userTextRef = useRef('');
  const assistantTextRef = useRef('');

  const cleanup = useCallback(() => {
    try { sessionRef.current?.close(); } catch { /* noop */ }
    sessionRef.current = null;
    try { captureNodeRef.current?.disconnect(); } catch { /* noop */ }
    captureNodeRef.current = null;
    try { playbackNodeRef.current?.disconnect(); } catch { /* noop */ }
    playbackNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    try { inputCtxRef.current?.close(); } catch { /* noop */ }
    inputCtxRef.current = null;
    try { outputCtxRef.current?.close(); } catch { /* noop */ }
    outputCtxRef.current = null;
    userTextRef.current = '';
    assistantTextRef.current = '';
  }, []);

  const stop = useCallback(() => {
    cleanup();
    startingRef.current = false;
    setStatus('idle');
    setTranscript({ user: '', assistant: '' });
  }, [cleanup]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMessage = useCallback(async (msg: any) => {
    // 1. Tool calls — execute against the order DB (browser client, RLS-gated)
    //    and stream results back over the live socket.
    if (msg.toolCall?.functionCalls?.length) {
      const supabase = createClient();
      const functionResponses = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msg.toolCall.functionCalls.map(async (fc: any) => {
          try {
            const output = await executeTool(fc.name ?? '', fc.args ?? {}, supabase);
            return { id: fc.id, name: fc.name, response: { result: output } as Record<string, unknown> };
          } catch (err) {
            return { id: fc.id, name: fc.name, response: { error: String(err) } as Record<string, unknown> };
          }
        })
      );
      try { sessionRef.current?.sendToolResponse({ functionResponses }); } catch { /* noop */ }
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    // 2. Barge-in — user spoke over the model; drop queued playback.
    if (sc.interrupted) {
      playbackNodeRef.current?.port.postMessage('interrupt');
      assistantTextRef.current = '';
      setStatus('listening');
      return;
    }

    // 3. Audio output → playback worklet.
    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        const data = part.inlineData?.data;
        if (data) {
          setStatus('speaking');
          playbackNodeRef.current?.port.postMessage(base64PCMToFloat32(data));
        }
      }
    }

    // 4. Live captions.
    if (sc.outputTranscription?.text) {
      assistantTextRef.current += sc.outputTranscription.text;
      setTranscript((t) => ({ ...t, assistant: assistantTextRef.current }));
    }
    if (sc.inputTranscription?.text) {
      userTextRef.current += sc.inputTranscription.text;
      setTranscript((t) => ({ ...t, user: userTextRef.current }));
    }

    // 5. Turn boundary — reset accumulators, back to listening.
    if (sc.turnComplete) {
      userTextRef.current = '';
      assistantTextRef.current = '';
      setStatus('listening');
    }
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || status !== 'idle') return;
    startingRef.current = true;
    setError(null);
    setStatus('connecting');

    try {
      // 1. Mint an ephemeral token server-side (API key stays on the server).
      const res = await fetch('/api/live-token');
      if (!res.ok) throw new Error('Could not start voice session');
      const { token } = (await res.json()) as { token: string };

      const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });

      // 2. Microphone capture @ 16kHz.
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = mediaStream;

      const inputCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      inputCtxRef.current = inputCtx;
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      await inputCtx.audioWorklet.addModule('/worklets/capture-processor.js');
      const captureNode = new AudioWorkletNode(inputCtx, 'audio-capture-processor');
      captureNodeRef.current = captureNode;
      inputCtx.createMediaStreamSource(mediaStream).connect(captureNode);

      // 3. Playback @ 24kHz.
      const outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      outputCtxRef.current = outputCtx;
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      await outputCtx.audioWorklet.addModule('/worklets/playback-processor.js');
      const playbackNode = new AudioWorkletNode(outputCtx, 'pcm-processor');
      playbackNodeRef.current = playbackNode;
      playbackNode.connect(outputCtx.destination);

      // 4. Open the live session.
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => setStatus('listening'),
          onmessage: handleMessage,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onerror: (e: any) => {
            console.error('[live] error', e);
            setError('Voice connection error');
            stop();
          },
          onclose: () => stop(),
        },
      });
      sessionRef.current = session;

      // 5. Stream mic chunks → Gemini.
      captureNode.port.onmessage = (event: MessageEvent) => {
        if (event.data?.type !== 'audio' || !sessionRef.current) return;
        const b64 = arrayBufferToBase64(floatTo16BitPCM(event.data.data as Float32Array));
        try {
          sessionRef.current.sendRealtimeInput({ audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } });
        } catch { /* socket closing */ }
      };

      startingRef.current = false;
    } catch (err) {
      console.error('[live] start failed', err);
      setError(err instanceof Error ? err.message : 'Could not start voice session');
      cleanup();
      startingRef.current = false;
      setStatus('error');
    }
  }, [status, handleMessage, stop, cleanup]);

  // Tear down on unmount.
  useEffect(() => cleanup, [cleanup]);

  return { status, error, transcript, start, stop };
}
