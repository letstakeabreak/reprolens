const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function recordStudioDemo() {
  const outputDir = path.join(__dirname, '..', 'public', 'demo_recordings');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Launching browser to record studio demo walkthrough...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1440, height: 900 }
    }
  });

  const page = await context.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 1. Play the sample bug video on the left
  console.log('Playing sample bug video...');
  await page.evaluate(() => {
    const video = document.getElementById('bug-video');
    if (video) video.play();
  });
  await page.waitForTimeout(7500);

  // 2. Click Analyze Video & Synthesize Playwright Spec
  console.log('Clicking analyze and synthesize button...');
  await page.click('#btn-analyze');
  await page.waitForTimeout(3000);

  // 3. Scroll through frames reel smoothly
  console.log('Inspecting extracted keyframes reel...');
  await page.evaluate(() => {
    const reel = document.getElementById('reel-container');
    if (reel) reel.scrollTo({ left: 300, behavior: 'smooth' });
  });
  await page.waitForTimeout(1500);

  // 4. Click Run Reproduction in Headless Browser
  console.log('Running headless reproduction test...');
  await page.click('#btn-run-test');
  await page.waitForTimeout(4500);

  // 5. Highlight the reproduced comparison result
  console.log('Displaying verified 100% reproduction result...');
  await page.waitForTimeout(3000);

  const video = page.video();
  const videoPath = await video.path();

  await context.close();
  await browser.close();

  const finalMp4Path = path.join(__dirname, '..', 'public', 'reprolens_demo_walkthrough.mp4');
  console.log(`Converting walkthrough video ${videoPath} to MP4...`);
  execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p "${finalMp4Path}"`, { stdio: 'inherit' });
  console.log(`Saved clean demo walkthrough to ${finalMp4Path}`);
}

recordStudioDemo().catch(err => {
  console.error(err);
  process.exit(1);
});
