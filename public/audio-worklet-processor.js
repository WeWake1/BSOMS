// Runs inside AudioWorkletGlobalScope (no DOM, no window).
// Resamples mic Float32 input from the AudioContext's native rate
// (typically 48000 on Windows) down to 16 kHz Int16 PCM, buffers ~250 ms
// per chunk, and posts each chunk to the main thread.
//
// Resampling is via simple linear interpolation. We carry one float of
// state across process() calls (the very last sample of the previous
// quantum) so interpolation across the quantum boundary is correct
// rather than reading off the end of the array.
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 4000; // 250 ms at 16 kHz

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.outBuffer = new Int16Array(CHUNK_SAMPLES);
    this.outOffset = 0;

    // Fractional position into the current channel array. Carries between
    // process() calls — when we cross a quantum boundary we subtract
    // channel.length so it becomes the offset into the *next* channel.
    this.readOffset = 0;

    // Last sample of the previous quantum (used as the "left" sample
    // for interpolation when readOffset is in [-1, 0)).
    this.prevLast = 0;
    this.havePrev = false;

    this.port.postMessage({ type: 'init', inputRate: sampleRate });
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || channel.length === 0) return true;

    const ratio = sampleRate / TARGET_RATE;
    let peak = 0;

    // Walk through this quantum producing one output sample per `ratio` input
    while (this.readOffset < channel.length - 1) {
      const idx = Math.floor(this.readOffset);
      const frac = this.readOffset - idx;
      let s0;
      let s1;
      if (idx < 0) {
        // Interpolating across the boundary: left = prev quantum's last sample
        s0 = this.havePrev ? this.prevLast : channel[0];
        s1 = channel[0];
      } else {
        s0 = channel[idx];
        s1 = channel[idx + 1];
      }
      const sample = s0 + (s1 - s0) * frac;

      const abs = sample < 0 ? -sample : sample;
      if (abs > peak) peak = abs;

      const clamped = Math.max(-1, Math.min(1, sample));
      this.outBuffer[this.outOffset++] =
        clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);

      if (this.outOffset === CHUNK_SAMPLES) {
        const out = new Int16Array(this.outBuffer);
        this.port.postMessage(
          { type: 'audio', data: out.buffer, peak },
          [out.buffer]
        );
        this.outOffset = 0;
        peak = 0;
      }

      this.readOffset += ratio;
    }

    // Rebase readOffset for the next quantum (subtract however many input
    // samples we just walked past). Result will typically land in [-1, 0).
    this.readOffset -= channel.length;

    this.prevLast = channel[channel.length - 1];
    this.havePrev = true;

    this.port.postMessage({ type: 'level', peak });
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
