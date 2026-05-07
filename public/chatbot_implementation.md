### Architecture Overview

The chatbot features a **FastAPI** backend and a **React/Vite** frontend.
1. **Text Chat**: Uses standard HTTP Streaming via Server-Sent Events (SSE). It relies on LangChain `@tool` decorators for database interactions.
2. **Voice Chat**: Uses bidirectional WebSockets and connects to the new **Gemini Multimodal Live API (`gemini-3.1-flash-live-preview`)** using the official `google.genai` SDK.
3. **Database**: Managed via `sqlalchemy.ext.asyncio` using `psycopg3`.

---

### 1. Database Configuration & Tool Implementation (Text Chat)
The database tool implementation is cleanly separated. The tools open an async database session and serialize the returned rows into JSON strings for the LLM to digest.

**Backend DB config (`core/db.py`):**
```python
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

engine = create_async_engine(settings.database_url, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass
```

**Tool implementation (`agents/cloudcare/tools.py`):**
```python
import json
from langchain_core.tools import tool
from sqlalchemy import select
from core.db import AsyncSessionLocal
from models.cloudcare import HealthRecord, Doctor

@tool
async def query_health_records(patient_id: int) -> str:
    """Query the complete medical history for a patient."""
    async with AsyncSessionLocal() as session:
        try:
            stmt = (
                select(HealthRecord, Doctor.name)
                .join(Doctor, HealthRecord.doctor_id == Doctor.id, isouter=True)
                .where(HealthRecord.patient_id == patient_id)
            )
            result = await session.execute(stmt)
            records = [{"id": r[0].id, "type": r[0].record_type, "doctor": r[1]} for r in result]
            return json.dumps(records)
        except Exception as exc:
            return json.dumps({"error": str(exc)})
```

---

### 2. Gemini Live API Integration (Real-Time Voice)
The backend maintains a WebSocket bridge between the browser and the Google genai client. It listens for 16kHz PCM binary data from the browser to send to Gemini, and routes 24kHz PCM from Gemini back to the browser. 

**Backend Voice Bridge (`core/gemini_live.py`):**
```python
import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

_genai_client = genai.Client(api_key=settings.google_ai_api_key)

# Tools in the Live API are declared via explicit Schemas
def _build_voice_tools() -> types.Tool:
    return types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="query_health_records",
            description="Query the complete medical history for a patient.",
            parameters=types.Schema(
                type="OBJECT",
                properties={"patient_id": types.Schema(type="INTEGER")},
                required=["patient_id"],
            ),
        ),
        # ... other tools like navigate_to, highlight_element
    ])

class GeminiLiveVoiceHandler:
    def __init__(self, websocket: WebSocket):
        self.ws = websocket
        self._stop_event = asyncio.Event()

    async def _pump_client_to_gemini(self, session):
        while not self._stop_event.is_set():
            msg = await self.ws.receive()
            if msg.get("bytes"):
                # Audio from mic -> gemini
                await session.send_realtime_input(
                    audio=types.Blob(data=msg["bytes"], mime_type="audio/pcm;rate=16000")
                )
            # You can also parse JSON commands from the frontend here

    async def run(self):
        await self.ws.accept()
        # Initialize Gemini session
        async with _genai_client.aio.live.connect(
            model="models/gemini-3.1-flash-live-preview",
            config=types.LiveConnectConfig(
                response_modalities=["AUDIO"],
                tools=[_build_voice_tools()]
            )
        ) as gemini_session:
             # Run tasks concurrently to stream back and forth...
             pass 
```

---

### 3. Frontend Real-Time Voice Streamer
The frontend uses the Web Audio API to stream audio to the backend and queue the responses without gaps in playback.

**Frontend Hook (`src/hooks/useVoiceStreamer.ts`):**
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

// Helpers to scale audio sample rates between standard microphone 48kHz and Gemini's 16kHz
function downsample(buffer: Float32Array, srcRate: number, dstRate: number): Float32Array {
  const ratio = srcRate / dstRate;
  const length = Math.floor(buffer.length / ratio);
  const result = new Float32Array(length);
  for (let i = 0; i < length; i++) result[i] = buffer[Math.floor(i * ratio)];
  return result;
}

function float32ToInt16(buffer: Float32Array): ArrayBuffer {
  const out = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

export function useVoiceStreamer(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const startStreaming = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;
    nextPlayTimeRef.current = ctx.currentTime;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const f32_48k = e.inputBuffer.getChannelData(0);
        const f32_16k = downsample(f32_48k, 48000, 16000);
        ws.send(float32ToInt16(f32_16k));
      };

      source.connect(processor);
      processor.connect(ctx.destination);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Enqueue playback smoothly
        const f32 = new Float32Array(new Int16Array(event.data)).map(v => v / 32768.0);
        const audioBuffer = ctx.createBuffer(1, f32.length, 24000);
        audioBuffer.copyToChannel(f32, 0);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        
        const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
        source.start(startAt);
        nextPlayTimeRef.current = startAt + audioBuffer.duration;
      } else {
        // Handle normal JSON messages from the AI (navigate, fill form, transcripts, etc.)
        const msg = JSON.parse(event.data);
      }
    };
  };

  return { startStreaming };
}
```

### 4. Handling AI Interface Actions (Frontend Dispatcher)
When the AI uses generic tools like UI navigation, highlighting, or form-fills during a voice session, it sends JSON payloads down the socket that the frontend handles using a dispatcher.

**Frontend Dispatcher (`src/hooks/useAIDispatcher.ts`):**
```typescript
import { useNavigate } from 'react-router-dom';

export function useAIDispatcher() {
  const navigate = useNavigate();

  const dispatch = (parsedAction: any) => {
    if (parsedAction.action === 'navigate' && parsedAction.url) {
      navigate(parsedAction.url);
    } else if (parsedAction.action === 'fillForm') {
      // Logic mapping form fields
      autoFillForm(parsedAction.data);
    } else if (parsedAction.action === 'highlight') {
      // Use logic to highlight the component in question to assist user
      highlightUIElement(parsedAction.selector);
    }
  };

  return { dispatch };
}
```

*Notes for Claude: The main crux of the challenge with Gemini live typically lies in `AudioContext` scaling—taking the `48000` Mic Sample rate from browser's `getUserMedia()`, buffering it via ScriptProcessor chunks down to the `16000` required by Gemini natively, and playing back the `24000` it returns without clicks/the model outputs sequentially to prevent clicking.*