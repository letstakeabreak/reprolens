const { chromium } = require('playwright');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');

const ERROR_TEXT = 'Error 409 Conflict: Promotional coupon (SUMMER2026) cannot be combined with full loyalty point redemption.';
const ACTION_TYPES = new Set(['navigate', 'fill', 'click', 'check', 'assert_visible']);
const LOCATOR_FIELDS = ['selector', 'placeholder', 'role', 'name', 'text', 'labelText'];

// Only data is accepted. locatorStrategy is never interpreted as JavaScript.
function validateActions(actions, targetUrl) {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 50) {
    throw new TypeError('detectedActions must contain between 1 and 50 actions.');
  }
  return actions.map((action) => {
    if (!action || typeof action !== 'object' || !ACTION_TYPES.has(action.type)) {
      throw new TypeError('Unsupported reproduction action.');
    }
    const clean = { type: action.type };
    for (const key of [...LOCATOR_FIELDS, 'value', 'url']) {
      if (action[key] !== undefined) {
        if (typeof action[key] !== 'string' || action[key].length > 2000) {
          throw new TypeError(`Action ${key} must be a string of at most 2000 characters.`);
        }
        clean[key] = action[key];
      }
    }
    if (clean.type === 'navigate') {
      if (clean.url && clean.url !== targetUrl) {
        throw new TypeError('Navigation is restricted to this server\'s checkout page.');
      }
      clean.url = targetUrl;
    } else if (!LOCATOR_FIELDS.some((key) => key !== 'name' && clean[key])) {
      throw new TypeError('Actions require a structured locator, not a locatorStrategy expression.');
    }
    return clean;
  });
}

async function resolveLocator(page, action) {
  const candidates = [];
  if (action.placeholder) candidates.push(page.getByPlaceholder(action.placeholder));
  if (action.role) {
    candidates.push(page.getByRole(action.role, action.name ? { name: action.name, exact: true } : {}));
  }
  if (action.labelText) candidates.push(page.getByLabel(action.labelText, { exact: true }));
  if (action.text) candidates.push(page.getByText(action.text, { exact: action.type === 'click' }));
  if (action.selector) candidates.push(page.locator(action.selector));
  for (const candidate of candidates) {
    if (await candidate.first().isVisible()) return candidate.first();
  }
  const fallback = candidates[candidates.length - 1].first();
  await fallback.waitFor({ state: 'visible' });
  return fallback;
}

/** Replays validated actions on the local checkout; does not execute submitted code. */
async function runReproduction(actions, options = {}) {
  const targetUrl = options.targetUrl || 'http://localhost:3000/checkout';
  const steps = validateActions(actions, targetUrl);
  const timeoutMs = options.timeoutMs || 30000;
  const startTime = Date.now();
  const logs = [];
  const addLog = (message) => logs.push(`[+${((Date.now() - startTime) / 1000).toFixed(2)}s] ${message}`);
  const screenshotFilename = `reproduced_${randomUUID()}.png`;
  const screenshotPath = path.join(__dirname, '..', 'public', 'screenshots', screenshotFilename);
  let browser;
  let timer;
  let timedOut = false;
  let succeeded = false;

  try {
    addLog('Launching headless Chromium to replay validated actions...');
    browser = await chromium.launch({ headless: true, timeout: timeoutMs });
    const execute = async () => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
      // Requests and redirects are restricted to the local mock app.
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        return url.origin === new URL(targetUrl).origin ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      page.setDefaultNavigationTimeout(5000);
      page.on('dialog', (dialog) => dialog.dismiss());
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

      for (let index = 0; index < steps.length; index++) {
        if (timedOut) throw new Error('Reproduction timed out.');
        const action = steps[index];
        addLog(`[Step ${index + 1}/${steps.length}] ${action.type}`);
        if (action.type === 'navigate') {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
          continue;
        }
        const locator = await resolveLocator(page, action);
        if (action.type === 'fill') await locator.fill(action.value || '');
        if (action.type === 'click') await locator.click();
        if (action.type === 'check') await locator.check();
        if (action.type === 'assert_visible') {
          await locator.waitFor({ state: 'visible' });
          if (action.text && !(await locator.innerText()).includes(action.text)) {
            throw new Error('The requested assertion text was not found.');
          }
        }
      }

      if (page.url() !== targetUrl) throw new Error('Reproduction left the checkout page.');
      const banner = page.locator('#error-toast');
      await banner.waitFor({ state: 'visible' });
      if ((await banner.innerText()).trim() !== ERROR_TEXT || !(await page.locator('#btn-place-order').isDisabled())) {
        throw new Error('The expected 409 banner and locked checkout button were not verified.');
      }
      if (timedOut) throw new Error('Reproduction timed out.');
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      const screenshot = await page.screenshot({ path: screenshotPath, fullPage: true });
      if (timedOut) throw new Error('Reproduction timed out.');
      if (!fs.existsSync(screenshotPath) || screenshot.length < 8 || !fs.readFileSync(screenshotPath).equals(screenshot)) {
        throw new Error('A fresh reproduction screenshot was not saved.');
      }
    };
    const remainingMs = Math.max(1, timeoutMs - (Date.now() - startTime));
    await Promise.race([
      execute(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error('Reproduction timed out.'));
        }, remainingMs);
      })
    ]);
    succeeded = true;
    addLog('Status: ASSERTION PASSED (409 banner, locked button, and fresh screenshot verified)');
    return {
      success: true,
      status: 'ASSERTION_PASSED',
      durationMs: Date.now() - startTime,
      logs,
      screenshotUrl: `/screenshots/${screenshotFilename}`
    };
  } catch (err) {
    addLog(`[ERROR] ${err.message}`);
    return { success: false, status: 'FAILED', durationMs: Date.now() - startTime, logs, error: err.message };
  } finally {
    clearTimeout(timer);
    if (browser) await browser.close().catch(() => {});
    if (!succeeded) fs.rmSync(screenshotPath, { force: true });
  }
}

module.exports = { runReproduction, validateActions };
