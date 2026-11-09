# ReproLens: 90-Second Demo Video Director's Storyboard (콘티)

- **Total Duration**: 01:30 (90 seconds strictly)
- **Target Audience**: c0mpiled-17 Judges (James Tan / Transpose Platform, Y Combinator alumni founders & Silicon Valley VCs)
- **Tone**: Fast-paced, punchy, high-conviction, technical authenticity (zero vaporware)
- **Audio Language**: English (American accent, professional & confident pace)

---

## Cut-by-Cut Scene Breakdown

```
[00:00 - 00:18] ───> [00:18 - 00:35] ───> [00:35 - 01:05] ───> [01:05 - 01:20] ───> [01:20 - 01:30]
   Cut 1: Hook         Cut 2: Drop        Cut 3: Climax       Cut 4: Wow Match      Cut 5: Outro
 The 20% Pain        Zero-SDK Vision     Code & Execution    100% Reproduced     CI/CD Asset
```

---

### Cut 1: The Painful Hook (00:00 ~ 00:18, 18s)
- **Visual**:
  - Starts on a dark developer workspace. A Slack notification pops up on screen:
    - Channel: `#customer-bugs`
    - Sender: `Support Bot`
    - Message: *"Checkout button is frozen again. User attached an 8s video."*
  - The ambiguous 8-second video plays in a mini player: customer types a coupon, clicks checkboxes frantically, and the button hangs.
  - Camera zooms in on the developer staring at an empty terminal with a timer ticking down sprint hours.
- **On-Screen Text**:
  - `42% of Frontend Bug Tickets: "Cannot Reproduce"`
  - `20.4% of Sprint Time Wasted on Manual Guesswork`
- **Voiceover (English)**:
  > *"Every software engineer dreads this Slack message: an eight-second video of an impossible-to-reproduce bug. You scrub back and forth trying to guess what the user clicked, wasting hours of your sprint."*

---

### Cut 2: The Hero Arrival (00:18 ~ 00:35, 17s)
- **Visual**:
  - Clean transition to **ReproLens Studio** (`http://localhost:3000`).
  - Cursor effortlessly drags the raw video file and drops it into the studio player.
  - User clicks **"Analyze Video & Synthesize Playwright Spec"**.
  - Smooth animation: FFmpeg extracts 15 keyframes across a timeline reel (2fps), highlighting the exact moments of input focus, checkbox toggle, and error toast.
- **On-Screen Text**:
  - `Zero Client SDK Required`
  - `Multimodal Keyframe Decomposition (2fps)`
- **Voiceover (English)**:
  > *"Meet ReproLens. Drop the raw video recording into ReproLens Studio. No client SDKs, no browser extensions. In seconds, our multimodal vision pipeline samples keyframes at two frames per second to isolate the exact interaction sequence."*

---

### Cut 3: The Climax - Resilient Code Synthesis (00:35 ~ 01:05, 30s)
- **Visual**:
  - Split view slides open. The right panel populates with clean, syntax-highlighted Playwright TypeScript code.
  - Camera pans over the code, spotlighting:
    1. Semantic locator: `page.getByPlaceholder('Enter coupon code')`
    2. Role locator: `page.getByRole('button', { name: 'Apply' })`
    3. Label locator: `page.getByLabel('Redeem full loyalty points')`
    4. Automated CSS fallback chain (`resolveWithFallback`)
  - Cursor hits **"Run Reproduction in Headless Browser"**.
  - The live terminal console streams fast real-time execution steps (+0.32s, +0.94s, +2.08s...).
- **On-Screen Text**:
  - `AST Code Generator`
  - `Semantic Locators + Automated Fallback Chains`
- **Voiceover (English)**:
  > *"ReproLens instantly synthesizes an executable Playwright test spec. Notice the resilient semantic locators—getByPlaceholder, getByRole, and getByLabel—complete with automated fallback chains. Watch as our headless runner drives the browser through the exact user flow."*

---

### Cut 4: The Wow Resolution - 100% Reproduced (01:05 ~ 01:20, 15s)
- **Visual**:
  - Terminal logs flash: `Assertion MATCHED: Error 409 conflict state reproduced.`
  - Status pill glows vibrant green: `100% REPRODUCED`.
  - Side-by-side comparison box highlights:
    - Left: Raw video screenshot of the red 409 Conflict toast.
    - Right: Automated browser screenshot captured 3.2 seconds later with the identical error toast and frozen spinner.
- **On-Screen Text**:
  - `Execution Time: 3.21 Seconds`
  - `100% Visual & State Reproduction`
- **Voiceover (English)**:
  > *"In just 3.2 seconds, the bug is reproduced with a 100% visual and state match. The identical Error 409 Conflict toast appears, captured and verified automatically."*

---

### Cut 5: The Outro & Big Vision (01:20 ~ 01:30, 10s)
- **Visual**:
  - Smooth zoom out showing the test code being pushed directly to the GitHub repository as a permanent regression test asset.
  - Clean title card appears with ReproLens logo, GitHub URL, and team credits.
- **On-Screen Text**:
  - `ReproLens: Turn Bug Videos into CI/CD Regression Assets`
  - `github.com/letstakeabreak/reprolens`
  - `c0mpiled-17: Seoul`
- **Voiceover (English)**:
  > *"No SDKs in production. No guesswork. Turn every vague user bug report into an instant regression test asset. This is ReproLens."*

---

## Production Checklist

- [x] Storyboard approved (01:30 runtime)
- [x] Previs interactive player built (`/previs`)
- [x] Web Speech API / TTS narration track synced
- [x] 1440x900 walkthrough capture ready
- [x] Final Loom / YouTube recording ready for 1:30 PM submission
