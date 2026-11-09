const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { once } = require('node:events');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let server;
let baseUrl;
let port;
let markerDir;

before(async () => {
  const app = require('../server');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  markerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reprolens-api-test-'));
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
  if (markerDir) fs.rmSync(markerDir, { recursive: true, force: true });
});

async function post(body, headers = {}) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(`${baseUrl}/api/run-reproduce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      },
      signal: AbortSignal.timeout(5000)
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode,
        headers: response.headers
      })));
    });
    request.on('error', reject);
    request.end(data);
  });
}

async function assertRejected(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
  assert.notEqual(body.success, true);
}

test('the loopback server serves the studio and same-origin sample metadata', async () => {
  assert.equal(server.address().address, '127.0.0.1');
  const studio = await fetch(baseUrl);
  assert.equal(studio.status, 200);
  assert.match(await studio.text(), /ReproLens/);

  const sample = await fetch(`${baseUrl}/api/sample-video`, { headers: { Origin: baseUrl } });
  assert.equal(sample.status, 200);
  const body = await sample.json();
  assert.equal(body.exists, true);
  assert.equal(body.url, '/sample_videos/sample_bug.mp4');
  assert.ok(body.size > 0);

  const localhost = await fetch(`http://localhost:${port}/api/sample-video`, {
    headers: { Origin: `http://localhost:${port}` }
  });
  assert.equal(localhost.status, 200);
  assert.equal((await localhost.json()).exists, true);
});

test('forged hosts and a matching attacker origin cannot pass the local boundary', async (t) => {
  for (const host of [`attacker.invalid:${port}`, `127.0.0.1.attacker.invalid:${port}`, 'localhost:1']) {
    await t.test(host, async () => {
      const response = await post({}, { Host: host, Origin: `http://${host}` });
      await assertRejected(response, 403);
      await assertRejected(await post({}, { Host: host }), 403);
    });
  }
});

test('cross-origin and opaque-origin POST requests are rejected', async (t) => {
  for (const origin of ['https://attacker.invalid', 'null', `http://localhost:${port}`, `https://127.0.0.1:${port}`]) {
    await t.test(origin, async () => {
      await assertRejected(await post({}, { Origin: origin }), 403);
    });
  }
});

test('the execution endpoint requires a JSON content type', async () => {
  await assertRejected(await post({}, { 'Content-Type': 'text/plain', Origin: baseUrl }), 415);
});

test('code is rejected even beside valid actions, and never executes', async () => {
  const marker = path.join(markerDir, 'code-executed');
  const code = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed');`;
  await assertRejected(await post({
    code,
    detectedActions: [{ type: 'navigate', url: `${baseUrl}/checkout` }]
  }), 400);
  assert.equal(fs.existsSync(marker), false);
  await assertRejected(await post({ code }), 400);
  assert.equal(fs.existsSync(marker), false);
});

test('execution options and unknown fields cannot be supplied by the caller', async (t) => {
  for (const extra of [{ code: null }, { targetUrl: 'https://attacker.invalid' }, { screenshotPath: '/tmp/override.png' }, { unknown: true }]) {
    await t.test(Object.keys(extra)[0], async () => {
      await assertRejected(await post({
        detectedActions: [{ type: 'navigate', url: `${baseUrl}/checkout` }],
        ...extra
      }), 400);
    });
  }
  await assertRejected(await post({ target: 'shell', detectedActions: [] }), 400);
});

test('missing, empty, malformed, and unsupported action lists are rejected without a runner', async (t) => {
  const payloads = [
    {},
    { detectedActions: [] },
    { detectedActions: {} },
    { detectedActions: null },
    { detectedActions: [{ type: 'evaluate', code: 'process.exit(0)' }] }
  ];
  for (const [index, payload] of payloads.entries()) {
    await t.test(`invalid payload ${index + 1}`, async () => {
      await assertRejected(await post(payload), 400);
    });
  }
});

test('navigation actions cannot choose external or executable URLs', async (t) => {
  for (const url of ['https://attacker.invalid/checkout', 'file:///etc/passwd', 'javascript:alert(1)']) {
    await t.test(url, async () => {
      await assertRejected(await post({ detectedActions: [{ type: 'navigate', url }] }), 400);
    });
  }
});
