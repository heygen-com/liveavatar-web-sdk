# LiveAvatar Background Removal Demo

Swap the background behind a HeyGen LiveAvatar in real time — transparent, solid color,
preset image, or custom image/video URL. Voice chat is enabled, so you can talk to the
avatar with your microphone while changing the backdrop.

The background change is done **entirely client-side** via canvas chroma keying on the
green-screen video stream — no extra credits, no session restart.

## Setup

From the monorepo root:

```bash
pnpm install
cp apps/bg-removal-demo/.env.example apps/bg-removal-demo/.env.local
# fill in API_KEY and defaults in apps/bg-removal-demo/.env.local
pnpm --filter bg-removal-demo dev
```

Open <http://localhost:3002>, click **Start session**, grant microphone permission, then
use the **Background** panel on the right to:

- toggle the chroma key on/off
- pick a solid color
- choose one of the preset images (put your own JPGs in `public/backgrounds/`)
- paste an image or video URL

## Environment

| Variable              | Description                                        |
| --------------------- | -------------------------------------------------- |
| `API_KEY`             | HeyGen API key (server-side only)                  |
| `API_URL`             | HeyGen API base URL                                |
| `NEXT_PUBLIC_API_URL` | Same as `API_URL` (read by the SDK in the browser) |
| `DEFAULT_AVATAR_ID`   | Default avatar ID for the start form               |
| `DEFAULT_VOICE_ID`    | Default voice ID                                   |
| `DEFAULT_CONTEXT_ID`  | Default context ID                                 |
| `DEFAULT_LANGUAGE`    | Default language code (e.g. `en`)                  |

## Preset backgrounds

The `BackgroundPicker` references four files in `public/backgrounds/`:

- `office.jpg`
- `beach.jpg`
- `gradient.jpg`
- `studio.jpg`

Drop any 16:9 JPGs in there to populate the preset thumbnails. Missing files just render
as empty placeholders — they don't break anything.

## Project structure

```
src/
  app/
    api/start-session/route.ts   # mints a session token via HeyGen API
    layout.tsx, page.tsx, globals.css
  components/
    SessionPage.tsx              # config form ↔ active session orchestrator
    ConfigForm.tsx               # avatar/voice/context/language inputs
    AvatarStage.tsx              # background + <video> + <canvas> stack
    BackgroundPicker.tsx         # transparent/color/preset/URL controls
  lib/
    chromaKey.ts                 # canvas chroma key (applyChromaKey, setupChromaKey)
    types.ts                     # BackgroundConfig, ChromaKeyOptions, defaults
  liveavatar/
    context.tsx, useSession.ts   # SDK wrapper with voiceChat: true
```

The `@heygen/liveavatar-web-sdk` dependency is wired to the workspace package at
`packages/js-sdk` via `workspace:*` — edits to the SDK source are picked up on the next
build.

## How it works

The HeyGen LiveAvatar always streams on a green background. Browsers can't see "the
avatar" vs "the green" semantically — instead, every frame is:

1. Drawn into a hidden `<canvas>`.
2. Walked pixel-by-pixel; green pixels (per HSV thresholds in `lib/chromaKey.ts`) get
   their alpha zeroed out.
3. Put back to the canvas.

The DOM stack inside `AvatarStage.tsx` then is:

```
<container>
  <bg-layer />     ← image / video / color (z-0)
  <video />        ← raw avatar stream    (z-10, hidden when chroma is on)
  <canvas />       ← processed frames     (z-20, shown when chroma is on)
</container>
```

Toggling between video and canvas is the on/off switch for the effect.
