const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { once } = require('node:events');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { runReproduction, validateActions } = require('../engine/runner');
const { getFixtureActions } = require('../engine/vision_analyzer');

const originalCheckout = fs.readFileSync(path.join(__dirname, '../public/checkout.html'), 'utf8');
let checkout = originalCheckout;
let server;
let targetUrl;
const evidencePaths = [];

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(checkout);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  targetUrl = `http://127.0.0.1:${server.address().port}/checkout`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  for (const file of evidencePaths) fs.rmSync(file, { force: true });
});

function rememberEvidence(result) {
  if (result.screenshotUrl) {
    evidencePaths.push(path.join(__dirname, '..', 'public', result.screenshotUrl));
  }
  return result;
}

test('code strings, empty actions, unsupported actions, and executable navigation are rejected', async () => {
  await assert.rejects(runReproduction('process.exit(0);'), TypeError);
  await assert.rejects(runReproduction({ code: 'process.exit(0);' }), TypeError);
  for (const actions of [[], Array(51).fill({ type: 'navigate' }), [{ type: 'evaluate' }], [{ type: 'click', locatorStrategy: 'page.evaluate(() => {})' }]]) {
    assert.throws(() => validateActions(actions, targetUrl), TypeError);
  }
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://example.invalid']) {
    assert.throws(() => validateActions([{ type: 'navigate', url }], targetUrl), TypeError);
  }
});

test('real checkout reproduction verifies the banner and creates unique evidence for each run', async () => {
  checkout = originalCheckout;
  const first = rememberEvidence(await runReproduction(getFixtureActions(targetUrl), { targetUrl }));
  const second = rememberEvidence(await runReproduction(getFixtureActions(targetUrl), { targetUrl }));
  assert.equal(first.success, true, first.error);
  assert.equal(second.success, true, second.error);
  assert.equal(first.status, 'ASSERTION_PASSED');
  assert.notEqual(first.screenshotUrl, second.screenshotUrl);
  for (const file of evidencePaths) {
    const png = fs.readFileSync(file);
    assert.ok(png.length > 1000);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});

test('semantic locators and explicit CSS fallback replay data while malicious locatorStrategy stays inert', async () => {
  checkout = originalCheckout;
  const markerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reprolens-locator-test-'));
  const marker = path.join(markerDir, 'executed');
  const actions = getFixtureActions(targetUrl).map((action) => ({
    ...action,
    locatorStrategy: `page.locator('body'); require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`
  }));
  actions[1].placeholder = 'This placeholder does not exist';
  actions[2].role = 'button';
  actions[2].name = 'Apply';
  delete actions[2].selector;
  actions[3].labelText = 'Redeem full loyalty points ($50.00 credit)';
  delete actions[3].selector;
  try {
    const result = rememberEvidence(await runReproduction(actions, { targetUrl }));
    assert.equal(result.success, true, result.error);
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(markerDir, { recursive: true, force: true });
  }
});

test('an unrelated visible assertion and old evidence cannot replace the actual error state', async () => {
  checkout = originalCheckout;
  const result = await runReproduction([
    { type: 'navigate', url: targetUrl },
    { type: 'assert_visible', selector: 'body', text: 'Order Summary' }
  ], { targetUrl, timeoutMs: 2500 });
  assert.equal(result.success, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.screenshotUrl, undefined);
  assert.ok(evidencePaths.some((file) => fs.existsSync(file)), 'Prior evidence remains but is not reused');
});

test('a disabled button after a normal order is not a reproduced bug', async () => {
  checkout = originalCheckout;
  const result = await runReproduction([
    { type: 'click', selector: '#btn-place-order' }
  ], { targetUrl, timeoutMs: 2500 });
  assert.equal(result.success, false);
  assert.equal(result.screenshotUrl, undefined);
});

test('a visible banner with different text fails verification', async () => {
  checkout = originalCheckout.replaceAll('Error 409 Conflict:', 'Error 500 Failure:');
  const actions = getFixtureActions(targetUrl).filter((action) => action.type !== 'assert_visible');
  const result = await runReproduction(actions, { targetUrl });
  assert.equal(result.success, false);
  assert.match(result.error, /expected 409/);
  assert.equal(result.screenshotUrl, undefined);
});

test('the correct banner without the locked button fails verification', async () => {
  checkout = originalCheckout.replaceAll('btnPlaceOrder.disabled = true;', 'btnPlaceOrder.disabled = false;');
  const result = await runReproduction(getFixtureActions(targetUrl), { targetUrl });
  assert.equal(result.success, false);
  assert.match(result.error, /locked checkout/);
});

test('screenshot write failures and missing new evidence never return success', async (t) => {
  checkout = originalCheckout;
  for (const mode of ['write failure', 'missing file']) {
    await t.test(mode, async (t) => {
      const launch = chromium.launch.bind(chromium);
      t.mock.method(chromium, 'launch', async (options) => {
        const browser = await launch(options);
        const newContext = browser.newContext.bind(browser);
        browser.newContext = async (options) => {
          const context = await newContext(options);
          const newPage = context.newPage.bind(context);
          context.newPage = async () => {
            const page = await newPage();
            page.screenshot = async () => {
              if (mode === 'write failure') throw new Error('Evidence write denied');
              return Buffer.from('89504e470d0a1a0a00000000', 'hex');
            };
            return page;
          };
          return context;
        };
        return browser;
      });
      const result = await runReproduction(getFixtureActions(targetUrl), { targetUrl });
      assert.equal(result.success, false);
      assert.match(result.error, mode === 'write failure' ? /Evidence write denied/ : /fresh reproduction screenshot/);
      assert.equal(result.screenshotUrl, undefined);
    });
  }
});

test('a timeout closes the browser even when context initialization stalls', async (t) => {
  let closed = false;
  t.mock.method(chromium, 'launch', async () => ({
    newContext: () => new Promise(() => {}),
    close: async () => { closed = true; }
  }));
  const result = await runReproduction(getFixtureActions(targetUrl), { targetUrl, timeoutMs: 50 });
  assert.equal(result.success, false);
  assert.match(result.error, /timed out/);
  assert.equal(closed, true);
});
