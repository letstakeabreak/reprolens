/**
 * Verification suite for engine/synthesizer.js
 * Tests code generation, semantic locators (getByPlaceholder, getByRole, getByText),
 * CSS selector fallbacks, screenshot saving, and live headless Playwright execution.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { synthesizePlaywrightCode } = require('./synthesizer');
const { analyzeVideoFrames } = require('./vision_analyzer');

async function runTests() {
  console.log('=== [1/4] Testing synthesizePlaywrightCode static output & locators ===');

  const checkoutFileUrl = `file://${path.resolve(__dirname, '..', 'public', 'checkout.html')}`;
  const screenshotOutput = path.join('temp', 'test_synthesizer_repro.png');
  const absScreenshotOutput = path.resolve(__dirname, '..', screenshotOutput);

  if (fs.existsSync(absScreenshotOutput)) {
    fs.unlinkSync(absScreenshotOutput);
  }

  const uiActions = [
    {
      type: 'navigate',
      url: checkoutFileUrl,
      description: '결제 페이지 접속'
    },
    {
      type: 'fill',
      placeholder: '쿠폰 코드 입력 (예: SUMMER2026)',
      selector: '#coupon-input',
      value: 'SUMMER2026',
      description: '할인 쿠폰 코드 입력'
    },
    {
      type: 'click',
      role: 'button',
      name: '적용',
      text: '적용',
      selector: '#btn-apply-coupon',
      description: '쿠폰 적용 버튼 클릭'
    },
    {
      type: 'check',
      role: 'checkbox',
      name: '보유 마일리지 전액 사용 (50,000 P)',
      text: '보유 마일리지 전액 사용 (50,000 P)',
      selector: '#use-all-points',
      description: '마일리지 전액 사용 체크'
    },
    {
      type: 'click',
      role: 'button',
      name: '결제하기',
      text: '결제하기',
      selector: '#btn-place-order',
      description: '결제하기 버튼 클릭'
    },
    {
      type: 'assert_visible',
      role: 'alert',
      text: 'Error 409 Conflict: Promotional coupon (SUMMER2026) cannot be combined with full loyalty point redemption.',
      selector: '#error-toast',
      description: '409 충돌 에러 배너 표시 검증'
    }
  ];

  const synthesizedCode = synthesizePlaywrightCode(uiActions, {
    targetUrl: checkoutFileUrl,
    screenshotPath: screenshotOutput,
    headless: true
  });

  assert.strictEqual(typeof synthesizedCode, 'string', 'Synthesized output must be a string');
  assert.ok(synthesizedCode.includes('getByPlaceholder('), 'Must support getByPlaceholder');
  assert.ok(synthesizedCode.includes('getByRole('), 'Must support getByRole');
  assert.ok(synthesizedCode.includes('getByText('), 'Must support getByText');
  assert.ok(synthesizedCode.includes('.or(page.locator('), 'Must include CSS selector fallback via .or(page.locator(...))');
  assert.ok(synthesizedCode.includes('page.screenshot('), 'Must include screenshot capture');
  assert.ok(synthesizedCode.includes('toBeVisible('), 'Must include error visibility assertion');
  assert.ok(synthesizedCode.includes('toContainText('), 'Must include error text assertion');
  console.log('✅ Static assertions passed (getByPlaceholder, getByRole, getByText, CSS fallback, screenshot, assertion)');

  console.log('=== [2/4] Executing synthesized Playwright script against checkout.html ===');
  const tempScriptPath = path.resolve(__dirname, '..', 'temp', 'generated_repro_test.js');
  fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
  fs.writeFileSync(tempScriptPath, synthesizedCode, 'utf8');

  execFileSync(process.execPath, [tempScriptPath], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });

  assert.strictEqual(fs.existsSync(absScreenshotOutput), true, 'Screenshot file must exist after test run');
  const stat = fs.statSync(absScreenshotOutput);
  assert.ok(stat.size > 1000, `Screenshot file should be non-empty (got ${stat.size} bytes)`);
  console.log(`✅ Live execution passed! Screenshot saved (${stat.size} bytes): ${screenshotOutput}`);

  console.log('=== [3/4] Testing CSS selector fallback when semantic locators do not match ===');
  const fallbackActions = [
    { type: 'navigate', url: checkoutFileUrl },
    {
      type: 'fill',
      placeholder: '존재하지_않는_플레이스홀더',
      selector: '#coupon-input',
      value: 'SUMMER2026'
    },
    {
      type: 'click',
      role: 'button',
      name: '존재하지_않는_버튼명',
      selector: '#btn-apply-coupon'
    },
    {
      type: 'check',
      text: '존재하지_않는_체크박스_텍스트',
      selector: '#use-all-points'
    },
    {
      type: 'click',
      text: '존재하지_않는_결제버튼_텍스트',
      selector: '#btn-place-order'
    },
    {
      type: 'assert_visible',
      selector: '#error-toast',
      text: 'Error 409'
    }
  ];

  const fallbackScreenshot = path.join('temp', 'test_synthesizer_fallback.png');
  const fallbackCode = synthesizePlaywrightCode(fallbackActions, {
    screenshotPath: fallbackScreenshot,
    headless: true
  });
  const fallbackScriptPath = path.resolve(__dirname, '..', 'temp', 'generated_fallback_test.js');
  fs.writeFileSync(fallbackScriptPath, fallbackCode, 'utf8');

  execFileSync(process.execPath, [fallbackScriptPath], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  assert.strictEqual(
    fs.existsSync(path.resolve(__dirname, '..', fallbackScreenshot)),
    true,
    'Fallback screenshot must exist'
  );
  console.log('✅ CSS selector fallback execution passed!');

  console.log('=== [4/4] Testing compatibility with vision_analyzer output ===');
  const analysisResult = analyzeVideoFrames([], { baseUrl: checkoutFileUrl });
  const fromAnalysisCode = synthesizePlaywrightCode(analysisResult, {
    targetUrl: checkoutFileUrl,
    screenshotPath: screenshotOutput
  });
  assert.ok(fromAnalysisCode.includes('getByPlaceholder('));
  assert.ok(fromAnalysisCode.includes('getByRole('));
  assert.ok(fromAnalysisCode.includes('getByText('));
  assert.ok(fromAnalysisCode.includes('.or(page.locator('));
  console.log('✅ vision_analyzer integration passed!');

  console.log('\nSYNTHESIZER_READY');
}

runTests().catch((err) => {
  console.error('❌ Synthesizer test failed:', err);
  process.exit(1);
});
