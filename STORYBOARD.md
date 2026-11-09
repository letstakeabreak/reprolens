# ReproLens demo storyboard

## Overview

- **Target duration**: 110 seconds (`00:00` to `01:50`). Official cap is 2 minutes. Do not exceed 120 seconds.
- **Structure**: 4MAT. Why 20%, What 20%, How 40%, What if 20%.
- **On screen**: no judging-criterion labels, no unsourced percentages, no file names spoken aloud.
- **Earlier renders, not this cut**: `public/reprolens_previs_90s.mp4`, `public/reprolens_motion_previs_90s.mp4`. Shot thumbnails under `public/previs_shots/` still show the previous 90-second frames.
- **Page under test**: `public/checkout.html` only.

## Timing

| Phase | Time | Length | Share | What the viewer gets |
|---|---|---|---|---|
| Why | 00:00–00:22 | 22s | 20% | Minwoo, the clip, no statistic |
| What | 00:22–00:44 | 22s | 20% | One sentence, then one Studio screen |
| How | 00:44–01:28 | 44s | 40% | Load, frames, steps, script, headless run, red banner |
| What if | 01:28–01:50 | 22s | 20% | Keep the script, name the limit, show the repo |

## Shots

### Why (00:00–00:22)

1. **00:00–00:08. Slack.** `#customer-bugs` tells Minwoo the checkout button froze and attaches a clip. No steps.
   - Voice: "Minwoo is a frontend engineer. Every week he gets a clip like this and no steps."
2. **00:08–00:16. The clip.** Phone in a hand if a mockup is ready. Otherwise the recording full frame. Coupon, points, red banner, locked button.
   - Voice: "Coupon, points, and the button stops."
3. **00:16–00:22. The gap.** Hold the last frame. No number, no citation card.
   - Voice: "The clip never says which came first."

### What (00:22–00:44)

4. **00:22–00:32. One sentence.** "ReproLens turns that clip into a Playwright script."
5. **00:32–00:44. One screen.** Studio. Clip on the left, script on the right.
   - Voice: "This is the whole screen."

### How (00:44–01:28)

6. **00:44–00:54. Frames.** Load the sample. FFmpeg frames land in a row. Real JPEGs, not redrawn cards.
   - Voice: "Load the recording. FFmpeg splits it into frames."
7. **00:54–01:04. Six steps.** Coupon, Apply, points, Place order, red banner. Say the branch out loud.
   - Voice: "Six steps follow, from the coupon to the red banner. A vision model runs only when an API key is set. Otherwise this checkout sequence is a fixture."
8. **01:04–01:14. Script.** Four lines light up: placeholder, Apply, points, Place order. CSS fallback stays in the file, not in the voice.
   - Voice: "Those steps become a Playwright script."
9. **01:14–01:21. Run.** Headless Chromium drives `public/checkout.html`. No "100% reproduced" badge.
   - Voice: "Chromium runs it on the mock checkout."
10. **01:21–01:28. Same banner.** `frame_013.jpg` and `public/screenshots/reproduced_bug.png` share the red banner. Hold one second. This is a side-by-side look, not a pixel score.
    - Voice: "The red banner is back, and the button stays locked."

### What if (01:28–01:50)

11. **01:28–01:40. Keep and limit.** The script can sit with the bug. Today the page is one checkout form. HTML controls only. Canvas and WebGL are out.
    - Voice: "That script is what he can keep. Today this is one checkout form, HTML only."
12. **01:40–01:50. Repo.** Still card. `github.com/letstakeabreak/reprolens`. The repo is still private until someone flips it on purpose.
    - Voice: "The code is at github.com/letstakeabreak/reprolens."

## Honest lines for questions

- The red banner is UI text on the mock page, not a captured HTTP 409 from a server.
- `GEMINI_API_KEY` selects the vision model. Missing key, or a failed call, uses the checkout fixture. That branch is being wired in `engine/vision_analyzer.js` by the other pass.
- The synthesizer builds a script with string templates. Do not call it an AST.
