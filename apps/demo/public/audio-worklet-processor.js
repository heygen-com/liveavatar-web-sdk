/**
 * AudioWorklet Processor for microphone input
 * Captures PCM audio and sends to main thread via postMessage
 *
 * This replaces the deprecated ScriptProcessorNode
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 2048; // Reduced from 4096 to lower bandwidth/latency
    this._buffer = new Float32Array(this._bufferSize);
    this._bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const inputChannel = input[0];
    if (!inputChannel) {
      return true;
    }

    // Accumulate samples until we have a full buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this._buffer[this._bufferIndex++] = inputChannel[i];

      // When buffer is full, send to main thread
      if (this._bufferIndex >= this._bufferSize) {
        // Copy buffer and send
        this.port.postMessage({
          type: "audio",
          buffer: this._buffer.slice(),
        });
        this._bufferIndex = 0;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor("mic-processor", MicProcessor);
