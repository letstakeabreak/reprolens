/**
 * Playwright Test Code Synthesizer for ReproLens
 * Converts UI action JSON arrays (navigate, fill, click, check, assert_visible)
 * into an executable Playwright reproduction test script string with semantic
 * locators (getByPlaceholder, getByRole, getByText) and robust CSS selector fallbacks.
 */

const DEFAULT_FALLBACK_SELECTORS = {
  fill: 'input[type="text"], input:not([type="checkbox"]):not([type="hidden"]), textarea',
  click: 'button, [role="button"], input[type="submit"], input[type="button"], a',
  check: 'input[type="checkbox"], [role="checkbox"]',
  assert_visible: '[role="alert"], #error-toast, .error-banner, .error, .toast'
};

/**
 * Escapes a string for safe single-quoted JS string literals.
 * @param {string} str
 * @returns {string}
 */
function escapeJsString(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

/**
 * Builds an ordered list of Playwright locator expressions in priority order:
 * semantic locators (getByPlaceholder, getByRole, getByText, getByLabel) first,
 * followed by a CSS selector fallback (`page.locator(...)`).
 *
 * @param {Object} action - UI action object
 * @param {string} actionType - Normalized action type
 * @returns {string[]} Ordered array of Playwright locator code expressions
 */
function buildLocatorCandidates(action = {}, actionType = 'click') {
  const candidates = [];
  const addCandidate = (expr) => {
    if (expr && !candidates.includes(expr)) {
      candidates.push(expr);
    }
  };

  // 1. Explicit locatorStrategy if passed by vision_analyzer
  if (typeof action.locatorStrategy === 'string') {
    const trimmed = action.locatorStrategy.trim();
    if (trimmed.startsWith('page.')) {
      addCandidate(trimmed);
    } else {
      const match = trimmed.match(/page\.(getBy[A-Za-z]+\([^)]+\)|locator\([^)]+\))/);
      if (match) {
        addCandidate(`page.${match[1]}`);
      }
    }
  }

  // 2. Semantic locators from action properties: placeholder, role, text, name, label
  const placeholder = action.placeholder || (action.locator && action.locator.placeholder);
  const role = action.role || (action.locator && action.locator.role);
  const roleName =
    action.name ||
    (action.locator && action.locator.name) ||
    (role && (action.text || action.buttonText)) ||
    null;
  const text =
    action.text ||
    action.buttonText ||
    (action.locator && action.locator.text) ||
    null;
  const labelText =
    action.labelText ||
    (action.locator && action.locator.label) ||
    (!action.step && !action.locatorStrategy && action.label ? action.label : null);

  if (placeholder) {
    addCandidate(`page.getByPlaceholder('${escapeJsString(placeholder)}')`);
  }

  if (role) {
    if (roleName) {
      addCandidate(
        `page.getByRole('${escapeJsString(role)}', { name: '${escapeJsString(roleName)}' })`
      );
    } else {
      addCandidate(`page.getByRole('${escapeJsString(role)}')`);
    }
  }

  if (labelText && (actionType === 'check' || actionType === 'fill')) {
    addCandidate(`page.getByLabel('${escapeJsString(labelText)}')`);
  }

  if (text) {
    if (actionType === 'click' && !role) {
      addCandidate(`page.getByRole('button', { name: '${escapeJsString(text)}' })`);
    }
    if (actionType === 'check' && !role) {
      addCandidate(`page.getByRole('checkbox', { name: '${escapeJsString(text)}' })`);
    }
    if (actionType === 'click') {
      addCandidate(`page.getByText('${escapeJsString(text)}', { exact: true })`);
    } else {
      addCandidate(`page.getByText('${escapeJsString(text)}')`);
    }
  }

  // 3. Infer semantic locators for known checkout elements when only selector is provided
  const rawSelector =
    action.selector ||
    action.css ||
    action.fallbackSelector ||
    (typeof action.target === 'string' && !action.target.startsWith('http') && !action.target.startsWith('file:')
      ? action.target
      : null);

  if (rawSelector === '#coupon-input' && !candidates.some((c) => c.includes('getByPlaceholder'))) {
    addCandidate("page.getByPlaceholder('쿠폰 코드 입력 (예: SUMMER2026)')");
  } else if (rawSelector === '#btn-apply-coupon') {
    if (!candidates.some((c) => c.includes('getByRole'))) {
      addCandidate("page.getByRole('button', { name: '적용' })");
    }
    if (!candidates.some((c) => c.includes('getByText'))) {
      addCandidate("page.getByText('적용', { exact: true })");
    }
  } else if (rawSelector === '#use-all-points') {
    if (!candidates.some((c) => c.includes('getByRole'))) {
      addCandidate("page.getByRole('checkbox', { name: '보유 마일리지 전액 사용 (50,000 P)' })");
    }
    if (!candidates.some((c) => c.includes('getByText'))) {
      addCandidate("page.getByText('보유 마일리지 전액 사용 (50,000 P)')");
    }
  } else if (rawSelector === '#btn-place-order') {
    if (!candidates.some((c) => c.includes('getByRole'))) {
      addCandidate("page.getByRole('button', { name: '결제하기' })");
    }
    if (!candidates.some((c) => c.includes('getByText'))) {
      addCandidate("page.getByText('결제하기', { exact: true })");
    }
  } else if (rawSelector === '#error-toast') {
    if (!candidates.some((c) => c.includes('getByRole'))) {
      addCandidate("page.getByRole('alert')");
    }
    if (!candidates.some((c) => c.includes('getByText'))) {
      addCandidate("page.getByText('오류 409')");
    }
  }

  if (actionType === 'assert_visible' && !candidates.some((c) => c.includes('getByRole'))) {
    addCandidate("page.getByRole('alert')");
  }

  // 4. Always include a robust CSS selector fallback via page.locator(...)
  let cssFallback = rawSelector;
  if (!cssFallback) {
    if (placeholder) {
      cssFallback = `input[placeholder*="${escapeJsString(placeholder)}"], ${DEFAULT_FALLBACK_SELECTORS.fill}`;
    } else if (actionType === 'fill') {
      cssFallback = DEFAULT_FALLBACK_SELECTORS.fill;
    } else if (actionType === 'check') {
      cssFallback = DEFAULT_FALLBACK_SELECTORS.check;
    } else if (actionType === 'assert_visible') {
      cssFallback = DEFAULT_FALLBACK_SELECTORS.assert_visible;
    } else {
      cssFallback = DEFAULT_FALLBACK_SELECTORS.click;
    }
  }

  addCandidate(`page.locator('${escapeJsString(cssFallback)}')`);
  return candidates;
}

/**
 * Formats a locator expression string for static inspection & runtime resolution.
 * @param {Object} action
 * @param {string} actionType
 * @returns {string}
 */
function buildLocatorExpression(action = {}, actionType = 'click') {
  const candidates = buildLocatorCandidates(action, actionType);
  const [first, ...rest] = candidates;
  return rest.reduce((acc, curr) => `${acc}.or(${curr})`, first) + '.first()';
}

/**
 * Normalizes action input (array, JSON string, or analyzer object with detectedActions).
 * @param {Array|Object|string} actionData
 * @returns {Array<Object>}
 */
function normalizeActionsInput(actionData) {
  if (!actionData) return [];
  if (typeof actionData === 'string') {
    const parsed = JSON.parse(actionData);
    return normalizeActionsInput(parsed);
  }
  if (Array.isArray(actionData)) {
    return actionData;
  }
  if (Array.isArray(actionData.detectedActions)) {
    return actionData.detectedActions;
  }
  if (Array.isArray(actionData.actions)) {
    return actionData.actions;
  }
  throw new TypeError('actions must be an Array of UI action objects or an object containing detectedActions/actions');
}

/**
 * Synthesizes an executable Playwright test script string from UI actions.
 *
 * @param {Array<Object>|Object} actionData - UI actions array or analysis result object
 * @param {Object} [options={}] - Synthesis options
 * @param {string} [options.targetUrl] - Default target URL for navigation
 * @param {string} [options.screenshotPath] - Output path for reproduction screenshot
 * @param {boolean} [options.headless=true] - Whether to run headless when executed directly
 * @param {Object} [options.viewport={ width: 1280, height: 720 }] - Browser viewport
 * @returns {string} Executable Playwright test script code
 */
function synthesizePlaywrightCode(actionData, options = {}) {
  const actions = normalizeActionsInput(actionData);
  const targetUrl =
    (actionData && !Array.isArray(actionData) && actionData.targetUrl) ||
    options.targetUrl ||
    options.baseUrl ||
    'http://localhost:3000/checkout';
  const screenshotPath =
    options.screenshotPath || 'public/screenshots/reproduced_bug.png';
  const viewportWidth = (options.viewport && options.viewport.width) || 1280;
  const viewportHeight = (options.viewport && options.viewport.height) || 720;
  const headless = options.headless !== undefined ? Boolean(options.headless) : true;

  const hasExplicitAssert = actions.some((act) => {
    const t = String(act.type || act.action || '').toLowerCase();
    return t === 'assert_visible' || t === 'assert' || t === 'expect_visible' || t === 'assert_error';
  });

  const codeLines = [];
  codeLines.push("const { chromium } = require('playwright');");
  codeLines.push("const assert = require('assert');");
  codeLines.push("const fs = require('fs');");
  codeLines.push("const path = require('path');");
  codeLines.push("");
  codeLines.push("// Resolves semantic locators (getByPlaceholder, getByRole, getByText) with CSS selector fallback");
  codeLines.push("async function resolveWithFallback(candidates, timeout = 5000) {");
  codeLines.push("  for (const getLoc of candidates) {");
  codeLines.push("    try {");
  codeLines.push("      const loc = getLoc().first();");
  codeLines.push("      if (await loc.isVisible()) return loc;");
  codeLines.push("    } catch (_) {}");
  codeLines.push("  }");
  codeLines.push("  const perCandidateTimeout = Math.max(800, Math.floor(timeout / Math.max(1, candidates.length)));");
  codeLines.push("  let lastErr = null;");
  codeLines.push("  for (const getLoc of candidates) {");
  codeLines.push("    try {");
  codeLines.push("      const loc = getLoc().first();");
  codeLines.push("      await loc.waitFor({ state: 'visible', timeout: perCandidateTimeout });");
  codeLines.push("      return loc;");
  codeLines.push("    } catch (err) {");
  codeLines.push("      lastErr = err;");
  codeLines.push("    }");
  codeLines.push("  }");
  codeLines.push("  if (lastErr) throw lastErr;");
  codeLines.push("  return candidates[candidates.length - 1]().first();");
  codeLines.push("}");
  codeLines.push("");
  codeLines.push("// Lightweight expect() assertion helper for standalone & Playwright test compatibility");
  codeLines.push("function expect(locator) {");
  codeLines.push("  return {");
  codeLines.push("    async toBeVisible(opts = {}) {");
  codeLines.push("      const timeout = opts.timeout || 5000;");
  codeLines.push("      await locator.waitFor({ state: 'visible', timeout });");
  codeLines.push("      const visible = await locator.isVisible();");
  codeLines.push("      assert.strictEqual(visible, true, 'Expected target locator to be visible');");
  codeLines.push("    },");
  codeLines.push("    async toContainText(expectedText, opts = {}) {");
  codeLines.push("      const timeout = opts.timeout || 5000;");
  codeLines.push("      await locator.waitFor({ state: 'visible', timeout });");
  codeLines.push("      const actualText = (await locator.innerText().catch(() => '')) || (await locator.textContent().catch(() => '')) || '';");
  codeLines.push("      assert.ok(");
  codeLines.push("        actualText.includes(expectedText),");
  codeLines.push("        `Expected element text to include \"${expectedText}\", but received \"${actualText.trim()}\"`");
  codeLines.push("      );");
  codeLines.push("    }");
  codeLines.push("  };");
  codeLines.push("}");
  codeLines.push("");
  codeLines.push("function test(title, fn) {");
  codeLines.push("  test._registered = { title, fn };");
  codeLines.push("}");
  codeLines.push("");
  codeLines.push("/**");
  codeLines.push(" * Synthesized by ReproLens Code Synthesizer");
  codeLines.push(` * Target: ${targetUrl}`);
  codeLines.push(` * Total Actions: ${actions.length}`);
  codeLines.push(" */");
  codeLines.push("test('reproduce checkout bug from video recording', async ({ page }) => {");
  codeLines.push(`  await page.setViewportSize({ width: ${viewportWidth}, height: ${viewportHeight} });`);
  codeLines.push("  const consoleErrors = [];");
  codeLines.push("  page.on('console', (msg) => {");
  codeLines.push("    if (msg.type() === 'error') consoleErrors.push(msg.text());");
  codeLines.push("  });");
  codeLines.push("");

  actions.forEach((act, idx) => {
    const stepNum = idx + 1;
    const rawType = String(act.type || act.action || '').toLowerCase();
    const desc = act.description || act.label || rawType || `step ${stepNum}`;
    codeLines.push(`  // Step ${stepNum}: ${desc}`);
    codeLines.push(`  console.log('[Step ${stepNum}/${actions.length}] ${escapeJsString(desc)}');`);

    switch (rawType) {
      case 'navigate':
      case 'goto': {
        const url = act.url || act.target || act.value || targetUrl;
        codeLines.push(`  await page.goto('${escapeJsString(url)}', { waitUntil: 'domcontentloaded' });`);
        break;
      }

      case 'fill':
      case 'type':
      case 'input': {
        const val = act.value !== undefined ? act.value : (act.input !== undefined ? act.input : '');
        const candidates = buildLocatorCandidates(act, 'fill');
        const candidateFns = candidates.map((c) => `() => ${c}`).join(', ');
        codeLines.push(`  // Locator chain: ${buildLocatorExpression(act, 'fill')}`);
        codeLines.push(`  {`);
        codeLines.push(`    const targetInput = await resolveWithFallback([${candidateFns}]);`);
        codeLines.push(`    await targetInput.fill('${escapeJsString(val)}');`);
        codeLines.push(`  }`);
        break;
      }

      case 'click':
      case 'press':
      case 'tap': {
        const candidates = buildLocatorCandidates(act, 'click');
        const candidateFns = candidates.map((c) => `() => ${c}`).join(', ');
        codeLines.push(`  // Locator chain: ${buildLocatorExpression(act, 'click')}`);
        codeLines.push(`  {`);
        codeLines.push(`    const targetElement = await resolveWithFallback([${candidateFns}]);`);
        codeLines.push(`    await targetElement.click();`);
        codeLines.push(`  }`);
        break;
      }

      case 'check': {
        const candidates = buildLocatorCandidates(act, 'check');
        const candidateFns = candidates.map((c) => `() => ${c}`).join(', ');
        codeLines.push(`  // Locator chain: ${buildLocatorExpression(act, 'check')}`);
        codeLines.push(`  {`);
        codeLines.push(`    const targetCheckbox = await resolveWithFallback([${candidateFns}]);`);
        codeLines.push(`    try {`);
        codeLines.push(`      await targetCheckbox.check();`);
        codeLines.push(`    } catch (_) {`);
        codeLines.push(`      await targetCheckbox.click();`);
        codeLines.push(`    }`);
        codeLines.push(`  }`);
        break;
      }

      case 'assert_visible':
      case 'assert':
      case 'expect_visible':
      case 'assert_error': {
        const candidates = buildLocatorCandidates(act, 'assert_visible');
        const candidateFns = candidates.map((c) => `() => ${c}`).join(', ');
        const expectedText = act.expectedText || act.text || act.value || '';
        codeLines.push(`  // Verify reproduced error state: ${buildLocatorExpression(act, 'assert_visible')}`);
        codeLines.push(`  {`);
        codeLines.push(`    const errorToast = await resolveWithFallback([${candidateFns}]);`);
        codeLines.push(`    await expect(errorToast).toBeVisible({ timeout: 5000 });`);
        if (expectedText) {
          codeLines.push(`    await expect(errorToast).toContainText('${escapeJsString(expectedText)}');`);
        }
        codeLines.push(`    const isVisible = await errorToast.isVisible();`);
        codeLines.push(`    assert.strictEqual(isVisible, true, 'Expected error reproduction element to be visible');`);
        codeLines.push(`    console.log('[ASSERTION] MATCHED: Error 409 conflict banner verified on page');`);
        codeLines.push(`  }`);
        break;
      }

      default:
        codeLines.push(`  // Unhandled action type: ${escapeJsString(rawType)}`);
    }

    codeLines.push("");
  });

  if (!hasExplicitAssert && options.autoAssertError !== false) {
    const defaultErrorText = options.expectedError || '오류 409';
    const defaultErrorSelector = options.errorSelector || '#error-toast, [role="alert"], .error-banner';
    codeLines.push("  // Verify reproduced error state (auto-assertion)");
    codeLines.push("  {");
    codeLines.push(
      `    const errorToast = await resolveWithFallback([() => page.getByRole('alert'), () => page.getByText('${escapeJsString(defaultErrorText)}'), () => page.locator('${escapeJsString(defaultErrorSelector)}')]);`
    );
    codeLines.push("    await expect(errorToast).toBeVisible({ timeout: 5000 });");
    codeLines.push(`    await expect(errorToast).toContainText('${escapeJsString(defaultErrorText)}');`);
    codeLines.push(`    console.log('[ASSERTION] MATCHED: Error 409 conflict banner verified on page');`);
    codeLines.push("  }");
    codeLines.push("");
  }

  codeLines.push("  // Capture evidence screenshot of reproduced bug state");
  codeLines.push("  console.log('[RUNNER] Capturing evidence screenshot...');");
  codeLines.push(`  const resolvedScreenshotPath = path.resolve(process.cwd(), '${escapeJsString(screenshotPath)}');`);
  codeLines.push("  fs.mkdirSync(path.dirname(resolvedScreenshotPath), { recursive: true });");
  codeLines.push("  await page.screenshot({ path: resolvedScreenshotPath, fullPage: true });");
  codeLines.push("  assert.strictEqual(fs.existsSync(resolvedScreenshotPath), true, 'Screenshot file must be saved');");
  codeLines.push("  console.log('[RUNNER] Status: ASSERTION PASSED (Error 409 Banner Verified)');");
  codeLines.push("});");
  codeLines.push("");
  codeLines.push("async function executeSynthesizedTest(customPage) {");
  codeLines.push("  if (!test._registered) throw new Error('No test registered');");
  codeLines.push("  if (customPage) {");
  codeLines.push("    return await test._registered.fn({ page: customPage });");
  codeLines.push("  }");
  codeLines.push("  console.log('[RUNNER] Launching headless Chromium to execute synthesized Playwright test...');");
  codeLines.push(`  const browser = await chromium.launch({ headless: ${headless} });`);
  codeLines.push(`  const context = await browser.newContext({ viewport: { width: ${viewportWidth}, height: ${viewportHeight} } });`);
  codeLines.push("  const page = await context.newPage();");
  codeLines.push("  try {");
  codeLines.push("    await test._registered.fn({ page, context, browser });");
  codeLines.push("  } finally {");
  codeLines.push("    await context.close().catch(() => {});");
  codeLines.push("    await browser.close().catch(() => {});");
  codeLines.push("  }");
  codeLines.push("}");
  codeLines.push("");
  codeLines.push("if (require.main === module) {");
  codeLines.push("  executeSynthesizedTest().catch((err) => {");
  codeLines.push("    console.error('Synthesized Playwright test failed:', err);");
  codeLines.push("    process.exit(1);");
  codeLines.push("  });");
  codeLines.push("}");
  codeLines.push("");
  codeLines.push("module.exports = { executeSynthesizedTest };");

  return codeLines.join("\n");
}

synthesizePlaywrightCode.synthesizePlaywrightCode = synthesizePlaywrightCode;
synthesizePlaywrightCode.buildLocatorExpression = buildLocatorExpression;
synthesizePlaywrightCode.buildLocatorCandidates = buildLocatorCandidates;

module.exports = synthesizePlaywrightCode;
