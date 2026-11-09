const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function buildPrevis() {
  const rootDir = path.join(__dirname, '..');
  const shotsDir = path.join(rootDir, 'public', 'previs_shots');
  const tempDir = path.join(rootDir, 'temp', 'previs_build');
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // Capture live Studio state screenshots at 1440x1600 with static header so element crops never overlap sticky header
  const studioPage = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
  await studioPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await studioPage.evaluate(() => {
    const hdr = document.querySelector('header');
    if (hdr) hdr.style.position = 'static';
  });

  const studioInitialPath = path.join(shotsDir, 'studio_initial.png');
  await studioPage.screenshot({ path: studioInitialPath });

  await studioPage.click('#btn-analyze');
  await studioPage.waitForTimeout(1800);
  await studioPage.evaluate(() => window.scrollTo(0, 0));

  const studioAnalyzedPath = path.join(shotsDir, 'studio_analyzed.png');
  await studioPage.screenshot({ path: studioAnalyzedPath });

  // Capture actual element crops from live Studio DOM
  const reelCard = studioPage.locator('.column').first().locator('.card').nth(1);
  const studioReelPath = path.join(shotsDir, 'studio_reel_15frames.png');
  await reelCard.screenshot({ path: studioReelPath });

  const actionsCard = studioPage.locator('.column').first().locator('.card').nth(2);
  const studioActionsPath = path.join(shotsDir, 'studio_actions_6steps.png');
  await actionsCard.screenshot({ path: studioActionsPath });

  const codeCard = studioPage.locator('.column').nth(1).locator('.card').nth(0);
  const studioCodePath = path.join(shotsDir, 'studio_code_card.png');
  await codeCard.screenshot({ path: studioCodePath });

  await studioPage.click('#btn-run-test');
  await studioPage.waitForTimeout(4200);
  await studioPage.evaluate(() => window.scrollTo(0, 0));

  const studioCompletedPath = path.join(shotsDir, 'studio_completed.png');
  await studioPage.screenshot({ path: studioCompletedPath, clip: { x: 0, y: 0, width: 1440, height: 920 } });

  const runnerCard = studioPage.locator('.column').nth(1).locator('.card').nth(1);
  const studioRunnerPath = path.join(shotsDir, 'studio_runner_card.png');
  await runnerCard.screenshot({ path: studioRunnerPath });

  await studioPage.close();

  function fileToDataUrl(filePath) {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase() === '.png' ? 'png' : 'jpeg';
    return `data:image/${ext};base64,${buf.toString('base64')}`;
  }

  // Load all 15 extracted frames so Shot 06 shows all 15 real frames
  const all15Frames = [];
  for (let i = 1; i <= 15; i++) {
    const pad = String(i).padStart(3, '0');
    const p = path.join(rootDir, 'public', 'extracted_frames', `frame_${pad}.jpg`);
    all15Frames.push({
      index: i,
      time: `${((i - 1) * 0.5).toFixed(1)}s`,
      dataUrl: fileToDataUrl(p)
    });
  }

  const assets = {
    frame13: fileToDataUrl(path.join(rootDir, 'public', 'extracted_frames', 'frame_013.jpg')),
    reproImg: fileToDataUrl(path.join(rootDir, 'public', 'screenshots', 'reproduced_bug.png')),
    studioInitial: fileToDataUrl(studioInitialPath),
    studioCompleted: fileToDataUrl(studioCompletedPath),
    studioReel: fileToDataUrl(studioReelPath),
    studioActions: fileToDataUrl(studioActionsPath),
    studioCode: fileToDataUrl(studioCodePath),
    studioRunner: fileToDataUrl(studioRunnerPath),
    all15Frames
  };

  const SHOTS = [
    {
      id: 1,
      act: 'Why (20%)',
      criterion: 'Problem Clarity',
      start: 0,
      duration: 6,
      timecode: '00:00 to 00:06',
      title: 'Shot 01: Slack Bug Report Arrives',
      presenterMode: 'Presenter Split (Right)',
      vo: 'Minwoo is a frontend engineer. Every week, he gets bug reports like this eight-second clip with zero steps.',
      citation: 'Target Persona: Minwoo (Frontend Engineer at B2B SaaS Startup)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="content-split">
            <div class="slack-card">
              <div class="slack-header">
                <span class="channel-name">#customer-bugs</span>
                <span class="msg-time">Today at 9:41 AM</span>
              </div>
              <div class="slack-sender">Customer Support relayed to Minwoo (Frontend Lead)</div>
              <div class="slack-body">"Checkout button freezes when using promo coupon. Customer attached an 8-second screen recording. Can you fix this before today's release?"</div>
              <div class="slack-attachment">
                <div class="att-title">Attached File: sample_bug.mp4 (7.3s, 1280x720)</div>
                <div class="att-sub">No reproduction steps, no browser version, no console logs attached.</div>
              </div>
            </div>
            <div class="presenter-split-box">
              <div class="pip-ring"></div>
              <div class="pip-label">Presenter Camera (Split)</div>
              <div class="pip-sub">Direct eye contact, introducing Minwoo's bug ticket</div>
            </div>
          </div>
          <div class="subtitle-bar">"Minwoo is a frontend engineer. Every week, he gets bug reports like this eight-second clip with zero steps."</div>
        </div>
      `
    },
    {
      id: 2,
      act: 'Why (20%)',
      criterion: 'Problem Clarity',
      start: 6,
      duration: 6,
      timecode: '00:06 to 00:12',
      title: 'Shot 02: The Ambiguous 8s Bug Video',
      presenterMode: 'Corner PiP',
      vo: 'The customer typed a coupon, checked points, and the order button locked up with a 409 conflict.',
      citation: 'Input Recording: public/sample_videos/sample_bug.mp4 (7.3s, 1280x720)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="center-frame">
            <div class="frame-caption">Customer's Raw 7.3-Second Screen Recording (public/sample_videos/sample_bug.mp4)</div>
            <img src="${a.frame13}" class="contained-img" />
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"The customer typed a coupon, checked points, and the order button locked up with a 409 conflict."</div>
        </div>
      `
    },
    {
      id: 3,
      act: 'Why (20%)',
      criterion: 'Problem Clarity',
      start: 12,
      duration: 6,
      timecode: '00:12 to 00:18',
      title: 'Shot 03: Verified Weekly Debugging Cost',
      presenterMode: 'Presenter Split (Right)',
      vo: 'In Stripe\'s Developer Coefficient study, engineers spend over 17 hours every week on debugging and maintenance instead of building features.',
      citation: 'Source URL: https://stripe.com/files/reports/the-developer-coefficient.pdf (Stripe & Harris Poll, 2018)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="content-split">
            <div class="stat-card" style="height: 520px;">
              <div class="stat-label-top">Verified Industry Report</div>
              <div class="stat-num">17.3 hrs / wk</div>
              <div class="stat-title">Weekly Engineering Time Spent on Debugging, Bad Code, and Maintenance</div>
              <div class="stat-source">Source: Stripe & Harris Poll, "The Developer Coefficient" (2018)<br/>URL: https://stripe.com/files/reports/the-developer-coefficient.pdf</div>
            </div>
            <div class="presenter-split-box">
              <div class="pip-ring"></div>
              <div class="pip-label">Presenter Camera (Split)</div>
              <div class="pip-sub">Citing Stripe's 17.3 hours/week report with direct PDF URL</div>
            </div>
          </div>
          <div class="subtitle-bar">"In Stripe's Developer Coefficient study, engineers spend over 17 hours every week on debugging and maintenance instead of building features."</div>
        </div>
      `
    },
    {
      id: 4,
      act: 'What (20%)',
      criterion: 'Solution Clarity',
      start: 18,
      duration: 9,
      timecode: '00:18 to 00:27',
      title: 'Shot 04: The Solution in One Sentence',
      presenterMode: 'Corner PiP',
      vo: 'ReproLens turns a ten-second bug recording into a runnable Playwright test script, with zero client SDKs.',
      citation: 'Core Value Proposition: Video Recording In, Self-Contained Playwright Test Out',
      renderHtml: (a) => `
        <div class="stage">
          <div class="one-sentence-box">
            <div class="product-label">ReproLens</div>
            <h1 class="hero-statement">Turn a 10-second user bug recording into a runnable Playwright test script, with zero client SDKs.</h1>
            <div class="pill-row">
              <span class="clean-pill">No Client SDK</span>
              <span class="clean-pill">No Browser Extension</span>
              <span class="clean-pill">Executable .spec.js Output</span>
            </div>
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"ReproLens turns a ten-second bug recording into a runnable Playwright test script, with zero client SDKs."</div>
        </div>
      `
    },
    {
      id: 5,
      act: 'What (20%)',
      criterion: 'Solution Clarity',
      start: 27,
      duration: 9,
      timecode: '00:27 to 00:36',
      title: 'Shot 05: The One Screen (ReproLens Studio)',
      presenterMode: 'Corner PiP',
      vo: 'Here is our single Studio screen: load the sample bug video on the left, and synthesize and run the Playwright test on the right.',
      citation: 'Full 1440x950 Two-Column Workspace at http://localhost:3000',
      renderHtml: (a) => `
        <div class="stage">
          <div class="center-frame">
            <div class="frame-caption">ReproLens Studio (http://localhost:3000): Video & Keyframes (Left) + Synthesized Test & Runner (Right)</div>
            <img src="${a.studioCompleted}" class="contained-img" />
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"Here is our single Studio screen: load the sample bug video on the left, and synthesize and run the Playwright test on the right."</div>
        </div>
      `
    },
    {
      id: 6,
      act: 'How (40%)',
      criterion: 'Technical Execution',
      start: 36,
      duration: 8,
      timecode: '00:36 to 00:44',
      title: 'Shot 06: FFmpeg 2fps Extraction (All 15 Keyframes)',
      presenterMode: 'Corner PiP',
      vo: 'When we click Analyze, FFmpeg samples the seven-second clip at two frames per second, saving all fifteen keyframes to disk.',
      citation: 'Module: engine/frame_extractor.js -> public/extracted_frames/frame_001.jpg .. frame_015.jpg',
      renderHtml: (a) => `
        <div class="stage">
          <div class="step-focus-card">
            <div class="step-header">Step 1: All 15 Keyframes Extracted by FFmpeg at 2fps (frame_001.jpg to frame_015.jpg)</div>
            <div class="frames-grid-15">
              ${a.all15Frames.map(f => `
                <div class="f-box-15 ${f.index === 13 ? 'highlight-box' : ''}">
                  <img src="${f.dataUrl}" />
                  <span>#${f.index} (${f.time})</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"When we click Analyze, FFmpeg samples the seven-second clip at two frames per second, saving all fifteen keyframes to disk."</div>
        </div>
      `
    },
    {
      id: 7,
      act: 'How (40%)',
      criterion: 'Technical Execution',
      start: 44,
      duration: 8,
      timecode: '00:44 to 00:52',
      title: 'Shot 07: Structured 6-Step Checkout Action Schema',
      presenterMode: 'Corner PiP',
      vo: 'Next, our action mapper pairs those keyframe timestamps with a six-step checkout schema: navigate, fill coupon, click apply, check points, place order, and assert the 409 alert.',
      citation: 'Module: engine/vision_analyzer.js (Deterministic 6-step checkout action sequence mapped to timestamps)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="center-frame">
            <div class="frame-caption">Live Studio Panel 3: Six Checkout Actions Mapped to Keyframe Timestamps (0.0s to 6.0s)</div>
            <img src="${a.studioActions}" class="contained-img" />
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"Next, our action mapper pairs those keyframe timestamps with a six-step checkout schema: navigate, fill coupon, click apply, check points, place order, and assert the 409 alert."</div>
        </div>
      `
    },
    {
      id: 8,
      act: 'How (40%)',
      criterion: 'Technical Execution',
      start: 52,
      duration: 10,
      timecode: '00:52 to 01:02',
      title: 'Shot 08: Playwright Code Synthesis',
      presenterMode: 'Corner PiP',
      vo: 'Third, the synthesizer compiles that schema into a self-contained Playwright test using semantic locators like getByPlaceholder and getByRole, backed by CSS fallbacks.',
      citation: 'Module: engine/synthesizer.js (Live Studio Panel 4 + resolveWithFallback helper)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="center-frame">
            <div class="frame-caption">Live Studio Panel 4: Synthesized Playwright Spec (engine/synthesizer.js)</div>
            <img src="${a.studioCode}" class="contained-img" />
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"Third, the synthesizer compiles that schema into a self-contained Playwright test using semantic locators like getByPlaceholder and getByRole, backed by CSS fallbacks."</div>
        </div>
      `
    },
    {
      id: 9,
      act: 'How (40%)',
      criterion: 'Technical Execution',
      start: 62,
      duration: 5,
      timecode: '01:02 to 01:07',
      title: 'Shot 09: Running the Synthesized Test File',
      presenterMode: 'Corner PiP',
      vo: 'Now we click Run Reproduction. Headless Chromium executes that exact synthesized test file and verifies the 409 assertion in 3.2 seconds.',
      citation: 'Module: engine/runner.js (Executes temp/reproduced_spec.js via Node.js)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="center-frame">
            <div class="frame-caption">Live Studio Panel 5: Headless Chromium Runner Terminal & Status Badge</div>
            <img src="${a.studioRunner}" class="contained-img" />
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"Now we click Run Reproduction. Headless Chromium executes that exact synthesized test file and verifies the 409 assertion in 3.2 seconds."</div>
        </div>
      `
    },
    {
      id: 10,
      act: 'How (40%)',
      criterion: 'Technical Execution',
      start: 67,
      duration: 5,
      timecode: '01:07 to 01:12',
      title: 'Shot 10: Side-by-Side Visual Verification',
      presenterMode: 'Corner PiP',
      vo: 'The browser hits the 409 conflict banner, passes the assertion, and saves the verification screenshot right next to frame thirteen.',
      citation: 'Assertion Passed: Verified against public/extracted_frames/frame_013.jpg',
      renderHtml: (a) => `
        <div class="stage">
          <div class="compare-grid">
            <div class="comp-card">
              <div class="comp-label">Extracted Video Frame 13 (frame_013.jpg at 6.0s)</div>
              <img src="${a.frame13}" class="comp-img" />
            </div>
            <div class="comp-card verified-card">
              <div class="comp-label">Headless Runner Screenshot (reproduced_bug.png)</div>
              <img src="${a.reproImg}" class="comp-img" />
            </div>
          </div>
          <div class="pip-corner">Presenter PiP</div>
          <div class="subtitle-bar">"The browser hits the 409 conflict banner, passes the assertion, and saves the verification screenshot right next to frame thirteen."</div>
        </div>
      `
    },
    {
      id: 11,
      act: 'What if (20%)',
      criterion: 'Creativity and Impact',
      start: 72,
      duration: 10,
      timecode: '01:12 to 01:22',
      title: 'Shot 11: Impact at Scale & Honest Current Limitation',
      presenterMode: 'Presenter Split (Right)',
      vo: 'At scale, every bug video becomes a permanent CI regression test. Right now, our FFmpeg extractor, AST synthesizer, and Chromium runner are live, while the vision mapper is a scripted fixture for this checkout flow.',
      citation: 'Honest Limitation: engine/vision_analyzer.js is currently a scripted 6-step fixture for the checkout scenario',
      renderHtml: (a) => `
        <div class="stage">
          <div class="content-split">
            <div style="display: flex; flex-direction: column; gap: 24px;">
              <div class="stat-card" style="height: auto; padding: 32px;">
                <div class="stat-label-top">Working Today (End-to-End Live)</div>
                <div class="stat-title" style="font-size: 24px; margin-bottom: 8px;">FFmpeg 2fps Extractor + AST Playwright Synthesizer + Headless Chromium Runner</div>
                <div class="stat-source">Extracts 15 real JPEG frames, generates resilient Playwright code with fallback chains, and reproduces the 409 bug in 3.2s.</div>
              </div>
              <div class="stat-card" style="height: auto; padding: 32px; border: 2px solid #E0382E;">
                <div class="stat-label-top" style="color: #E0382E;">Honest Current Limitation</div>
                <div class="stat-title" style="font-size: 24px; margin-bottom: 8px;">Vision Step (engine/vision_analyzer.js) Is Scripted for This Checkout Flow</div>
                <div class="stat-source">In this hackathon build, the vision analyzer returns the fixed 6-step checkout sequence rather than calling a live multimodal VLM API.</div>
              </div>
            </div>
            <div class="presenter-split-box">
              <div class="pip-ring"></div>
              <div class="pip-label">Presenter Camera (Split)</div>
              <div class="pip-sub">Transparently stating what is live vs scripted in this prototype</div>
            </div>
          </div>
          <div class="subtitle-bar">"At scale, every bug video becomes a permanent CI regression test. Right now, our FFmpeg extractor, AST synthesizer, and Chromium runner are live, while the vision mapper is a scripted fixture for this checkout flow."</div>
        </div>
      `
    },
    {
      id: 12,
      act: 'What if (20%)',
      criterion: 'Creativity and Impact',
      start: 82,
      duration: 8,
      timecode: '01:22 to 01:30',
      title: 'Shot 12: Next Steps & Repository Card (Direct to Camera)',
      presenterMode: 'Direct to Camera (Full)',
      vo: 'Our next step is replacing that fixture with live Gemini Vision inference for arbitrary pages. See the source code at github.com/letstakeabreak/reprolens.',
      citation: 'Repository: https://github.com/letstakeabreak/reprolens (Switch to Public before final form submission)',
      renderHtml: (a) => `
        <div class="stage">
          <div class="content-split">
            <div class="one-sentence-box" style="margin: 0; height: 520px;">
              <div class="product-label">ReproLens</div>
              <h1 class="hero-statement" style="font-size: 40px; margin-bottom: 16px;">Next Step: Live Multimodal VLM Inference for Any Web Page</h1>
              <p style="font-size: 20px; color: #6E6E73; margin-bottom: 32px;">Replacing the checkout action fixture with live frame-diffing vision inference and GitHub PR export.</p>
              <div class="repo-box">github.com/letstakeabreak/reprolens</div>
            </div>
            <div class="presenter-split-box" style="border-width: 3px;">
              <div class="pip-ring" style="width: 180px; height: 180px;"></div>
              <div class="pip-label">Presenter Direct to Camera</div>
              <div class="pip-sub">Full closing frame, no corner PiP duplicate</div>
            </div>
          </div>
          <div class="subtitle-bar">"Our next step is replacing that fixture with live Gemini Vision inference for arbitrary pages. See the source code at github.com/letstakeabreak/reprolens."</div>
        </div>
      `
    }
  ];

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const baseCss = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1920px;
      height: 1080px;
      background-color: #FFFFFF;
      color: #1F2123;
      font-family: "SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif;
      overflow: hidden;
    }
    .stage {
      width: 1920px;
      height: 1080px;
      padding: 48px 64px 128px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      background-color: #FFFFFF;
    }
    .content-split {
      display: grid;
      grid-template-columns: 1.3fr 0.7fr;
      gap: 48px;
      align-items: center;
      flex: 1;
    }
    .slack-card {
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 40px;
    }
    .slack-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      border-bottom: 1px solid #E5E5E7;
      padding-bottom: 16px;
    }
    .channel-name { font-size: 28px; font-weight: 700; color: #1F2123; }
    .msg-time { font-size: 18px; color: #6E6E73; }
    .slack-sender { font-size: 18px; font-weight: 600; color: #0B65DF; margin-bottom: 16px; }
    .slack-body { font-size: 26px; font-weight: 500; line-height: 1.5; margin-bottom: 24px; color: #1F2123; }
    .slack-attachment {
      background-color: #FFFFFF;
      border: 1px solid #E5E5E7;
      border-radius: 12px;
      padding: 24px;
    }
    .att-title { font-size: 20px; font-weight: 600; color: #E0382E; margin-bottom: 8px; }
    .att-sub { font-size: 17px; color: #6E6E73; }
    .presenter-split-box {
      background-color: #F5F5F7;
      border: 2px solid #0B65DF;
      border-radius: 18px;
      height: 520px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
    }
    .pip-ring {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background-color: #FFFFFF;
      border: 3px solid #0B65DF;
      margin-bottom: 24px;
    }
    .pip-label { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
    .pip-sub { font-size: 17px; color: #6E6E73; }
    .center-frame {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 24px;
      overflow: hidden;
    }
    .frame-caption {
      font-size: 20px;
      font-weight: 600;
      color: #1F2123;
      margin-bottom: 16px;
    }
    .contained-img {
      max-width: 100%;
      max-height: 740px;
      width: auto;
      height: auto;
      border-radius: 8px;
      border: 1px solid #E5E5E7;
    }
    .stat-card {
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 48px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .stat-label-top {
      font-size: 18px;
      font-weight: 700;
      color: #0B65DF;
      margin-bottom: 16px;
    }
    .stat-num {
      font-size: 84px;
      font-weight: 700;
      color: #0B65DF;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 24px;
    }
    .stat-title {
      font-size: 28px;
      font-weight: 700;
      color: #1F2123;
      margin-bottom: 16px;
      line-height: 1.35;
    }
    .stat-source {
      font-size: 17px;
      color: #6E6E73;
      line-height: 1.5;
    }
    .one-sentence-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 64px;
    }
    .product-label {
      font-size: 24px;
      font-weight: 700;
      color: #0B65DF;
      margin-bottom: 16px;
    }
    .hero-statement {
      font-size: 52px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.25;
      color: #1F2123;
      max-width: 1400px;
      margin-bottom: 32px;
    }
    .pill-row { display: flex; gap: 16px; }
    .clean-pill {
      background-color: #FFFFFF;
      border: 1px solid #E5E5E7;
      padding: 12px 24px;
      border-radius: 999px;
      font-size: 18px;
      font-weight: 600;
      color: #1F2123;
    }
    .repo-box {
      display: inline-block;
      background-color: #0B65DF;
      color: #FFFFFF;
      padding: 16px 32px;
      border-radius: 999px;
      font-size: 24px;
      font-weight: 600;
      width: fit-content;
    }
    .step-focus-card {
      flex: 1;
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 32px 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .step-header {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #1F2123;
    }
    .frames-grid-15 {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
    }
    .f-box-15 {
      background-color: #FFFFFF;
      border: 1px solid #E5E5E7;
      border-radius: 10px;
      padding: 8px;
      text-align: center;
    }
    .f-box-15.highlight-box {
      border: 3px solid #E0382E;
    }
    .f-box-15 img {
      width: 100%;
      height: 140px;
      object-fit: contain;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .f-box-15 span {
      font-size: 14px;
      font-weight: 600;
      color: #1F2123;
    }
    .compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      flex: 1;
      align-items: center;
    }
    .comp-card {
      background-color: #F5F5F7;
      border-radius: 18px;
      padding: 24px;
      text-align: center;
    }
    .comp-card.verified-card {
      border: 3px solid #0B65DF;
    }
    .comp-label {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .comp-img {
      max-width: 100%;
      max-height: 620px;
      width: auto;
      height: auto;
      border-radius: 8px;
      border: 1px solid #E5E5E7;
    }
    .pip-corner {
      position: absolute;
      bottom: 132px;
      right: 80px;
      width: 136px;
      height: 136px;
      border-radius: 50%;
      background-color: #FFFFFF;
      border: 3px solid #0B65DF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #0B65DF;
      text-align: center;
      padding: 12px;
    }
    .subtitle-bar {
      position: absolute;
      bottom: 32px;
      left: 64px;
      right: 64px;
      height: 76px;
      background-color: #1F2123;
      color: #FFFFFF;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 32px;
      font-size: 21px;
      font-weight: 600;
      text-align: center;
    }
  `;

  const segmentFiles = [];

  for (const shot of SHOTS) {
    const padNum = String(shot.id).padStart(2, '0');
    const pngPath = path.join(shotsDir, `shot_${padNum}.png`);
    const aiffPath = path.join(tempDir, `vo_${padNum}.aiff`);
    const segMp4Path = path.join(tempDir, `seg_${padNum}.mp4`);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>${shot.renderHtml(assets)}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: pngPath });

    execSync(`say -v Samantha -r 185 -o "${aiffPath}" "${shot.vo.replace(/"/g, '\\"')}"`);

    execSync(
      `ffmpeg -y -loop 1 -i "${pngPath}" -i "${aiffPath}" -filter_complex "[1:a]apad=whole_dur=${shot.duration}[a]" -map 0:v -map "[a]" -c:v libx264 -tune stillimage -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -t ${shot.duration} "${segMp4Path}"`,
      { stdio: 'pipe' }
    );

    segmentFiles.push(segMp4Path);
    console.log(`Built Shot ${padNum} (${shot.duration}s): ${shot.title}`);
  }

  await browser.close();

  const concatListPath = path.join(tempDir, 'concat.txt');
  fs.writeFileSync(
    concatListPath,
    segmentFiles.map(f => `file '${f}'`).join('\n'),
    'utf8'
  );

  const finalPrevisMp4 = path.join(rootDir, 'public', 'reprolens_previs_90s.mp4');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${finalPrevisMp4}"`,
    { stdio: 'pipe' }
  );

  console.log(`Successfully rendered 90s Previs MP4: ${finalPrevisMp4}`);
}

buildPrevis().catch(err => {
  console.error(err);
  process.exit(1);
});
