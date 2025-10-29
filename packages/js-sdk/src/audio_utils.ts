/**
 * Splits a PCM 24KHz audio string (raw 16-bit signed PCM) into 20ms chunks.
 * @param pcmString - The raw PCM data as a string
 * @returns string[] - Array of 20ms PCM chunks as strings
 *
 * Each 20ms chunk at 24,000Hz, 16-bit mono = 24,000 * 0.02 = 480 samples.
 * Each sample = 2 bytes (16-bit), so 480 * 2 = 960 bytes per chunk.
 * Each JS string char is a single byte if encoded as binary string.
 */
export function splitPcm24kStringToChunks(pcmString: string): string[] {
  const bytesPerChunk = 480 * 2; // 960 bytes == 20ms at 24kHz mono, 16-bit
  const totalLength = pcmString.length;
  const result: string[] = [];
  for (let i = 0; i < totalLength; i += bytesPerChunk) {
    result.push(pcmString.slice(i, i + bytesPerChunk));
  }
  return result;
}
