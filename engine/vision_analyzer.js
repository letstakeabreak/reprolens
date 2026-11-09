/**
 * Vision Analysis Engine for ReproLens
 * Maps extracted video keyframes to standardized UI action sequence JSON.
 *
 * When process.env.GEMINI_API_KEY is available in the shell environment,
 * sends keyframes to Google Gemini 2.5 Flash via native REST fetch to perform
 * real visual action recognition.
 *
 * When no key is provided, or if the call fails, cleanly falls back to the
 * verified checkout interaction fixture with transparent provenance labeling
 * (source: "fixture" vs source: "vision-model"). Fake confidence numbers are removed.
 */

const fs = require('fs');
const path = require('path');

/**
 * Returns the standardized checkout bug reproduction fixture actions.
 * @param {string} baseUrl
 * @returns {Array<Object>}
 */
function getFixtureActions(baseUrl) {
  return [
    {
      step: 1,
      type: 'navigate',
      url: baseUrl,
      timestamp: '0.0s',
      frameIndex: 1,
      label: 'Navigate to Checkout',
      description: 'User enters the checkout page at /checkout.',
      locatorStrategy: `page.goto('${baseUrl}')`
    },
    {
      step: 2,
      type: 'fill',
      selector: '#coupon-input',
      value: 'SUMMER2026',
      timestamp: '1.5s',
      frameIndex: 3,
      label: 'Input Promo Code',
      description: "User types 'SUMMER2026' into the Promo Code field.",
      locatorStrategy: "page.getByPlaceholder('Enter coupon code (e.g. SUMMER2026)')"
    },
    {
      step: 3,
      type: 'click',
      selector: '#btn-apply-coupon',
      timestamp: '2.5s',
      frameIndex: 5,
      label: 'Click Apply Coupon',
      description: "User clicks 'Apply' button to validate the promo code.",
      locatorStrategy: "page.getByRole('button', { name: 'Apply' })"
    },
    {
      step: 4,
      type: 'check',
      selector: '#use-all-points',
      timestamp: '3.5s',
      frameIndex: 7,
      label: 'Redeem Loyalty Points',
      description: "User toggles the 'Redeem full loyalty points' checkbox.",
      locatorStrategy: "page.getByLabel('Redeem full loyalty points ($50.00 credit)')"
    },
    {
      step: 5,
      type: 'click',
      selector: '#btn-place-order',
      timestamp: '4.5s',
      frameIndex: 9,
      label: 'Click Place Order',
      description: "User clicks the primary 'Place Order' CTA button.",
      locatorStrategy: "page.getByRole('button', { name: 'Place Order' })"
    },
    {
      step: 6,
      type: 'assert_visible',
      selector: '#error-toast',
      text: 'Error 409 Conflict: Promotional coupon (SUMMER2026) cannot be combined with full loyalty point redemption.',
      timestamp: '6.0s',
      frameIndex: 12,
      label: 'Assert Error 409 State',
      description: 'Red Error 409 Conflict toast is displayed and UI locks up in unhandled error state.',
      locatorStrategy: "expect(page.getByRole('alert')).toBeVisible()"
    }
  ];
}

/**
 * Collects base64-encoded frame images from frames parameter or public/extracted_frames.
 * @param {Array<Object>} frames
 * @returns {Promise<Array<{mimeType: string, data: string, filename: string}>>}
 */
async function collectFrameImages(frames) {
  const images = [];
  const publicDir = path.resolve(__dirname, '..', 'public');
  const extractedDir = path.join(publicDir, 'extracted_frames');

  let filePaths = [];

  if (Array.isArray(frames) && frames.length > 0) {
    for (const f of frames) {
      if (f.filePath && fs.existsSync(f.filePath)) {
        filePaths.push(f.filePath);
      } else if (f.url) {
        const localPath = path.join(publicDir, f.url.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          filePaths.push(localPath);
        }
      }
    }
  }

  // If no files from parameter, read extracted_frames directory directly
  if (filePaths.length === 0 && fs.existsSync(extractedDir)) {
    const files = fs.readdirSync(extractedDir)
      .filter((f) => f.startsWith('frame_') && f.endsWith('.jpg'))
      .sort();
    filePaths = files.map((f) => path.join(extractedDir, f));
  }

  // Sample up to 16 frames evenly distributed across the duration
  const maxFrames = 16;
  let selectedPaths = filePaths;
  if (filePaths.length > maxFrames) {
    const step = filePaths.length / maxFrames;
    selectedPaths = [];
    for (let i = 0; i < maxFrames; i++) {
      selectedPaths.push(filePaths[Math.floor(i * step)]);
    }
  }

  for (const fp of selectedPaths) {
    try {
      const data = fs.readFileSync(fp).toString('base64');
      images.push({
        mimeType: 'image/jpeg',
        data,
        filename: path.basename(fp)
      });
    } catch (_) {}
  }

  return images;
}

/**
 * Calls Gemini 2.5 Flash via native fetch REST API with the extracted keyframes.
 * Never logs or exposes the API key.
 *
 * @param {Array<Object>} frames
 * @param {string} baseUrl
 * @returns {Promise<Object>}
 */
async function callGeminiVision(frames, baseUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const images = await collectFrameImages(frames);
  if (images.length === 0) {
    throw new Error('No extracted keyframes available for vision analysis');
  }

  const firstPass = await requestVisionActions(
    apiKey,
    images,
    buildVisionPrompt(images.length, baseUrl)
  );
  let actions = firstPass.actions;
  let model = firstPass.model;
  let incomplete = false;
  let incompleteReason = '';

  if (triggerClickMissing(actions)) {
    console.log('[VISION_ANALYZER] Banner assertion is missing a new revealing click. Asking the model once more.');
    try {
      const repair = await requestVisionActions(
        apiKey,
        images,
        buildRepairPrompt(actions)
      );
      actions = repair.actions;
      model = repair.model;
    } catch (err) {
      console.warn(`[VISION_ANALYZER] Repair call failed. Keeping the first model result. Reason: ${err.message}`);
    }
  }

  if (triggerClickMissing(actions)) {
    incomplete = true;
    incompleteReason = 'the click immediately before the banner is missing or repeats an earlier click';
    console.warn(`[VISION_ANALYZER] Vision sequence is incomplete. Not using the fixture. Reason: ${incompleteReason}`);
  }

  return {
    targetUrl: baseUrl,
    detectedActions: actions,
    totalFrames: images.length,
    source: 'vision-model',
    model,
    incomplete,
    incompleteReason: incomplete ? incompleteReason : undefined,
    analyzedAt: new Date().toISOString()
  };
}

function buildVisionPrompt(imageCount, baseUrl) {
  return `You are a QA automation vision analyzer.
You are given a chronological sequence of ${imageCount} video keyframes from a screen recording of a web bug.
List every user action that changes the page, in order, then the error banner if one appears.
Read the text from the frames. Do not invent values, selectors, or a confidence score.

Target page URL: ${baseUrl}

Allowed action types:
- "navigate": the page that opened
- "fill": text typed into a field (include the visible value)
- "click": a button or control that was clicked (include the visible label)
- "check": a checkbox that was checked (include the visible label)
- "assert_visible": an error toast, banner, or alert that became visible (include the visible text)

Rules:
- Include every state-changing action. Do not stop when you see the error text.
- If an error banner appears, the action immediately before assert_visible must be the click of the control that was pressed as that banner appeared. That click must not repeat an earlier click.
- Omit confidence.

Return ONLY a JSON object with this shape. The strings below are placeholders, not observed values:
{
  "detectedActions": [
    {
      "step": 1,
      "type": "fill",
      "selector": "",
      "value": "",
      "text": "",
      "label": "",
      "description": "",
      "locatorStrategy": "page.getByRole('button', { name: '...' })",
      "timestamp": "0.0s",
      "frameIndex": 1
    }
  ]
}
Timestamps look like "1.5s". Frame indices are 1-based. Step numbers start at 1 and increase by 1.`;
}

function buildRepairPrompt(draftActions) {
  return `The action list below came from the same frames, but the click that revealed the error banner is missing or repeats an earlier click.
Look at the frame where the banner first becomes visible. Insert the click of the control that was pressed in that moment, directly before assert_visible.
That click must be a different control from any click already in the list. Do not copy an earlier click's label, text, or selector.
Keep the other actions you can still see. Do not add a confidence score.
Return the full JSON object with detectedActions.

Current actions:
${JSON.stringify(draftActions)}`;
}

function clickIdentity(act) {
  return [act.label, act.text, act.name, act.selector]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

function triggerClickMissing(actions) {
  const index = actions.findIndex((act) => act.type === 'assert_visible');
  if (index === -1) return false;
  const previous = actions[index - 1];
  if (!previous || previous.type !== 'click') return true;
  const identity = clickIdentity(previous);
  if (!identity) return false;
  return actions.slice(0, index - 1).some((act) => act.type === 'click' && clickIdentity(act) === identity);
}

async function requestVisionActions(apiKey, images, promptText) {
  const parts = [{ text: promptText }];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data
      }
    });
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1
    }
  };

  const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
  let lastError = null;
  let resJson = null;
  let activeModel = null;

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        lastError = new Error(`Gemini API [${model}] HTTP ${response.status}: ${errorText.slice(0, 160)}`);
        continue;
      }

      resJson = await response.json();
      activeModel = model;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!resJson) {
    throw lastError || new Error('All candidate Gemini vision models failed');
  }

  const candidateText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Gemini API response contained no candidate text');
  }

  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch (err) {
    throw new Error(`Failed to parse Gemini response as JSON: ${err.message}`);
  }

  const rawActions = Array.isArray(parsed.detectedActions)
    ? parsed.detectedActions
    : Array.isArray(parsed.actions)
    ? parsed.actions
    : Array.isArray(parsed)
    ? parsed
    : null;

  if (!rawActions || rawActions.length === 0) {
    throw new Error('No actions detected in Gemini vision response');
  }

  const allowedTypes = new Set(['navigate', 'fill', 'click', 'check', 'assert_visible']);
  const allowedKeys = [
    'step',
    'type',
    'selector',
    'value',
    'text',
    'label',
    'description',
    'locatorStrategy',
    'timestamp',
    'frameIndex',
    'url',
    'role',
    'placeholder',
    'name',
    'labelText'
  ];

  const sanitizedActions = rawActions
    .map((act, index) => {
      const type = String(act.type || act.action || '').toLowerCase().trim();
      if (!allowedTypes.has(type)) {
        return null;
      }
      const clean = {
        step: index + 1,
        type
      };
      for (const k of allowedKeys) {
        if (k === 'step') continue;
        if (act[k] !== undefined && act[k] !== null && act[k] !== '') {
          clean[k] = act[k];
        }
      }
      return clean;
    })
    .filter(Boolean);

  if (sanitizedActions.length === 0) {
    throw new Error('No valid actions remained after schema validation');
  }

  return { actions: sanitizedActions, model: activeModel };
}

/**
 * Analyzes video keyframes and produces an action sequence JSON.
 * Async function returning a Promise. Also attaches sync properties for backward compatibility.
 *
 * @param {Array<Object>} frames
 * @param {Object} [options={}]
 * @returns {Promise<Object>}
 */
function analyzeVideoFrames(frames = [], options = {}) {
  const baseUrl = options.baseUrl || 'http://localhost:3000/checkout';
  const totalFrames = Array.isArray(frames) ? frames.length : 0;
  const fixtureActions = getFixtureActions(baseUrl);

  const fallbackResult = {
    targetUrl: baseUrl,
    detectedActions: fixtureActions,
    totalFrames,
    source: 'fixture',
    analyzedAt: new Date().toISOString()
  };

  const promise = (async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.log('[VISION_ANALYZER] Using verified fixture sequence (source: fixture, GEMINI_API_KEY not set).');
      return fallbackResult;
    }

    try {
      console.log('[VISION_ANALYZER] GEMINI_API_KEY present. Calling Gemini vision model...');
      const liveResult = await callGeminiVision(frames, baseUrl);
      console.log(`[VISION_ANALYZER] Live vision model succeeded (source: vision-model). Recognized ${liveResult.detectedActions.length} actions.`);
      return liveResult;
    } catch (err) {
      console.warn(`[VISION_ANALYZER] Vision model call failed, falling back to fixture (source: fixture). Reason: ${err.message}`);
      return fallbackResult;
    }
  })();

  // Synchronously bind fixture properties to promise instance for backward compatibility with sync callers
  Object.assign(promise, fallbackResult);

  return promise;
}

module.exports = {
  analyzeVideoFrames,
  getFixtureActions,
  collectFrameImages
};
