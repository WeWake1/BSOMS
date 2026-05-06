# Live Voice-Assisted Agentic Chatbot Implementation

This guide explains how the real-time voice-assisted AI chatbot using the **Gemini Live API** is implemented in this codebase. It covers both backend (FastAPI + WebSockets) and frontend (React + Audio Web APIs) implementation along with UI tool integration (Agentic behaviors like navigation and form-filling).

---

## 1. Overview & Architecture

The voice assistant provides real-time duplex audio using **WebSockets**, bypassing HTTP latency.
The architecture works as follows:

1. **Browser Mic to Backend**: The browser captures microphone audio (48kHz), downsamples it to 16kHz PCM, and streams it as binary frames over WebSockets.
2. **Backend to Gemini API**: A FastAPI WebSocket handler receives the binary frames and forwards them to a live `gemini-3.1-flash-live-preview` session.
3. **Gemini API to Backend**: The Gemini model responds with audio (24kHz PCM), transcripts, and/or tool function calls.
4. **Backend to Browser Speaker**: The backend routes pure PCM data back over the WebSocket to the browser, while JSON frames denote events like tool calls (`action`), transcripts (`transcript`), or silence detection (`turn_complete`).
5. **Agentic Actions (UI Updates)**: WebSockets commands dispatch UI events via a centralized hook (`useAIDispatcher`) triggering UI overlays (like Spotlight) or route changes.

---

## 2. Backend Implementation (FastAPI & Gemini)

### `GeminiLiveVoiceHandler`

The core voice logic is housed in `VanthAI_backend/core/gemini_live.py` inside the `GeminiLiveVoiceHandler` class. It manages concurrent read/write tasks to bridge the browser WebSocket and the `genai.Client` live session.

#### Audio Pump: Browser → Gemini
```python
async def _pump_client_to_gemini(self, session) -> None:
    while not self._stop_event.is_set():
        msg = await self.ws.receive()
        
        # Binary Frames: Mic audio from browser
        if msg.get("bytes"):
            await session.send_realtime_input(
                audio=types.Blob(
                    data=msg["bytes"],
                    mime_type="audio/pcm;rate=16000",
                )
            )
        # Text Frames: Context page updates
        elif msg.get("text"):
            ctrl = json.loads(msg["text"])
            if ctrl.get("type") == "page_update":
                context_msg = f"[SYSTEM CONTEXT UPDATE]\nUser has navigated to: {ctrl.get('page')}"
                await session.send_realtime_input(text=context_msg)
```

#### Audio Pump: Gemini → Browser
```python
async def _pump_gemini_to_client(self, session) -> None:
    async for response in session.receive():
        sc = response.server_content
        if sc:
            # Model output audio → forward raw PCM bytes to browser
            if sc.model_turn:
                 for part in sc.model_turn.parts:
                     if part.inline_data and part.inline_data.data:
                         await self._send_audio(part.inline_data.data)

            # Inform browser of transcripts
            if sc.output_transcription and sc.output_transcription.text:
                await self._send_json({"type": "transcript", "role": "model", "text": sc.output_transcription.text})

        # Process function execution
        if response.tool_call:
            asyncio.create_task(self._handle_tool_call(session, response.tool_call))
```

### Agentic Tools Declarations

In the same file (`gemini_live.py`), `_build_voice_tools()` defines Gemini Tools like the `spotlight_element`, `navigate_to` and environment-specific database tools.

```python
types.FunctionDeclaration(
    name="navigate_to",
    description="Navigate the web portal to a specific page.",
    parameters=types.Schema(
        type="OBJECT",
        properties={"url": types.Schema(type="STRING", description="Route to navigate to.")},
        required=["url"]
    )
)
```

When Gemini invokes a tool, `_handle_tool_call()` intercepts it and sends an `{"type": "action"}` JSON message down the websocket instructing the frontend to react.

---

## 3. Frontend Implementation (React Hooks & Web Audio API)

### Real-Time Streaming Hook (`useVoiceStreamer.ts`)

The front-end audio processing logic lives in `VanthAI_frontend/src/hooks/useVoiceStreamer.ts`. 

- **Microphone**: Uses `navigator.mediaDevices.getUserMedia({ audio: true })`.
- **AudioContext**: Captures stream via `createMediaStreamSource`.
- **Downsampling**: A `ScriptProcessorNode` processes the audio queue in chunks (4096), converting incoming 48kHz Floats to 16kHz Int16/PCM data.

```typescript
const processor = ctx.createScriptProcessor(4096, 1, 1);
processor.onaudioprocess = (e) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  const f32_48k = e.inputBuffer.getChannelData(0);
  const f32_16k = downsample(f32_48k, 48000, 16000); // Reduce sampling rate
  const pcm16 = float32ToInt16(f32_16k); // Convert to Int16
  ws.send(pcm16); // Send ArrayBuffer over WebSocket
};
```

On receiving bytes (Gemini spoken audio) from the WebSocket, the Audio buffer plays them using `createBufferSource`:

```typescript
const enqueueAudio = useCallback((pcmBytes: ArrayBuffer) => {
  const ctx = audioCtxRef.current;
  const f32 = int16ToFloat32(pcmBytes);
  const audioBuffer = ctx.createBuffer(1, f32.length, 24000); // 24kHz
  audioBuffer.copyToChannel(f32, 0);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start(Math.max(ctx.currentTime, nextPlayTimeRef.current));
}, []);
```

### Event Handling & Agentic Behaviors (`useAIDispatcher.ts`)

When JSON actions arrive from the server, `onAction` passes them into a master dispatcher logic defined in `VanthAI_frontend/src/hooks/useAIDispatcher.ts`.

It allows Gemini to control the screen:
- **`navigate`**: Invokes React Router's `navigate(url)`.
- **`spotlight`/`highlight`**: Draws visual boxes around HTML components via `[data-vanthai-id]`.
- **`autofill` / `prefill_form`**: Identifies inputs and populates forms locally on the client.

```typescript
if (parsed.action === 'navigate' && parsed.url) {
  setTimeout(() => navigate(parsed.url!), 500);
} else if (parsed.action === 'spotlight' && parsed.element) {
  const selector = `[data-vanthai-id="${parsed.element}"]`;
  highlight(selector, parsed.popover?.title, parsed.popover?.description);
} else if (parsed.action === 'autofill' && parsed.fill_data) {
  autoFillForm(parsed.fill_data!);
}
```

### UI Binding (`VanthAIChatWidget.tsx`)

Inside the view widget, invoking the voice feature is as simple as managing `startStreaming()` and `stopStreaming()` from the hook attached to the mic UI button. Transcripts are passed via the `onTranscript` callback to populate chat message states automatically.
