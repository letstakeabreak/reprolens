// Records the reproduction run used in state 4 of /motion.
// Runs the four synthesized lines against http://localhost:3000/checkout in headless
// Chromium at the same 1280x720 viewport as the customer clip, with a visible cursor
// overlay so each click can be seen. Actions are scheduled at fixed clip times so the
// motion timeline can light each code line exactly when its click happens.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Clip seconds at which each action fires (fill starts typing, others click).
const ACTION_TIMES = [3, 11, 19, 27];
const CLIP_END = 34;

async function main() {
  const rootDir = path.join(__dirname, '..');
  const outDir = path.join(rootDir, 'public', 'demo_recordings');
  const tempDir = path.join(rootDir, 'temp', 'repro_record');
  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } }
  });

  // Cursor overlay so mouse moves and clicks are visible in the recording.
  await context.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const c = document.createElement('div');
      c.id = '__cursor';
      c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
        'background:rgba(29,29,31,0.85);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
        'z-index:99999;pointer-events:none;transition:transform 0.12s ease;transform:translate(640px,360px);';
      document.body.appendChild(c);
      let x = 640, y = 360;
      document.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; c.style.transform = `translate(${x}px,${y}px)`; }, true);
      document.addEventListener('mousedown', () => { c.style.transform = `translate(${x}px,${y}px) scale(0.7)`; }, true);
      document.addEventListener('mouseup', () => { c.style.transform = `translate(${x}px,${y}px)`; }, true);
    });
  });

  const tPageCreated = Date.now();
  const page = await context.newPage();
  await page.goto('http://localhost:3000/checkout', { waitUntil: 'networkidle' });
  const tClipStart = Date.now();
  const clipOffset = (tClipStart - tPageCreated) / 1000;

  const waitUntilClip = async (sec) => {
    const target = tClipStart + sec * 1000;
    const ms = target - Date.now();
    if (ms > 0) await page.waitForTimeout(ms);
  };

  const moveTo = async (locator) => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    const x = box.x + Math.min(box.width / 2, 60);
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y, { steps: 18 });
    return { x, y };
  };

  const log = [];
  const coupon = page.getByPlaceholder('Enter coupon code');
  const apply = page.getByRole('button', { name: 'Apply' });
  const points = page.getByRole('checkbox');
  const placeOrder = page.getByRole('button', { name: 'Place Order' });

  // 1. fill coupon
  await waitUntilClip(ACTION_TIMES[0] - 1.0);
  await moveTo(coupon);
  await waitUntilClip(ACTION_TIMES[0]);
  log.push({ step: 1, at: (Date.now() - tClipStart) / 1000 });
  await page.mouse.down(); await page.mouse.up();
  await coupon.pressSequentially('SUMMER2026', { delay: 90 });

  // 2. click Apply
  await waitUntilClip(ACTION_TIMES[1] - 1.0);
  await moveTo(apply);
  await waitUntilClip(ACTION_TIMES[1]);
  log.push({ step: 2, at: (Date.now() - tClipStart) / 1000 });
  await page.mouse.down(); await page.mouse.up();

  // 3. check loyalty points
  await waitUntilClip(ACTION_TIMES[2] - 1.0);
  await moveTo(points);
  await waitUntilClip(ACTION_TIMES[2]);
  log.push({ step: 3, at: (Date.now() - tClipStart) / 1000 });
  await page.mouse.down(); await page.mouse.up();

  // 4. click Place Order
  await waitUntilClip(ACTION_TIMES[3] - 1.0);
  await moveTo(placeOrder);
  await waitUntilClip(ACTION_TIMES[3]);
  log.push({ step: 4, at: (Date.now() - tClipStart) / 1000 });
  await page.mouse.down(); await page.mouse.up();

  // Same final scroll as the customer clip so the two frames can be overlaid.
  await page.waitForTimeout(400);
  const alertVisible = await page.getByRole('alert').isVisible();
  await waitUntilClip(CLIP_END);
  await page.evaluate(() => { const c = document.getElementById('__cursor'); if (c) c.style.display = 'none'; });
  await page.screenshot({ path: path.join(outDir, 'repro_final.png') });

  const rawPath = await page.video().path();
  await context.close();
  await browser.close();

  const mp4 = path.join(outDir, 'repro_run.mp4');
  execSync(`ffmpeg -y -v error -ss ${clipOffset.toFixed(3)} -i "${rawPath}" -t ${CLIP_END} -c:v libx264 -pix_fmt yuv420p -r 30 -an "${mp4}"`, { stdio: 'inherit' });

  const meta = { clipOffset, actions: log, alertVisible, clipEnd: CLIP_END };
  fs.writeFileSync(path.join(outDir, 'repro_run.json'), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta, null, 2));
  if (!alertVisible) {
    console.error('409 alert did not appear. The run did not reproduce the bug.');
    process.exit(2);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
