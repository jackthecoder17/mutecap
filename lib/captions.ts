import type { Caption, StyleSettings, Word } from "@/lib/types"

/** Groups words into short captions, breaking on word count, sentence ends and pauses. */
export function groupWords(words: Word[], maxWords: number): Caption[] {
  const captions: Caption[] = []
  let current: Word[] = []
  let firstIndex = 0

  const flush = () => {
    if (!current.length) return
    captions.push({ id: String(firstIndex), start: current[0].start, end: current[current.length - 1].end, words: current })
    current = []
  }

  words.forEach((w, i) => {
    const prev = current[current.length - 1]
    const pause = prev ? w.start - prev.end : 0
    if (current.length >= maxWords || pause > 0.7 || (prev && /[.?!]$/.test(prev.text))) flush()
    if (!current.length) firstIndex = i
    current.push(w)
  })
  flush()

  // Keep each caption on screen a little after its last word, without overlapping the next one.
  for (let i = 0; i < captions.length; i++) {
    const next = captions[i + 1]
    const hold = next ? Math.min(0.5, Math.max(0, next.start - captions[i].end)) : 0.6
    captions[i] = { ...captions[i], end: captions[i].end + hold }
  }
  return captions
}

/** Replaces the words of one caption with edited text, keeping timings where the word count still matches. */
export function editCaption(words: Word[], caption: Caption, text: string): Word[] {
  const first = Number(caption.id)
  const count = caption.words.length
  const parts = text.trim().split(/\s+/).filter(Boolean)
  const span = caption.words[count - 1].end - caption.words[0].start

  const replacement: Word[] =
    parts.length === count
      ? caption.words.map((w, i) => ({ ...w, text: parts[i] }))
      : parts.map((p, i) => ({
          text: p,
          start: caption.words[0].start + (span * i) / parts.length,
          end: caption.words[0].start + (span * (i + 1)) / parts.length,
        }))

  return [...words.slice(0, first), ...replacement, ...words.slice(first + count)]
}

export function captionAt(captions: Caption[], t: number) {
  return captions.find((c) => t >= c.start && t < c.end) ?? null
}

type Line = { words: { text: string; width: number; word: Word }[]; width: number }

function layout(ctx: CanvasRenderingContext2D, words: Word[], maxWidth: number, upper: boolean): Line[] {
  const space = ctx.measureText(" ").width
  const lines: Line[] = []
  let line: Line = { words: [], width: 0 }
  for (const word of words) {
    const text = upper ? word.text.toUpperCase() : word.text
    const width = ctx.measureText(text).width
    const extra = line.words.length ? space + width : width
    if (line.words.length && line.width + extra > maxWidth) {
      lines.push(line)
      line = { words: [], width: 0 }
    }
    line.width += line.words.length ? space + width : width
    line.words.push({ text, width, word })
  }
  if (line.words.length) lines.push(line)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

/**
 * Draws the caption active at time `t` onto a canvas of size `width`×`height`.
 * Used for both the live preview and every frame of the exported video, so they always match.
 */
export function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  captions: Caption[],
  s: StyleSettings,
  fontFamily: string
) {
  const caption = captionAt(captions, t)
  if (!caption) return

  const fontSize = Math.round((Math.min(width, height) * s.size) / 100)
  const weight = s.style === "minimal" ? 600 : s.style === "boxed" ? 700 : 900
  ctx.save()
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = "middle"
  ctx.textAlign = "left"
  ctx.lineJoin = "round"

  const lines = layout(ctx, caption.words, width * 0.86, s.uppercase)
  const lineHeight = fontSize * (s.style === "boxed" ? 1.45 : 1.2)
  const blockHeight = lines.length * lineHeight
  const centerY = s.position === "top" ? height * 0.15 : s.position === "middle" ? height * 0.5 : height * 0.8
  const space = ctx.measureText(" ").width
  let y = centerY - blockHeight / 2 + lineHeight / 2

  for (const line of lines) {
    let x = (width - line.width) / 2

    if (s.style === "boxed") {
      const padX = fontSize * 0.35
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)"
      roundRect(ctx, x - padX, y - lineHeight / 2 + fontSize * 0.08, line.width + padX * 2, lineHeight - fontSize * 0.16, fontSize * 0.22)
    }

    for (const { text, width: w, word } of line.words) {
      const active = t >= word.start && t < word.end
      const highlight = active && s.style !== "minimal"

      if (s.style === "pop") {
        // Active word grows slightly and takes the highlight colour.
        const scale = highlight ? 1.1 : 1
        ctx.save()
        ctx.translate(x + w / 2, y)
        ctx.scale(scale, scale)
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)"
        ctx.shadowBlur = fontSize * 0.25
        ctx.shadowOffsetY = fontSize * 0.06
        ctx.lineWidth = fontSize * 0.2
        ctx.strokeStyle = "#000"
        ctx.strokeText(text, -w / 2, 0)
        ctx.shadowColor = "transparent"
        ctx.fillStyle = highlight ? s.highlight : "#fff"
        ctx.fillText(text, -w / 2, 0)
        ctx.restore()
      } else {
        ctx.shadowColor = s.style === "minimal" ? "rgba(0, 0, 0, 0.75)" : "transparent"
        ctx.shadowBlur = s.style === "minimal" ? fontSize * 0.3 : 0
        ctx.fillStyle = highlight ? s.highlight : "#fff"
        ctx.fillText(text, x, y)
      }
      x += w + space
    }
    y += lineHeight
  }
  ctx.restore()
}

const srtTime = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000))
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number, l = 2) => String(n).padStart(l, "0")
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`
}

export function toSrt(captions: Caption[]) {
  return captions
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.words.map((w) => w.text).join(" ")}\n`)
    .join("\n")
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}
