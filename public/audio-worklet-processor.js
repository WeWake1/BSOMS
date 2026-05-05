// Runs inside AudioWorklet context (no DOM, no window).
// Converts Float32 PCM samples to Int16 and posts them to the main thread.
// Designed to be used with an AudioContext at sampleRate 16000 so no
// additional downsampling is required — the OS/browser resamples the
// mic input to 16 kHz before handing samples to the worklet.
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    const int16 = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1, Math.min(1, channel[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    // Transfer ownership for zero-copy
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
