"use client"

import type { CaptionPosition, CaptionStyle, StyleSettings } from "@/lib/types"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const HIGHLIGHTS = ["#ffe14d", "#4dff88", "#4dd2ff", "#ff5c8a", "#ffffff"]

const STYLES: { value: CaptionStyle; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "boxed", label: "Boxed" },
  { value: "minimal", label: "Minimal" },
]

const POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
]

const selected = "flex-1 aria-pressed:bg-foreground aria-pressed:text-background"

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</Label>
        {value && <span className="text-xs tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  )
}

export function StylePanel({ value, onChange }: { value: StyleSettings; onChange: (patch: Partial<StyleSettings>) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Style">
        <ToggleGroup variant="outline" size="sm" className="w-full" value={[value.style]} onValueChange={(v) => v[0] && onChange({ style: v[0] as CaptionStyle })}>
          {STYLES.map((s) => (
            <ToggleGroupItem key={s.value} value={s.value} className={selected}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field label="Position">
        <ToggleGroup variant="outline" size="sm" className="w-full" value={[value.position]} onValueChange={(v) => v[0] && onChange({ position: v[0] as CaptionPosition })}>
          {POSITIONS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className={selected}>
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {value.style !== "minimal" && (
        <Field label="Highlight">
          <div className="flex gap-2">
            {HIGHLIGHTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight colour ${c}`}
                aria-pressed={value.highlight === c}
                onClick={() => onChange({ highlight: c })}
                className="size-7 rounded-full border shadow-xs aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-background"
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
      )}

      <Field label="Text size" value={`${value.size}%`}>
        <Slider aria-label="Text size" min={4} max={12} step={0.5} value={value.size} onValueChange={(v) => onChange({ size: v as number })} />
      </Field>

      <Field label="Words per caption" value={String(value.wordsPerCaption)}>
        <Slider aria-label="Words per caption" min={1} max={8} value={value.wordsPerCaption} onValueChange={(v) => onChange({ wordsPerCaption: v as number })} />
      </Field>

      <div className="flex items-center justify-between">
        <Label htmlFor="uppercase">All caps</Label>
        <Switch id="uppercase" checked={value.uppercase} onCheckedChange={(uppercase) => onChange({ uppercase })} />
      </div>
    </div>
  )
}
