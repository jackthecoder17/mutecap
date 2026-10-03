"use client"

import * as React from "react"

import { drawCaption } from "@/lib/captions"
import type { Caption, StyleSettings } from "@/lib/types"

type Props = {
  src: string
  captions: Caption[]
  style: StyleSettings
  fontFamily: string
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTime?: (t: number) => void
}

/** The video with a canvas on top that draws captions exactly the way the export will. */
export function CaptionPreview({ src, captions, style, fontFamily, videoRef, onTime }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = React.useState(16 / 9)

  // Keep the latest props in a ref so the render loop never restarts.
  const latest = React.useRef({ captions, style, fontFamily, onTime })
  React.useEffect(() => {
    latest.current = { captions, style, fontFamily, onTime }
  })

  React.useEffect(() => {
    let raf = 0
    let lastT = -1
    let last: unknown[] = []
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !video.videoWidth) return
      const t = video.currentTime
      const { captions, style, fontFamily, onTime } = latest.current
      // Only redraw when the time or the captions/style actually changed.
      if (t === lastT && last[0] === captions && last[1] === style && last[2] === fontFamily) return
      lastT = t
      last = [captions, style, fontFamily]
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }
      const ctx = canvas.getContext("2d")!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawCaption(ctx, canvas.width, canvas.height, t, captions, style, fontFamily)
      onTime?.(t)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [videoRef])

  return (
    <div className="flex w-full justify-center">
      <div
        className="relative overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: `${ratio}`, width: `min(100%, calc(62svh * ${ratio}))` }}
      >
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          className="absolute inset-0 size-full"
          onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight || 16 / 9)}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden />
      </div>
    </div>
  )
}
