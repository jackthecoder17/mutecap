"use client"

import * as React from "react"

import { extractAudio } from "@/lib/audio"
import type { Phase, Word, WorkerResponse } from "@/lib/types"

export function useTranscriber(onWords: (words: Word[]) => void) {
  const workerRef = React.useRef<Worker | null>(null)
  const [phase, setPhase] = React.useState<Phase>({ name: "idle" })
  const onWordsRef = React.useRef(onWords)
  React.useEffect(() => {
    onWordsRef.current = onWords
  }, [onWords])

  const getWorker = React.useCallback(() => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL("./transcribe.worker.ts", import.meta.url), { type: "module" })
    let device: "webgpu" | "wasm" | undefined
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      switch (msg.type) {
        case "loading":
          device = msg.device
          setPhase((p) => (p.name === "loading-model" ? { ...p, device } : { name: "loading-model", device, progress: 0, loaded: 0, total: 0 }))
          break
        case "progress":
          setPhase((p) => (p.name === "loading-model" ? { ...p, progress: msg.progress, loaded: msg.loaded, total: msg.total } : p))
          break
        case "ready":
          device = msg.device
          break
        case "transcribing":
          setPhase({ name: "transcribing", device, startedAt: performance.now() })
          break
        case "result":
          onWordsRef.current(msg.words)
          setPhase({ name: "ready", device, ms: msg.ms })
          break
        case "error":
          setPhase({ name: "error", message: msg.message })
          break
      }
    }
    // If the worker itself crashes, say so instead of waiting forever.
    worker.onerror = (e) => setPhase({ name: "error", message: e.message || "The transcription worker failed to start." })
    workerRef.current = worker
    return worker
  }, [])

  React.useEffect(() => () => workerRef.current?.terminate(), [])

  const transcribe = React.useCallback(
    async (file: Blob, language: string | null) => {
      setPhase({ name: "reading" })
      try {
        const { audio } = await extractAudio(file)
        setPhase({ name: "loading-model", progress: 0, loaded: 0, total: 0 })
        getWorker().postMessage({ type: "transcribe", audio, language }, [audio.buffer])
      } catch (err) {
        setPhase({ name: "error", message: (err as Error).message })
      }
    },
    [getWorker]
  )

  return { phase, transcribe }
}
