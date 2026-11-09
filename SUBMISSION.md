# c0mpiled-17 Submission Package: ReproLens

- **Event**: c0mpiled-17: Seoul
- **Track**: Developer Productivity & AI-Native Quality Engineering (Y Combinator RFS)
- **GitHub Repository**: https://github.com/letstakeabreak/reprolens
- **Target Submission Form Time**: 1:30 PM KST

---

## 1. Short Project Description (For Google Form)

### One-Sentence Pitch
> **ReproLens turns ambiguous 10-second user bug screen recordings into executable, self-contained Playwright test specs in seconds.**

### Short Description (Form Text)
Software engineers waste over 20.4% of sprint time manually guessing and recreating bug reports sent as vague chat recordings ("the checkout button froze"). ReproLens eliminates reproduction guesswork with zero client-side instrumentation: simply drop a 10-second video into the dashboard. 

Our multimodal vision pipeline samples keyframes at 2fps, reconstructs the precise user interaction timeline, and synthesizes a production-grade Playwright E2E test script (`.spec.js`) equipped with resilient semantic locators (`getByPlaceholder`, `getByRole`, `getByText`) and fallback chains. A built-in headless Chromium runner then drives the browser through the exact user sequence to recreate the bug and capture screenshot evidence in under 4 seconds. No SDK required, zero guesswork, instant regression assets.

---

## 2. 90-Second English Demo Video Script

| Timecode | Visual Screen Action | Voiceover Script (English) |
| :--- | :--- | :--- |
| **00:00 - 00:18** | Zoom into Slack showing an ambiguous 7-second user clip: "Checkout button is dead." | *"Every software engineer dreads this Slack message: an 8-second video of an impossible-to-reproduce bug, eating up hours of your sprint trying to guess what the user clicked."* |
| **00:18 - 00:35** | Open ReproLens Studio. Show the video loaded. Click "Analyze Video & Synthesize Playwright Spec". | *"Meet ReproLens. Drop the raw video recording into ReproLens Studio. In seconds, our multimodal vision pipeline breaks down keyframes at 2 frames per second to track every input, click, and UI state transition."* |
| **00:35 - 01:05** | Right column reveals synthesized Playwright code. Highlight semantic locators. Click "Run Reproduction in Headless Browser". Terminal streams live logs. | *"ReproLens instantly synthesizes an executable, self-contained Playwright test spec. Notice the resilient semantic locators—getByPlaceholder, getByRole, and getByLabel—with automated fallback chains. Watch as our headless runner drives the browser to recreate the exact sequence."* |
| **01:05 - 01:30** | Green status badge "100% Reproduced" turns on. Side-by-side comparison shows the exact red Error 409 Conflict toast and frozen button. | *"In just 3.2 seconds, the bug is reproduced with a 100% visual and state match. No SDKs bundled into production. No guesswork. Turn every user bug report into an instant regression test asset. This is ReproLens."* |

---

## 3. Checklist for 1:30 PM Form

- [x] Working Web App: ReproLens Studio running locally at `http://localhost:3000`
- [x] Target Checkout App with reproducible Error 409 bug at `http://localhost:3000/checkout`
- [x] GitHub Repository created & pushed: `https://github.com/letstakeabreak/reprolens`
- [x] Synthesizer unit and end-to-end test suite verified (`node engine/test_synthesizer.js` passing 4/4)
- [x] High-resolution demo walkthrough video generated (`public/reprolens_demo_walkthrough.mp4`)
- [ ] Make repository public via `gh repo edit --visibility public` when ready to submit at 1:30 PM.
