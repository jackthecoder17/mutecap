# Mutecap

**Captions for people who watch on mute.**

Drop in a video and get word-by-word captions burned in, ready to post on LinkedIn, Instagram or TikTok. The speech recognition and the video encoding both run in your browser, so your video is never uploaded. Free, no sign-up, no watermark.

Built with **Next.js**, **shadcn/ui**, **[Transformers.js](https://github.com/huggingface/transformers.js)** (Whisper) and **[Mediabunny](https://mediabunny.dev)**.

---

## Features

- **Automatic transcription with word-level timing,** using OpenAI's open-source Whisper model running on your device.
- **3 caption styles:**
  - **Pop:** bold, all caps, with the spoken word highlighted, the short-form video look.
  - **Boxed:** text on a dark rounded bar.
  - **Minimal:** clean white subtitles.
- **Adjustable:** position (top, middle, bottom), text size, highlight colour, words per caption, all caps on or off.
- **Edit the transcript:** click any line to fix a word. Timing is kept, or spread evenly if you change the number of words.
- **Live preview** that matches the export exactly, because both are drawn by the same code.
- **Export a captioned MP4** at the original resolution, with the original audio.
- **Download an `.srt` file** if you'd rather upload captions separately.
- **13 spoken languages** to choose from.
- Light and dark mode.

## How it works

1. **Audio.** The browser decodes the video's soundtrack with the Web Audio API and resamples it to 16 kHz mono, which is what Whisper expects.
2. **Transcription.** A Web Worker runs [whisper-base_timestamped](https://huggingface.co/onnx-community/whisper-base_timestamped) with Transformers.js and asks for word-level timestamps.
   - **On a GPU (WebGPU):** an fp32 encoder and a 4-bit decoder (about 209 MB).
   - **On the CPU (WebAssembly):** 8-bit files (about 77 MB).
   - The two paths use different files, so if a GPU loads the model but can't run it, the CPU retry never reuses the broken session.
   - The model is cached after the first visit.
3. **Captions.** Words are grouped into short captions, breaking on your chosen word count, at sentence ends and at pauses longer than 0.7 seconds. Each caption stays up briefly after its last word.
4. **Export.** [Mediabunny](https://mediabunny.dev) decodes the video frame by frame. A `process` hook draws each frame onto a canvas and draws the active caption on top, using the same function as the preview. Then the browser's WebCodecs encoder, usually hardware accelerated, writes H.264 into an MP4. The audio track is copied through.

**Speed.** The site sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` (see `next.config.ts`). That makes the page cross-origin isolated, so the CPU fallback can use every core.

## Tech stack

| | |
| --- | --- |
| Framework | [Next.js](https://nextjs.org) (App Router) + TypeScript |
| UI | [shadcn/ui](https://ui.shadcn.com) on Base UI: Button, Card, Select, Slider, Switch, Toggle Group, Progress, Sonner |
| Speech recognition | [Whisper](https://github.com/openai/whisper) (MIT) via [Transformers.js](https://github.com/huggingface/transformers.js) + ONNX Runtime Web |
| Video encoding | [Mediabunny](https://mediabunny.dev) (MPL-2.0) + WebCodecs |
| Caption font | Montserrat |
| Styling | Tailwind CSS v4 |

## Project structure

```
app/
  layout.tsx               fonts (including the caption face), theme, toaster
  page.tsx                 renders <MutecapApp />
components/
  mutecap-app.tsx          upload, status, export, layout
  caption-preview.tsx      video with a live caption canvas on top
  style-panel.tsx          caption style controls
  transcript-editor.tsx    editable, clickable transcript
  ui/                      shadcn/ui components
lib/
  transcribe.worker.ts     Whisper in a Web Worker, GPU with CPU fallback
  use-transcriber.ts       React hook around the worker
  audio.ts                 extracts 16 kHz mono audio from a video
  captions.ts              grouping, drawing, editing and .srt export
  export-video.ts          burns captions in with Mediabunny
  types.ts                 shared types and defaults
```

## Run it locally

```bash
git clone https://github.com/jackthecoder17/mutecap.git
cd mutecap
npm install
npm run dev
```

Open http://localhost:3000 and try one of the sample videos. The first run downloads the speech model once.

## Limits

- Best for clips up to a few minutes, since the whole video is processed in memory.
- Whisper base is fast but not perfect, especially with names, heavy accents or background music, so check the transcript before exporting.
- Export needs a browser with WebCodecs H.264 encoding: recent Chrome, Edge or Safari.

## License

MIT for this code. Whisper is MIT and Mediabunny is MPL-2.0.
