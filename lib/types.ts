export type Word = { text: string; start: number; end: number }

export type Caption = { id: string; start: number; end: number; words: Word[] }

export type CaptionStyle = "pop" | "boxed" | "minimal"
export type CaptionPosition = "top" | "middle" | "bottom"

export type StyleSettings = {
  style: CaptionStyle
  position: CaptionPosition
  size: number // percent of the frame's shorter side
  highlight: string
  wordsPerCaption: number
  uppercase: boolean
}

export const DEFAULT_STYLE: StyleSettings = {
  style: "pop",
  position: "bottom",
  size: 7,
  highlight: "#ffe14d",
  wordsPerCaption: 3,
  uppercase: true,
}

export type WorkerRequest = { type: "transcribe"; audio: Float32Array; language: string | null }

export type WorkerResponse =
  | { type: "loading"; device: "webgpu" | "wasm" }
  | { type: "progress"; progress: number; loaded: number; total: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "transcribing" }
  | { type: "result"; words: Word[]; ms: number }
  | { type: "error"; message: string }

export type Phase =
  | { name: "idle" }
  | { name: "reading" }
  | { name: "loading-model"; device?: "webgpu" | "wasm"; progress: number; loaded: number; total: number }
  | { name: "transcribing"; device?: "webgpu" | "wasm"; startedAt: number }
  | { name: "ready"; device?: "webgpu" | "wasm"; ms: number }
  | { name: "error"; message: string }

export const LANGUAGES: Record<string, string> = {
  english: "English",
  french: "French",
  spanish: "Spanish",
  portuguese: "Portuguese",
  german: "German",
  italian: "Italian",
  dutch: "Dutch",
  yoruba: "Yoruba",
  swahili: "Swahili",
  hindi: "Hindi",
  arabic: "Arabic",
  japanese: "Japanese",
  chinese: "Chinese",
}
