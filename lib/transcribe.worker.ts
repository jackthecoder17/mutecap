/// <reference lib="webworker" />
// Runs Whisper off the main thread so the page stays responsive while it transcribes.
import { env, pipeline, type ProgressInfo } from "@huggingface/transformers"

import type { Word, WorkerRequest, WorkerResponse } from "@/lib/types"

// The "_timestamped" export includes the attention outputs Whisper needs for word-level timings.
const MODEL_ID = "onnx-community/whisper-base_timestamped"

env.allowLocalModels = false

const post = (msg: WorkerResponse) => self.postMessage(msg)

type Device = "webgpu" | "wasm"
type Asr = { device: Device; run: (audio: Float32Array, language: string | null) => Promise<Word[]> }

// GPU and CPU use different files, so falling back can never reuse a broken GPU session.
const DTYPES = {
  webgpu: { encoder_model: "fp32", decoder_model_merged: "q4" },
  wasm: { encoder_model: "q8", decoder_model_merged: "q8" },
} as const

let asr: Promise<Asr> | null = null

async function hasGpu() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  // requestAdapter() can hang on some setups, so don't wait on it forever.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  return Boolean(await Promise.race([gpu.requestAdapter().catch(() => null), timeout]))
}

function onProgress(p: ProgressInfo) {
  if (p.status === "progress_total") post({ type: "progress", progress: p.progress, loaded: p.loaded, total: p.total })
}

type Chunk = { text: string; timestamp: [number, number | null] }

async function create(device: Device): Promise<Asr> {
  post({ type: "loading", device })
  const pipe = await pipeline("automatic-speech-recognition", MODEL_ID, {
    device,
    dtype: DTYPES[device],
    progress_callback: onProgress,
  })
  post({ type: "ready", device })
  return {
    device,
    run: async (audio, language) => {
      const out = (await pipe(audio, {
        return_timestamps: "word",
        chunk_length_s: 30,
        stride_length_s: 5,
        task: "transcribe",
        ...(language ? { language } : {}),
      })) as { chunks?: Chunk[] }
      const words: Word[] = []
      for (const c of out.chunks ?? []) {
        const text = c.text.trim()
        if (!text) continue
        const end = c.timestamp[1] ?? c.timestamp[0] + 0.3
        const prev = words[words.length - 1]
        // Whisper sometimes splits a word into pieces ("open" + "-source", "it" + "'s"); join them back.
        if (prev && /^[-'’]|^[.,!?;:]+$/.test(text)) {
          prev.text += text
          prev.end = end
        } else {
          words.push({ text, start: c.timestamp[0], end })
        }
      }
      return words
    },
  }
}

function load() {
  asr ??= (async () => {
    if (!(await hasGpu())) return create("wasm")
    try {
      return await create("webgpu")
    } catch (err) {
      console.warn("WebGPU failed to start, using the CPU", err)
      return create("wasm")
    }
  })().catch((err) => {
    asr = null
    throw err
  })
  return asr
}

async function transcribe(audio: Float32Array, language: string | null) {
  const current = await load()
  post({ type: "transcribing" })
  const started = performance.now()
  try {
    return { words: await current.run(audio, language), ms: performance.now() - started }
  } catch (err) {
    // Some GPUs load the model but can't run it; retry once on the CPU.
    if (current.device !== "webgpu") throw err
    console.warn("WebGPU run failed, using the CPU", err)
    asr = create("wasm")
    const cpu = await asr
    post({ type: "transcribing" })
    const restarted = performance.now()
    return { words: await cpu.run(audio, language), ms: performance.now() - restarted }
  }
}

let queue: Promise<unknown> = Promise.resolve()

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { audio, language } = e.data
  queue = queue.then(async () => {
    try {
      const { words, ms } = await transcribe(audio, language)
      post({ type: "result", words, ms })
    } catch (err) {
      post({ type: "error", message: String((err as Error)?.message ?? err) })
    }
  })
}
