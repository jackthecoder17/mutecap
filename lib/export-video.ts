import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from "mediabunny"

import { drawCaption } from "@/lib/captions"
import type { Caption, StyleSettings } from "@/lib/types"

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/**
 * Re-encodes the video with captions burned in, using the browser's own (usually hardware) encoder.
 * Audio is copied through untouched where the container allows it.
 */
export async function exportCaptionedVideo(
  file: Blob,
  captions: Caption[],
  style: StyleSettings,
  fontFamily: string,
  onProgress: (p: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new Error("This file has no video track.")

  const width = even(track.displayWidth)
  const height = even(track.displayHeight)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() })
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      codec: "avc",
      width,
      height,
      // H.264 needs even dimensions; the size changes by at most a pixel, so stretching is invisible.
      fit: "fill",
      // Bake any phone rotation into the pixels so the captions end up the right way up.
      allowTransformationMetadata: false,
      process: (sample) => {
        ctx.clearRect(0, 0, width, height)
        sample.draw(ctx, 0, 0, width, height)
        drawCaption(ctx, width, height, sample.timestamp, captions, style, fontFamily)
        return canvas
      },
      processedWidth: width,
      processedHeight: height,
    },
  })
  if (!conversion.isValid) {
    throw new Error("Your browser can't encode this video. Try the latest Chrome, Edge or Safari.")
  }

  conversion.onProgress = (p) => onProgress(p)
  signal?.addEventListener("abort", () => conversion.cancel())
  await conversion.execute()

  const buffer = (output.target as BufferTarget).buffer
  if (!buffer) throw new Error("The export finished without any output.")
  return new Blob([buffer], { type: "video/mp4" })
}
