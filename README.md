# ConvertFlow Desktop

Advanced media converter desktop app — the paid $9.99 Pro version of ConvertFlow.

## Tech Stack

- **Electron** — Desktop wrapper
- **React + TypeScript** — UI
- **Vite** — Dev server and bundler
- **Tailwind CSS** — Styling
- **FFmpeg** — Local media processing (system install or bundled)

---

## Requirements

- Node.js 18+
- FFmpeg installed on your system PATH (for development)
  - macOS: `brew install ffmpeg`
  - Windows: Download from https://ffmpeg.org/download.html and add to PATH
  - Linux: `sudo apt install ffmpeg`

---

## Installation

```bash
npm install
```

---

## Running in Development

### Web only (no Electron)
```bash
npm run dev
```
Opens at http://localhost:5173 in your browser. FFmpeg features won't work without Electron.

### Full Electron app (development)
```bash
npm run dev:electron
```
Starts Vite dev server then launches Electron pointing to it.

---

## Building the App

### Build web assets only
```bash
npm run build
```

### Package as desktop app (current platform)
```bash
npm run build:electron
```

### Package for specific platforms
```bash
npm run build:win     # Windows .exe (NSIS installer)
npm run build:mac     # macOS .dmg
npm run build:linux   # Linux .AppImage
```

Output goes to `dist-electron/`.

---

## Supported formats

All conversion is done locally by FFmpeg.

| Type | Input | Output |
|------|-------|--------|
| Video | MP4, MOV, AVI, MKV, WEBM, M4V, FLV, WMV, GIF | MP4, MOV, AVI, MKV, WEBM, GIF |
| Audio | MP3, WAV, FLAC, AAC, M4A, OGG, OPUS, WMA | MP3, WAV, FLAC, AAC, M4A, OGG |
| Image | PNG, JPG, WEBP, BMP, TIFF, ICO | PNG, JPG, WEBP, BMP, TIFF, ICO (first frame; ICO is capped at 256x256) |

Document conversion (PDF, DOCX, RTF, TXT) is **not** implemented. It needs a separate engine such as LibreOffice or Pandoc and is outside the current media-converter scope.

Converted files are never written over existing files: if `name.mp3` exists, the result is saved as `name (1).mp3`. Output is written to a temporary file first and only moved into place when FFmpeg succeeds, so failed or cancelled jobs leave nothing behind.

## Tests

```bash
npm test          # FFmpeg runner tests (needs ffmpeg on PATH)
npm run typecheck
npm run lint
```

---

## Bundling FFmpeg

For production builds, bundle FFmpeg binaries so users don't need to install it:

1. Create `resources/ffmpeg/` directory
2. Download FFmpeg static builds for your target platform(s)
3. Place `ffmpeg` (or `ffmpeg.exe`) inside that folder
4. `electron-builder` will copy them via `extraResources` config in `package.json`

---

## Stripe + Supabase payment deployment

The desktop renderer contains only the public Supabase URL and anon key. Stripe secret keys, webhook secrets, and the Supabase service-role key stay in Supabase Edge Function secrets.

1. Create a Stripe Product and Price (one-time or recurring), then apply the SQL migrations: `supabase db push`.
2. Set Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, and optionally `STRIPE_MODE=subscription` (the default is a one-time payment). Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions.
3. Deploy the functions: `supabase functions deploy create-checkout`, `activate-license`, `stripe-webhook`, and `checkout-success`.
4. In Stripe, create a webhook endpoint at `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`. Subscribe to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`; save its signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Put only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, then rebuild the desktop app.

On successful payment, the webhook creates the entitlement. The Stripe success page displays a deterministic license code after webhook confirmation; the user pastes it into the app. Entitlement tables have no public RLS policies and cannot be changed with the anon key.

The development-only key `CONVERTFLOW-TEST-9999` works only in a Vite development build.

---

## File Structure

```
├── electron/
│   ├── main.cjs          # Electron main process (window, IPC, settings, dialogs)
│   ├── ffmpeg-runner.cjs # Validated, cancellable FFmpeg job runner (unit tested)
│   └── preload.cjs       # Context bridge (exposes electronAPI to renderer)
├── src/
│   ├── components/
│   │   ├── TitleBar.tsx      # Custom title bar with window controls
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   └── ActivationGate.tsx # Lock screen for unlicensed users
│   ├── pages/
│   │   ├── Home.tsx          # Dashboard
│   │   ├── Converter.tsx     # Advanced file converter
│   │   ├── BatchConverter.tsx # Batch queue
│   │   ├── AIEnhancer.tsx    # AI-assisted local enhancement
│   │   ├── CompressionTool.tsx # File compression
│   │   ├── AudioExtractor.tsx # Audio extraction from video
│   │   ├── License.tsx       # License activation
│   │   └── Settings.tsx      # App settings
│   ├── lib/
│   │   ├── electron.ts       # Electron bridge + type definitions
│   │   ├── ffmpeg.ts         # FFmpeg arg builders and utilities
│   │   └── license.ts        # License validation and storage
│   ├── App.tsx               # Root component + routing
│   ├── types.ts              # Shared types
│   └── main.tsx              # React entry point
├── resources/
│   └── ffmpeg/               # Place FFmpeg binaries here for packaging
└── public/
    └── logo.png              # App icon
```

---

## Notes

- All media processing is 100% local — no files are uploaded anywhere
- Hardware acceleration toggle in Settings enables GPU encoding via FFmpeg `-hwaccel` flags (requires compatible GPU + FFmpeg build)
- The AI Enhancer uses real FFmpeg filter chains (hqdn3d, unsharp, eq, anlmdn) labeled as "AI-assisted local processing"
- Cross-platform builds from macOS require Docker or a CI service for Windows/Linux targets
