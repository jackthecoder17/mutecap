"use client"

import * as React from "react"

import { formatTime } from "@/lib/captions"
import type { Caption } from "@/lib/types"
import { cn } from "@/lib/utils"

type Props = {
  captions: Caption[]
  activeId: string | null
  onSeek: (t: number) => void
  onEdit: (caption: Caption, text: string) => void
}

export function TranscriptEditor({ captions, activeId, onSeek, onEdit }: Props) {
  const listRef = React.useRef<HTMLOListElement>(null)

  // Keep the caption being spoken in view while the video plays, without stealing focus from an input.
  React.useEffect(() => {
    if (!activeId || listRef.current?.contains(document.activeElement)) return
    listRef.current?.querySelector(`[data-id="${activeId}"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeId])

  return (
    <ol ref={listRef} className="flex max-h-[42svh] flex-col gap-1 overflow-y-auto pr-1">
      {captions.map((c) => (
        <li
          key={`${c.id}-${c.words.length}`}
          data-id={c.id}
          className={cn("flex items-center gap-2 rounded-lg px-2 py-1 transition-colors", c.id === activeId && "bg-primary/10")}
        >
          <button
            type="button"
            onClick={() => onSeek(c.start)}
            className="w-11 shrink-0 text-left font-mono text-xs text-muted-foreground tabular-nums hover:text-foreground"
            aria-label={`Jump to ${formatTime(c.start)}`}
          >
            {formatTime(c.start)}
          </button>
          <input
            defaultValue={c.words.map((w) => w.text).join(" ")}
            onBlur={(e) => {
              const text = e.target.value.trim()
              if (text && text !== c.words.map((w) => w.text).join(" ")) onEdit(c, text)
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onFocus={() => onSeek(c.start)}
            aria-label={`Caption at ${formatTime(c.start)}`}
            className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm outline-none hover:border-border focus:border-ring focus:bg-background"
          />
        </li>
      ))}
    </ol>
  )
}
