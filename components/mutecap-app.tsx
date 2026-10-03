"use client"

import * as React from "react"
import { CaptionsIcon, DownloadIcon, FileTextIcon, FilmIcon, Loader2Icon, RotateCcwIcon, ShieldCheckIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { captionAt, editCaption, groupWords, toSrt } from "@/lib/captions"
import { exportCaptionedVideo } from "@/lib/export-video"
import { DEFAULT_STYLE, LANGUAGES, type Caption, type Phase, type StyleSettings, type Word } from "@/lib/types"
import { useTranscriber } from "@/lib/use-transcriber"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CaptionPreview } from "@/components/caption-preview"
import { StylePanel } from "@/components/style-panel"
import { ThemeToggle } from "@/components/theme-toggle"
import { TranscriptEditor } from "@/components/transcript-editor"

const SAMPLE_BASE = "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main"
const SAMPLES = [
  { file: "interview.mp4", label: "Interview", length: "42s" },
  { file: "courtroom.mp4", label: "Courtroom", length: "14s" },
]
const GITHUB_URL = "https://github.com/jackthecoder17/mutecap"

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** next/font gives the caption face a generated family name; canvas needs that exact name. */
function useCaptionFont() {
  const [family, setFamily] = React.useState("system-ui, sans-serif")
  React.useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--font-caption").trim()
    if (!value) return
    Promise.all([600, 700, 900].map((w) => document.fonts.load(`${w} 40px ${value}`))).finally(() => setFamily(value))
  }, [])
  return family
}

export function MutecapApp() {
  const [file, setFile] = React.useState<{ blob: Blob; name: string; url: string } | null>(null)
  const [language, setLanguage] = React.useState("english")
  const [words, setWords] = React.useState<Word[]>([])
  const [style, setStyle] = React.useState<StyleSettings>(DEFAULT_STYLE)
  const [time, setTime] = React.useState(0)
  const [exporting, setExporting] = React.useState<{ progress: number; abort: AbortController } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const fontFamily = useCaptionFont()
  const { phase, transcribe } = useTranscriber(setWords)

  const captions = React.useMemo(() => groupWords(words, style.wordsPerCaption), [words, style.wordsPerCaption])
  const active = captionAt(captions, time)

  const start = React.useCallback(
    (blob: Blob, name: string) => {
      if (!blob.type.startsWith("video/") && !blob.type.startsWith("audio/")) {
        toast.error("That file isn't a video. Try an MP4, MOV or WebM.")
        return
      }
      setFile((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return { blob, name, url: URL.createObjectURL(blob) }
      })
      setWords([])
      transcribe(blob, language)
    },
    [language, transcribe]
  )

  React.useEffect(() => {
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return
      depth++
      setDragging(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const onOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) start(f, f.name)
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("dragover", onOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [start])

  async function trySample(name: string) {
    try {
      const res = await fetch(`${SAMPLE_BASE}/${name}`)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      start(new Blob([blob], { type: "video/mp4" }), name)
    } catch {
      toast.error("Couldn't load the sample video. Check your connection and try again.")
    }
  }

  const baseName = (file?.name ?? "video").replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-")

  async function exportVideo() {
    if (!file) return
    const abort = new AbortController()
    setExporting({ progress: 0, abort })
    videoRef.current?.pause()
    try {
      const blob = await exportCaptionedVideo(file.blob, captions, style, fontFamily, (p) => setExporting((e) => (e ? { ...e, progress: p } : e)), abort.signal)
      if (abort.signal.aborted) return
      download(blob, `${baseName}-captioned.mp4`)
      toast.success(`Saved ${baseName}-captioned.mp4`)
    } catch (err) {
      if (!abort.signal.aborted) {
        console.error(err)
        toast.error((err as Error).message || "Export failed. Try again.")
      }
    } finally {
      setExporting(null)
    }
  }

  function seek(t: number) {
    if (videoRef.current) videoRef.current.currentTime = t + 0.01
  }

  function onEdit(caption: Caption, text: string) {
    setWords((w) => editCaption(w, caption, text))
  }

  function reset() {
    if (file) URL.revokeObjectURL(file.url)
    setFile(null)
    setWords([])
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <button type="button" onClick={reset} className="mr-auto flex items-center gap-2" aria-label="Mutecap home">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CaptionsIcon className="size-4" />
            </span>
            <span className="font-heading text-lg font-bold tracking-tight">Mutecap</span>
          </button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}>
            <GithubMark />
            <span className="hidden sm:inline">GitHub</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) start(f, f.name)
          e.target.value = ""
        }}
      />

      {!file ? (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-8 px-4 py-12 sm:py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheckIcon className="size-3.5 text-primary" />
              Your video never leaves your device
            </span>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">Captions for people who watch on mute</h1>
            <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
              Drop in a video and get word-by-word captions burned in, ready to post. Free, no sign-up, and the AI runs on your own computer.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-card px-6 py-14 text-center transition-colors",
                "hover:border-primary/60 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none",
                dragging && "border-primary bg-primary/5"
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <FilmIcon className="size-6" />
              </span>
              <span className="text-lg font-semibold">Drop a video here or click to choose</span>
              <span className="text-sm text-muted-foreground">MP4, MOV or WebM. Best for clips under 3 minutes.</span>
            </button>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Label htmlFor="language">Spoken language</Label>
              <Select items={LANGUAGES} value={language} onValueChange={(v) => v && setLanguage(v)}>
                <SelectTrigger id="language" size="sm" className="min-w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <span className="text-sm text-muted-foreground">No video handy? Try a sample:</span>
            <div className="flex flex-wrap justify-center gap-2">
              {SAMPLES.map((s) => (
                <Button key={s.file} variant="outline" onClick={() => trySample(s.file)}>
                  <FilmIcon data-icon="inline-start" />
                  {s.label} <span className="text-muted-foreground">{s.length}</span>
                </Button>
              ))}
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            <CaptionPreview src={file.url} captions={captions} style={style} fontFamily={fontFamily} videoRef={videoRef} onTime={setTime} />
            {phase.name === "ready" ? (
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Transcript ({captions.length} captions)</Label>
                    <span className="text-xs text-muted-foreground">Click a line to edit it</span>
                  </div>
                  {captions.length ? (
                    <TranscriptEditor captions={captions} activeId={active?.id ?? null} onSeek={seek} onEdit={onEdit} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No speech was found in this video.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <StatusCard phase={phase} onRetry={() => transcribe(file.blob, language)} />
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <Card>
              <CardContent>
                <StylePanel value={style} onChange={(patch) => setStyle((s) => ({ ...s, ...patch }))} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-2">
                {exporting ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Burning in captions…</span>
                      <span className="text-muted-foreground tabular-nums">{Math.round(exporting.progress * 100)}%</span>
                    </div>
                    <Progress value={Math.round(exporting.progress * 100)} aria-label="Export progress" />
                    <Button variant="outline" onClick={() => exporting.abort.abort()}>
                      <XIcon data-icon="inline-start" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button size="lg" disabled={phase.name !== "ready" || !captions.length} onClick={exportVideo}>
                      <DownloadIcon data-icon="inline-start" />
                      Export captioned MP4
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={phase.name !== "ready" || !captions.length}
                      onClick={() => download(new Blob([toSrt(captions)], { type: "text/plain" }), `${baseName}.srt`)}
                    >
                      <FileTextIcon data-icon="inline-start" />
                      Download .srt
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Use a different video
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        </main>
      )}

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <span>
            Transcribes with{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://huggingface.co/onnx-community/whisper-base_timestamped" target="_blank" rel="noreferrer">Whisper</a>{" "}
            via{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://github.com/huggingface/transformers.js" target="_blank" rel="noreferrer">Transformers.js</a>
            , exports with{" "}
            <a className="underline underline-offset-2 hover:text-foreground" href="https://mediabunny.dev" target="_blank" rel="noreferrer">Mediabunny</a>
            . All in your browser.
          </span>
          <a className="underline underline-offset-2 hover:text-foreground" href={GITHUB_URL} target="_blank" rel="noreferrer">
            Open source on GitHub
          </a>
        </div>
      </footer>

      {dragging && file && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background px-8 py-6 text-lg font-semibold shadow-xl">Drop to caption this video</div>
        </div>
      )}
    </div>
  )
}

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`

function StatusCard({ phase, onRetry }: { phase: Phase; onRetry: () => void }) {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    if (phase.name !== "transcribing") return
    const id = setInterval(() => setNow(performance.now()), 500)
    return () => clearInterval(id)
  }, [phase.name])

  if (phase.name === "error") {
    return (
      <Card>
        <CardContent className="flex items-start gap-3">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm">Couldn&apos;t transcribe this video.</p>
            <p className="line-clamp-3 text-xs break-all text-muted-foreground">{phase.message}</p>
            <Button size="sm" variant="outline" className="self-start" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  let title = "Reading the audio…"
  let detail: React.ReactNode = "Pulling the sound out of your video."
  let progress: number | null = null

  if (phase.name === "loading-model") {
    const downloading = phase.total > 0 && phase.progress < 100
    title = downloading ? "Downloading the speech model (one time only)" : "Starting the speech model…"
    detail = downloading ? `${mb(phase.loaded)} of ${mb(phase.total)}. After this it's cached, so next time it starts instantly.` : "Getting Whisper ready on your device."
    progress = downloading ? phase.progress : null
  } else if (phase.name === "transcribing") {
    const seconds = now ? Math.max(0, Math.round((now - phase.startedAt) / 1000)) : 0
    title = "Listening and writing captions…"
    detail = `Running on your ${phase.device === "webgpu" ? "GPU" : "CPU"} · ${seconds}s so far`
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2Icon className="size-4 animate-spin" />
          {title}
        </div>
        {progress !== null && <Progress value={Math.round(progress)} aria-label="Model download progress" />}
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}
