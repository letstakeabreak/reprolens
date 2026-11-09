const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function record() {
  const outputDir = path.join(__dirname, '..', 'public', 'sample_videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: outputDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  const filePath = path.join(__dirname, '..', 'public', 'checkout.html');
  await page.goto(`file://${filePath}`);
  await page.waitForTimeout(1000);

  // 1. Type coupon
  await page.click('#coupon-input');
  await page.type('#coupon-input', 'SUMMER2026', { delay: 100 });
  await page.waitForTimeout(600);

  // 2. Click Apply
  await page.click('#btn-apply-coupon');
  await page.waitForTimeout(800);

  // 3. Check use all points
  await page.click('#use-all-points');
  await page.waitForTimeout(800);

  // 4. Click Place Order
  await page.click('#btn-place-order');
  await page.waitForTimeout(2500);

  const video = page.video();
  const videoPath = await video.path();

  await context.close();
  await browser.close();

  const finalMp4Path = path.join(outputDir, 'sample_bug.mp4');
  console.log(`Recorded video: ${videoPath}`);
  console.log('Converting to MP4...');
  execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -pix_fmt yuv420p "${finalMp4Path}"`, { stdio: 'inherit' });
  console.log(`Saved sample bug video to ${finalMp4Path}`);
}

record().catch(err => {
  console.error(err);
  process.exit(1);
});
