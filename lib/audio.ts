// Whisper expects 16 kHz mono audio.
const SAMPLE_RATE = 16_000

/** Decodes the audio track of a video or audio file and resamples it to 16 kHz mono. */
export async function extractAudio(file: Blob): Promise<{ audio: Float32Array; duration: number }> {
  const buffer = await file.arrayBuffer()
  const ctx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(buffer)
  } catch {
    throw new Error("This file has no audio track the browser can read. Try an MP4, MOV or WebM with sound.")
  } finally {
    ctx.close()
  }

  const length = Math.ceil(decoded.duration * SAMPLE_RATE)
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination) // mixes all channels down to mono
  source.start()
  const rendered = await offline.startRendering()
  return { audio: rendered.getChannelData(0), duration: decoded.duration }
}
