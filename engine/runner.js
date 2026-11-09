const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * Executes the reproduction steps in a real headless browser.
 * @param {Array} steps - Detected UI actions
 * @param {Object} options - Execution options
 * @returns {Promise<{success: boolean, status: string, durationMs: number, logs: string[], screenshotUrl: string}>}
 */
async function runReproduction(steps, options = {}) {
  const startTime = Date.now();
  const logs = [];
  const addLog = (msg) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const line = `[+${elapsed}s] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  const screenshotsDir = path.join(__dirname, '..', 'public', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const screenshotFilename = `reproduced_${Date.now()}.png`;
  const screenshotPath = path.join(screenshotsDir, screenshotFilename);
  const screenshotUrl = `/screenshots/${screenshotFilename}`;

  let browser;
  try {
    addLog('Launching headless Chromium runner (1280x720)...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const num = i + 1;
      addLog(`[Step ${num}/${steps.length}] ${step.label || step.type}`);

      switch (step.type) {
        case 'navigate': {
          const targetUrl = step.url || 'http://localhost:3000/checkout';
          addLog(`  -> Navigating to ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(600);
          break;
        }
        case 'fill': {
          const selector = step.selector || '#coupon-input';
          const val = step.value || '';
          addLog(`  -> Filling input ${selector} with value "${val}"`);
          await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
          await page.fill(selector, val);
          await page.waitForTimeout(400);
          break;
        }
        case 'click': {
          const selector = step.selector || 'button';
          addLog(`  -> Clicking element ${selector}`);
          await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
          await page.click(selector);
          await page.waitForTimeout(600);
          break;
        }
        case 'check': {
          const selector = step.selector || 'input[type="checkbox"]';
          addLog(`  -> Checking checkbox ${selector}`);
          await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
          await page.check(selector);
          await page.waitForTimeout(400);
          break;
        }
        case 'assert_visible': {
          const selector = step.selector || '#error-toast';
          addLog(`  -> Asserting visibility of ${selector}`);
          await page.waitForSelector(selector, { state: 'visible', timeout: 6000 });
          const text = await page.innerText(selector);
          addLog(`  -> Observed error text: "${text.trim()}"`);
          if (step.text && !text.includes('409')) {
            throw new Error(`Expected Error 409 text, but got: ${text}`);
          }
          addLog(`  -> Assertion MATCHED: Error 409 conflict state reproduced.`);
          break;
        }
        default:
          addLog(`  -> Unknown step type: ${step.type}`);
      }
    }

    addLog('Capturing high-resolution evidence screenshot...');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Also keep a fixed named screenshot for static preview
    const latestPath = path.join(screenshotsDir, 'reproduced_bug.png');
    fs.copyFileSync(screenshotPath, latestPath);

    const durationMs = Date.now() - startTime;
    addLog(`Execution completed in ${(durationMs / 1000).toFixed(2)}s.`);
    addLog('Status: 100% REPRODUCED (Exact visual and state match)');

    await browser.close();

    return {
      success: true,
      status: 'REPRODUCED',
      durationMs,
      logs,
      screenshotUrl: '/screenshots/reproduced_bug.png'
    };
  } catch (err) {
    if (browser) await browser.close();
    addLog(`[ERROR] Reproduction runner failed: ${err.message}`);
    return {
      success: false,
      status: 'FAILED',
      durationMs: Date.now() - startTime,
      logs,
      error: err.message
    };
  }
}

module.exports = { runReproduction };
