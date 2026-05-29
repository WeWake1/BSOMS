/**
 * Mic capture worklet for the Gemini Live API.
 * Buffers incoming Float32 mic samples into ~32ms chunks (512 samples @ 16kHz,
 * per Gemini's 20-40ms guidance) and posts them to the main thread.
 * Adapted from Google's official gemini-live-api-examples.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage({ type: 'audio', data: this.buffer.slice() });
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
