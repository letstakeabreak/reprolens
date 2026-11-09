/**
 * iOS Simulator Bug Reproduction Runner for ReproLens
 *
 * Drives Safari inside an iPhone Simulator via Facebook idb (iOS Development Bridge)
 * and xcrun simctl to replay synthesized checkout bug interactions on a simulated mobile device.
 *
 * NOTE: This runs on an iOS Simulator, NOT a physical device.
 * All logs, UI badges, and return objects explicitly state "iOS Simulator".
 * Never fakes success: if idb or the simulator is unavailable, fails gracefully with clear diagnosis.
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_UDID = '38607B1A-5F3C-4230-B457-D5402A4AE8C5'; // iPhone 16 Simulator (18.0)
const IDB_BIN_CANDIDATES = [
  path.join(process.env.HOME || '', 'Library/Python/3.9/bin/idb'),
  '/opt/homebrew/bin/idb',
  '/usr/local/bin/idb'
];

/**
 * Resolves the absolute path to the idb executable.
 * @returns {string|null}
 */
function resolveIdbPath() {
  for (const candidate of IDB_BIN_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  try {
    const fromPath = execSync('which idb', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (fromPath && fs.existsSync(fromPath)) return fromPath;
  } catch (_) {}
  return null;
}

/**
 * Checks if the iPhone 16 Simulator and idb tooling are ready.
 * @param {string} [udid=DEFAULT_UDID]
 * @returns {{available: boolean, reason?: string, udid: string, deviceName: string}}
 */
function checkSimulatorAvailability(udid = DEFAULT_UDID) {
  const idbPath = resolveIdbPath();
  if (!idbPath) {
    return {
      available: false,
      reason: 'Facebook idb CLI is not installed or not found on PATH.',
      udid,
      deviceName: 'iPhone 16 Simulator (iOS 18.0)'
    };
  }

  try {
    const simList = execSync('xcrun simctl list devices', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const isBooted = simList.includes(udid) && simList.includes(`${udid}) (Booted)`);
    if (!isBooted) {
      return {
        available: false,
        reason: `Target simulator (UDID: ${udid}) is not booted.`,
        udid,
        deviceName: 'iPhone 16 Simulator (iOS 18.0)'
      };
    }
  } catch (err) {
    return {
      available: false,
      reason: `Failed to query xcrun simctl: ${err.message}`,
      udid,
      deviceName: 'iPhone 16 Simulator (iOS 18.0)'
    };
  }

  return {
    available: true,
    udid,
    deviceName: 'iPhone 16 Simulator (iOS 18.0)'
  };
}

/**
 * Helper to execute idb commands with proper PATH environment.
 * @param {string[]} args
 * @returns {string}
 */
function runIdb(args) {
  const idbPath = resolveIdbPath() || 'idb';
  const customEnv = {
    ...process.env,
    PATH: `${path.join(process.env.HOME || '', 'Library/Python/3.9/bin')}:/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`
  };
  return execFileSync(idbPath, args, {
    encoding: 'utf8',
    env: customEnv,
    stdio: ['pipe', 'pipe', 'ignore']
  });
}

/**
 * Replays the bug reproduction sequence inside Safari on the iPhone Simulator.
 *
 * @param {Object} [options={}]
 * @param {string} [options.udid=DEFAULT_UDID]
 * @param {string} [options.targetUrl]
 * @param {string} [options.screenshotPath]
 * @returns {Promise<Object>}
 */
async function runSimulatorReproduction(options = {}) {
  const startTime = Date.now();
  const logs = [];
  const log = (msg) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logs.push(`[+${elapsed}s] [iOS Simulator] ${msg}`);
  };

  const udid = options.udid || DEFAULT_UDID;
  const targetUrl = options.targetUrl || 'http://localhost:3000/checkout';
  const relScreenshotPath = options.screenshotPath || 'public/screenshots/reproduced_simulator.png';
  const absScreenshotPath = path.resolve(process.cwd(), relScreenshotPath);

  log(`Target Environment: iPhone 16 Simulator (iOS 18.0, UDID: ${udid})`);
  log('Checking Facebook idb connection and simulator state...');

  const availability = checkSimulatorAvailability(udid);
  if (!availability.available) {
    log(`ERROR: iOS Simulator runner unavailable: ${availability.reason}`);
    return {
      success: false,
      status: 'UNAVAILABLE',
      target: 'ios-sim',
      device: 'iPhone 16 Simulator (iOS 18.0)',
      durationMs: Date.now() - startTime,
      logs,
      error: availability.reason
    };
  }

  try {
    // 1. Ensure companion connected
    try {
      runIdb(['connect', udid]);
      log('Companion socket connected successfully.');
    } catch (_) {
      log('Companion socket already active.');
    }

    // 2. Step 1: Open checkout page in Safari
    log(`Navigating Mobile Safari to checkout: ${targetUrl}`);
    execSync(`xcrun simctl openurl ${udid} "${targetUrl}"`, { stdio: 'ignore' });
    await new Promise((r) => setTimeout(r, 2200));

    // 3. Step 2: Focus promo code input
    log("Step 1/5: Tapping Promo Code input field ('Enter coupon code')...");
    runIdb(['ui', 'tap', '--udid', udid, '150', '540']);
    await new Promise((r) => setTimeout(r, 800));

    // Dismiss first-run keyboard onboarding sheet if presented
    try {
      const axAll = JSON.parse(runIdb(['ui', 'describe-all', '--udid', udid, '--json']));
      for (const item of axAll) {
        if (item.AXLabel === 'Continue' && item.frame) {
          log("Dismissed iOS keyboard onboarding sheet ('Continue').");
          const cx = Math.floor(item.frame.x + item.frame.width / 2);
          const cy = Math.floor(item.frame.y + item.frame.height / 2);
          runIdb(['ui', 'tap', '--udid', udid, String(cx), String(cy)]);
          await new Promise((r) => setTimeout(r, 400));
          break;
        }
      }
    } catch (_) {}

    // 4. Step 3: Type promo code value
    log("Step 2/5: Typing promo code 'SUMMER2026' via idb text input...");
    runIdb(['ui', 'text', '--udid', udid, 'SUMMER2026']);
    await new Promise((r) => setTimeout(r, 500));

    // Dismiss software keyboard by tapping Done on keyboard toolbar
    log("Dismissing iOS software keyboard via Done button (x: 360, y: 494)...");
    runIdb(['ui', 'tap', '--udid', udid, '360', '494']);
    await new Promise((r) => setTimeout(r, 700));

    // 5. Step 4: Click Apply button
    log("Step 3/5: Tapping 'Apply' promo code button (x: 320, y: 484)...");
    runIdb(['ui', 'tap', '--udid', udid, '320', '484']);
    await new Promise((r) => setTimeout(r, 800));

    // 6. Step 5: Check Loyalty Points checkbox
    log("Step 4/5: Toggling 'Redeem full loyalty points ($50.00 credit)' checkbox...");
    runIdb(['ui', 'tap', '--udid', udid, '125', '580']);
    await new Promise((r) => setTimeout(r, 800));

    // 7. Step 6: Click Place Order
    log("Step 5/5: Tapping primary 'Place Order' CTA button (x: 196, y: 775)...");
    runIdb(['ui', 'tap', '--udid', udid, '196', '775']);
    await new Promise((r) => setTimeout(r, 1200));

    // 8. Capture evidence screenshot
    log('Capturing mobile reproduction evidence screenshot via idb...');
    fs.mkdirSync(path.dirname(absScreenshotPath), { recursive: true });
    runIdb(['screenshot', '--udid', udid, absScreenshotPath]);

    const stat = fs.statSync(absScreenshotPath);
    log(`Screenshot saved to ${relScreenshotPath} (${stat.size} bytes).`);

    let assertionMatched = false;
    try {
      const pointInspect = JSON.parse(runIdb(['ui', 'describe-point', '--udid', udid, '200', '200']));
      const desc = JSON.stringify(pointInspect);
      assertionMatched = desc.includes('409');
    } catch (err) {
      log(`describe-point failed: ${err.message}`);
    }

    const durationMs = Date.now() - startTime;
    const screenshotUrl = `/${relScreenshotPath.replace(/^public\//, '')}?t=${Date.now()}`;
    if (!assertionMatched) {
      log('Status: ASSERTION FAILED (409 banner was not found on the iOS Simulator screen)');
      log(`Execution completed in ${(durationMs / 1000).toFixed(2)}s.`);
      return {
        success: false,
        status: 'ASSERTION_FAILED',
        target: 'ios-sim',
        device: 'iPhone 16 Simulator (iOS 18.0)',
        durationMs,
        logs,
        screenshotUrl,
        error: '409 banner was not found on the iOS Simulator screen'
      };
    }

    log('[ASSERTION] MATCHED: Error 409 conflict banner verified on iOS Simulator screen');
    log(`Execution completed in ${(durationMs / 1000).toFixed(2)}s.`);
    log('Status: ASSERTION PASSED (Error 409 Banner Verified on iOS Simulator)');

    return {
      success: true,
      status: 'ASSERTION_PASSED',
      target: 'ios-sim',
      device: 'iPhone 16 Simulator (iOS 18.0)',
      durationMs,
      logs,
      screenshotUrl
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    log(`Execution failed with error: ${err.message}`);
    return {
      success: false,
      status: 'ASSERTION_FAILED',
      target: 'ios-sim',
      device: 'iPhone 16 Simulator (iOS 18.0)',
      durationMs,
      logs,
      error: err.message
    };
  }
}

module.exports = {
  checkSimulatorAvailability,
  runSimulatorReproduction,
  resolveIdbPath
};
