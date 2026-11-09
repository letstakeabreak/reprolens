# c0mpiled-17 Submission Package: ReproLens

- **Event**: c0mpiled-17: Seoul
- **Theme**: YC RFS Fall 2026 theme list. No closest-fit theme is claimed.
- **GitHub**: https://github.com/letstakeabreak/reprolens
- **Video rule**: 2 minutes or less. Loom or YouTube is the recommended host. This script targets 110 seconds and stays under 120.
- **Build window**: ends 15:00 KST. Form clock is unconfirmed. Do not treat 1:30 PM as the deadline.
- **Judging**: 15:00 to 17:00 KST. A live demo in that window is optional.
- **Commits**: commits before the 10:00 KST build start are ineligible. The first commit on this repo is 10:33 KST.

---

## 1. Form text

### One sentence

ReproLens turns a short bug recording of one checkout page into a Playwright script and runs it.

### Short description

Minwoo gets a few seconds of screen recording and one sentence: the checkout button froze. He cannot tell whether the coupon or the points came first.

ReproLens plays that clip, samples frames with FFmpeg, and writes a Playwright script with semantic locators and a CSS fallback. Headless Chromium runs the script against a mock checkout page and stops on the red error banner.

The vision step calls a model only when `GEMINI_API_KEY` is set. Otherwise it uses a fixed sequence for this checkout. The demo is that one page, `public/checkout.html`. Ordinary HTML controls only. Canvas and WebGL are out of scope.

---

## 2. Demo script (110 seconds, 4MAT)

| Time | Share | Visual | Voice |
|---|---|---|---|
| 00:00–00:22 | Why 20% | Slack to Minwoo, then the 7.3s clip. Coupon, points, red banner, locked button. No statistic on screen. | "Minwoo is a frontend engineer. Every week he gets a clip like this and no steps. Coupon, points, and the button stops. The clip never says which came first." |
| 00:22–00:44 | What 20% | One sentence, then the Studio screen with the clip on the left and the script on the right. | "ReproLens turns that clip into a Playwright script. This is the whole screen." |
| 00:44–01:28 | How 40% | Upload or load the sample, frames at 2 fps, six steps, the generated script, headless run, red banner beside frame 13. | "Load the recording. FFmpeg splits it into frames. Six steps follow, from the coupon to the red banner. A vision model runs only when an API key is set. Otherwise this checkout sequence is a fixture. Those steps become a Playwright script. Chromium runs it on the mock checkout. The red banner is back, and the button stays locked." |
| 01:28–01:50 | What if 20% | One line on keeping the script, then the limit, then the repo URL. | "That script is what he can keep. Today this is one checkout form, HTML only. The code is at github.com/letstakeabreak/reprolens." |

Spoken length is about half the 110 seconds. The rest is the screen.

---

## 3. Checklist

- [x] Studio at `http://localhost:3000`
- [x] Mock checkout at `http://localhost:3000/checkout`
- [x] GitHub repo exists: `https://github.com/letstakeabreak/reprolens` (still private; do not flip visibility from this pass)
- [x] `node engine/test_synthesizer.js` was reported passing earlier in the day. This docs pass did not re-run it.
- [ ] Submission video, 2 minutes or less, on Loom or YouTube. The 110-second script above is not rendered yet. Files named `reprolens_previs_90s.mp4` and `reprolens_motion_previs_90s.mp4` are earlier cuts.
- [ ] Public GitHub URL on the form. Visibility change is waiting on a separate decision.
- [ ] Form submit. Clock unconfirmed. Build ends 15:00 KST.
