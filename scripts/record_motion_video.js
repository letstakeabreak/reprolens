// Records /motion as a 1920x1080 video and muxes the narration.
// The page runs in record mode (no player bar, stage scaled 1.5x to fill the frame).
// Playwright starts recording when the page is created, so the lead-in before play()
// is measured and trimmed off. That keeps the picture in sync with the narration.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const DURATION = 106;

async function recordMotionVideo() {
  const rootDir = path.join(__dirname, '..');
  const tempDir = path.join(rootDir, 'temp', 'motion_record');
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: tempDir, size: { width: 1920, height: 1080 } }
  });

  const tPageCreated = Date.now();
  const page = await context.newPage();
  await page.goto('http://localhost:3000/motion?record=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(500);

  const playEpoch = await page.evaluate(() => { window.play(); return window.__playStartEpoch; });
  const leadIn = (playEpoch - tPageCreated) / 1000;
  console.log(`Playing. Lead-in to trim: ${leadIn.toFixed(3)}s. Recording ${DURATION}s...`);

  await page.waitForTimeout(DURATION * 1000 + 1500);

  const rawVideoPath = await page.video().path();
  await context.close();
  await browser.close();

  const finalMp4Path = path.join(rootDir, 'public', 'reprolens_motion.mp4');
  const audioPath = path.join(rootDir, 'public', 'motion_audio.m4a');

  execSync(
    `ffmpeg -y -v error -ss ${leadIn.toFixed(3)} -i "${rawVideoPath}" -i "${audioPath}" ` +
    `-map 0:v -map 1:a -t ${DURATION} -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 25 ` +
    `-c:a aac -b:a 160k -movflags +faststart "${finalMp4Path}"`,
    { stdio: 'inherit' }
  );

  console.log(`Wrote ${finalMp4Path}`);
}

recordMotionVideo().catch((err) => {
  console.error(err);
  process.exit(1);
});
