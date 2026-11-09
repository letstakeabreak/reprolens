# ReproLens

> Turn a short bug screen recording into a Playwright script you can run locally. Built for **c0mpiled-17: Seoul**. The event uses the YC RFS Fall 2026 theme list. This project does not claim a closest-fit theme.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33.svg)](https://playwright.dev)

---

## The problem

A teammate drops a few seconds of screen recording into chat and writes one line: "the checkout button froze." The person who has to fix it, here a frontend engineer named Minwoo, cannot see the order of clicks. Coupon first, or points first. The clip does not say.

---

## What ReproLens does

The demo runs against one mock checkout page, `public/checkout.html`.

1. **Load a recording.** The studio plays the included sample. A video file can be sent to the extract endpoint. No SDK is added to the page under test.
2. **Sample frames.** FFmpeg writes JPEG frames at 2 fps.
3. **Actions.** If `GEMINI_API_KEY` is set, the vision step sends frames to the model. If it is not set, or the call fails, the action list is a fixed checkout fixture. Another pass is wiring that branch. This document describes that behavior.
4. **Script.** The synthesizer turns the action list into a Playwright script with semantic locators (`getByPlaceholder`, `getByRole`, `getByText`) and a CSS fallback.
5. **Run.** Headless Chromium replays the validated action list against the mock checkout. Success requires the exact 409 banner, a disabled order button, and a new screenshot saved for that run. The execution API does not accept JavaScript code or evaluate locator expressions.

```
[Sample bug video]
        |
        v  FFmpeg, 2 fps
[JPEG frames]
        |
        v  vision model if GEMINI_API_KEY is set, otherwise checkout fixture
[Action list] ---- synthesizer.js ----> [Playwright script for local export]
        |
        v  validated replay in headless Chromium, public/checkout.html
[Screenshot of the red error banner]
```

---

## Limits

- One mock app in this demo: `public/checkout.html`.
- The flow is for ordinary HTML controls. Canvas and WebGL are not supported.
- FFmpeg must be installed (`brew install ffmpeg`).
- A real vision pass needs `GEMINI_API_KEY`. Without it, the checkout fixture is used.
- The server binds to `127.0.0.1` and rejects other hosts and cross-origin requests. It is a local tool. CLI requests without an Origin header are allowed.
- Web reproduction runs have a 30-second limit and accept only structured actions targeting this checkout. Generated scripts remain available for local export.

---

## Layout

```
├── engine/
│   ├── frame_extractor.js
│   ├── vision_analyzer.js
│   ├── synthesizer.js
│   ├── runner.js
│   └── test_synthesizer.js
├── public/
│   ├── index.html
│   ├── checkout.html
│   ├── previs.html
│   ├── spec.html
│   ├── sample_videos/
│   ├── screenshots/
│   └── extracted_frames/
├── scripts/
│   └── record_bug_video.js
├── server.js
├── STORYBOARD.md
├── SUBMISSION.md
└── LICENSE
```

---

## Getting started

Node.js 20 or newer, and FFmpeg.

```bash
git clone https://github.com/letstakeabreak/reprolens.git
cd reprolens
npm install
npx playwright install chromium
node server.js
```

1. Studio: [http://localhost:3000](http://localhost:3000)
2. Mock checkout: [http://localhost:3000/checkout](http://localhost:3000/checkout)
3. Analyze the sample recording.
4. Run the reproduction. Chromium opens the mock checkout and stops on the red error banner.

```bash
npm test
env -u GEMINI_API_KEY node engine/test_synthesizer.js
```

`npm test` checks the API boundary, rejected executable payloads, real Chromium reproduction, false success cases, screenshot failures, and timeout cleanup. The separate synthesizer suite checks code generation, semantic locators, the CSS fallback, and screenshot saving.

---

## Demo length

The submission video must be 2 minutes or less. The storyboard in `STORYBOARD.md` and `public/previs.html` targets 110 seconds.

---

## License

MIT. See [LICENSE](LICENSE). Copyright 2026 letstakeabreak.
